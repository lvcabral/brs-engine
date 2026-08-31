import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import {
    BrsType,
    RoList,
    RoArray,
    RoMessagePort,
    toAssociativeArray,
    FlexObject,
    isBrsString,
    isAnyNumber,
    jsValueOf,
} from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { RoChannelStoreEvent } from "../events/RoChannelStoreEvent";
import { RoAssociativeArray } from "./RoAssociativeArray";
import { AppData, genHexAddress } from "../../common";
import { XmlDocument, XmlElement, XmlNode } from "xmldoc";
import { IfSetMessagePort, IfGetMessagePort } from "../interfaces/IfMessagePort";
import { BrsDevice } from "../../device/BrsDevice";
import { v5 as uuidv5 } from "uuid";

/**
 * Payload of a mocked partner-order step (the transactional/TVOD purchase flow), keyed exactly as
 * `ifChannelStore` documents it. The ChannelStore node publishes the same values but names the order
 * id `orderId` rather than `id`, and renames that one key at its own edge.
 */
type PartnerOrderPayload = Record<string, string>;

export class RoChannelStore extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly id: number;
    private readonly order: RoAssociativeArray[];
    private orderInfo: RoAssociativeArray | BrsInvalid;
    private credData: string;
    private partnerOrderId: string;
    private partnerPurchaseId: string;
    private fakeServerEnabled: boolean;
    private port?: RoMessagePort;

    constructor() {
        super("roChannelStore");
        this.id = 103809000 + Math.floor(Math.random() * 100) + 1;
        this.order = [];
        this.orderInfo = BrsInvalid.Instance;
        this.credData = "";
        this.partnerOrderId = "";
        this.partnerPurchaseId = "";
        this.fakeServerEnabled = false;
        const setPortIface = new IfSetMessagePort(this);
        const getPortIface = new IfGetMessagePort(this);
        this.registerMethods({
            ifChannelStore: [
                this.getIdentity,
                this.getCatalog,
                this.getStoreCatalog,
                this.getPurchases,
                this.getAllPurchases,
                this.setOrder,
                this.clearOrder,
                this.deltaOrder,
                this.getOrder,
                this.doOrder,
                this.fakeServer,
                this.getUserData,
                this.getUserRegionData,
                this.getPartialUserData,
                this.storeChannelCredData,
                this.getChannelCred,
                this.getDeviceAttestation,
                this.requestPartnerOrder,
                this.confirmPartnerOrder,
                setPortIface.setMessagePort,
                getPortIface.getMessagePort,
            ],
        });
    }

    setFakeServer(enable: boolean) {
        this.fakeServerEnabled = enable;
    }

    /**
     * Replaces the current order (shopping cart).
     * @param order The new order items; an empty array clears the order.
     * @param orderInfo Order-level metadata (the ChannelStore node's top-level `action` field, i.e.
     *                  "Upgrade"/"Downgrade"). Omit it to leave the current metadata untouched.
     */
    setNewOrder(order: RoAssociativeArray[], orderInfo: RoAssociativeArray | BrsInvalid = BrsInvalid.Instance) {
        this.order.length = 0;
        this.order.push(...order);
        this.orderInfo =
            this.order.length > 0 && orderInfo instanceof RoAssociativeArray ? orderInfo : BrsInvalid.Instance;
    }

    /**
     * Applies a quantity delta to one item of the current order.
     *
     * A negative quantity reduces the item and removes it from the cart once its running quantity
     * reaches zero — documented both on the node's `deltaOrder` field and on `ifChannelStore.DeltaOrder`.
     * @param codeValue Product identifier of the item to change.
     * @param qtyValue Quantity to add; may be negative.
     * @returns The item's remaining quantity, or 0 when it was removed or is not in the cart.
     */
    setDeltaOrder(codeValue: string, qtyValue: number): number {
        const codeKey = new BrsString("code");
        const qtyKey = new BrsString("qty");
        for (let index = 0; index < this.order.length; index++) {
            const item = this.order[index];
            const code = item.get(codeKey);
            // Match on the code alone: an item whose `qty` is not numeric (an app can set it as a
            // string on the order ContentNode) still has to update in place rather than be appended
            // a second time under the same code.
            if (!isBrsString(code) || code.getValue() !== codeValue) {
                continue;
            }
            const qty = item.get(qtyKey);
            const newQty = (isAnyNumber(qty) ? jsValueOf(qty) : 0) + qtyValue;
            if (newQty <= 0) {
                this.order.splice(index, 1);
                if (this.order.length === 0) this.orderInfo = BrsInvalid.Instance;
                return 0;
            }
            item.set(qtyKey, new Int32(newQty));
            return newQty;
        }
        // A non-positive delta on an item that is not in the cart is a no-op, not a negative line item.
        if (qtyValue <= 0) {
            return 0;
        }
        // Add new item to order if not already in the cart
        this.order.push(toAssociativeArray({ code: codeValue, qty: qtyValue }));
        return qtyValue;
    }

    /** Returns a snapshot of the current order items, mirroring `ifChannelStore.GetOrder()`. */
    getOrderItems(): RoAssociativeArray[] {
        return [...this.order];
    }

    getProductData(type: string, status: { code: number; message: string }) {
        let catalog: RoAssociativeArray[] = [];
        if (this.fakeServerEnabled) {
            catalog = this.getFakeProductData(type);
            status.code = 1;
            status.message = "Items Received";
        }
        return catalog;
    }

    placeOrder(status: { code: number; message: string }) {
        let order: RoAssociativeArray[] = [];
        // An empty cart can never be ordered — `DoOrder()` guards this too, but the guard has to live
        // here as well or the fake order XML's items get reported as purchased for an empty order.
        if (this.order.length === 0) {
            status.code = -3;
            status.message = "Invalid Order";
            return order;
        }
        status.code = 1;
        status.message = "Order Succeeded";
        const catalog = this.getFakeProductData("GetCatalog");
        for (let item of this.order) {
            if (!this.isValidProductOrder(catalog, item)) {
                status.code = -3;
                status.message = "Invalid Product Order";
                break;
            }
        }
        if (status.code === 1) {
            const orderData = this.getFakeOrderData("PlaceOrder");
            const checkId = this.getFakeOrderData("CheckOrder").id;
            if (orderData.id !== checkId) {
                status.code = -3;
                status.message = "Order Mismatch";
            }
            if (Array.isArray(orderData.order)) {
                order = orderData.order.filter((item) => item instanceof RoAssociativeArray);
            }
        }
        return order;
    }

    /**
     * Canned Roku account data backing the mocked user-data commands, keyed by the `requestedUserData`
     * name (always lowercase) that yields it and holding the result fields that name expands to. The
     * two key spaces differ: `street` yields both `street1` and `street2`, `firstname` yields
     * `firstName`. Declared in the reference's table order so an "all" request produces stable output.
     */
    private static readonly fakeUserData = new Map<string, Record<string, string>>([
        ["firstname", { firstName: "John" }],
        ["lastname", { lastName: "Doe" }],
        ["email", { email: "john.doe@email.com" }],
        ["street", { street1: "1155 Coleman Ave", street2: "" }],
        ["city", { city: "San Jose" }],
        ["state", { state: "CA" }],
        ["zip", { zip: "95110" }],
        ["country", { country: "USA" }],
        ["phone", { phone: "4085551212" }],
        ["birth", { birth: "1970-01" }],
        ["gender", { gender: "Male" }],
    ]);

    /** Merges the canned account data for the given request names, skipping any unknown one. */
    private static accountFields(names: Iterable<string>): FlexObject {
        const data: FlexObject = {};
        for (const name of names) {
            Object.assign(data, RoChannelStore.fakeUserData.get(name));
        }
        return data;
    }

    /**
     * Mocks the account data returned by `GetUserData`/`GetPartialUserData` and by the ChannelStore
     * node's `getUserData` command.
     * @param requested "all" (the default) or a comma-separated list of request names.
     * @param context "signup" (the default) or "signin"; a sign-in RFI screen lists only email/phone
     *                and ignores any other requested attribute.
     * @returns The account data, or `undefined` when fakeServer is disabled — callers then report the
     *          same `invalid` a device returns when the user declines to share their information.
     */
    getUserAccountData(requested: string = "all", context: string = "signup"): RoAssociativeArray | undefined {
        if (!this.fakeServerEnabled) {
            return undefined;
        }
        const names =
            requested.trim().toLowerCase() === "all"
                ? [...RoChannelStore.fakeUserData.keys()]
                : requested.split(",").map((name) => name.trim().toLowerCase());
        // A sign-in RFI screen lists only email/phone; any other attribute requested is ignored.
        const signIn = context.trim().toLowerCase() === "signin";
        const requestNames = signIn ? names.filter((name) => name === "email" || name === "phone") : names;
        return toAssociativeArray(RoChannelStore.accountFields(requestNames));
    }

    /**
     * Mocks `GetUserRegionData` and the node's `getUserRegionData` command.
     * @returns The region of the mocked account, or `undefined` when fakeServer is disabled.
     */
    getRegionData(): RoAssociativeArray | undefined {
        if (!this.fakeServerEnabled) {
            return undefined;
        }
        return toAssociativeArray(RoChannelStore.accountFields(["state", "zip", "country"]));
    }

    /**
     * Mocks `StoreChannelCredData`: stores the artifact that `GetChannelCred` later returns as
     * `channel_data`.
     *
     * Deliberately NOT gated on `fakeServer`, unlike the catalog/order commands: this is the Roku
     * cloud credential store behind account linking, not a Streaming Store response, and the artifact
     * it round-trips is the app's own. Gating it would silently discard tokens in production.
     * @param data The artifact to store.
     * @returns The documented `{ response, status }` payload, where `response` is a JSON *string* and
     *          `status` is 0 on success (the inverse of the catalog/order convention).
     */
    storeCredData(data: string): RoAssociativeArray {
        this.credData = data;
        // `error_detail` is documented as uninitialized on success, so it is omitted entirely.
        return toAssociativeArray({ response: JSON.stringify({ status: "success", error: "none" }), status: 0 });
    }

    /**
     * Mocks `GetChannelCred` and the node's `getChannelCred` command. Not gated on `fakeServer`, for
     * the reason given on {@link storeCredData}.
     * @returns The documented `{ channelID, errorCode, json, publisherDeviceID, status }` payload.
     *          `json` is built with `JSON.stringify` so the documented `ParseJson(channelCred.json)`
     *          usage succeeds.
     */
    getChannelCredData(): RoAssociativeArray {
        const app = BrsDevice.deviceInfo.appList?.find((app: AppData) => app.running);
        const channelId = app?.id ?? "dev";
        const deviceId = BrsDevice.deviceInfo.clientId;
        const payload: FlexObject = {
            // A PUCID identifies the same user and app across every device linked to one Roku
            // account, so derive it deterministically rather than minting a fresh uuid per call.
            roku_pucid: uuidv5(`${channelId}:${deviceId}`, uuidv5.URL),
            token_type: "urn:roku:pucid:token_type:pucid_token",
        };
        // Returned only when the app actually stored something with StoreChannelCredData().
        if (this.credData !== "") {
            payload.channel_data = this.credData;
        }
        return toAssociativeArray({
            channelID: channelId,
            errorCode: "",
            json: JSON.stringify(payload),
            publisherDeviceID: deviceId,
            status: 0,
        });
    }

    /**
     * Mocks `RequestPartnerOrder`: the billing check that must precede a partner order confirmation.
     * A successful check remembers its order id so `confirmPartnerOrderData` can validate it.
     * @param orderInfo The order details; expected to be an associative array.
     * @param productId The product identifier, when supplied separately from `orderInfo`.
     * @returns The check result. Every failure code here is an engine choice, not a device
     *          measurement; they reuse the node's documented status table (-1 unavailable,
     *          -3 order error, -4 invalid request).
     */
    requestPartnerOrderData(orderInfo: BrsType, productId: string): PartnerOrderPayload {
        if (!this.fakeServerEnabled) {
            return RoChannelStore.partnerOrderFailure("-1", "fakeServer is not enabled");
        }
        if (!(orderInfo instanceof RoAssociativeArray)) {
            return RoChannelStore.partnerOrderFailure("-4", "Invalid request");
        }
        const code = productId.trim() || RoChannelStore.textField(orderInfo, "code");
        if (code === "") {
            return RoChannelStore.partnerOrderFailure("-4", "Missing required order field: code");
        }
        const price = RoChannelStore.textField(orderInfo, "price");
        if (price === "") {
            return RoChannelStore.partnerOrderFailure("-4", "Missing required order field: price");
        }
        this.mintPartnerOrderIds();
        // Prices carry no currency symbol, matching the documented convention for the request fields.
        return { id: this.partnerOrderId, status: "Success", tax: "0.00", total: price };
    }

    /**
     * Mocks `ConfirmPartnerOrder`, the transactional-purchase equivalent of `DoOrder`.
     * @param orderInfo The confirmation details; must carry the `orderId` from the preceding check.
     * @param productId The product identifier, when supplied separately from `orderInfo`.
     * @returns The confirmation payload; fails unless a matching billing check ran first.
     */
    confirmPartnerOrderData(orderInfo: BrsType, productId: string): PartnerOrderPayload {
        if (!this.fakeServerEnabled) {
            return RoChannelStore.partnerOrderFailure("-1", "fakeServer is not enabled");
        }
        if (!(orderInfo instanceof RoAssociativeArray)) {
            return RoChannelStore.partnerOrderFailure("-4", "Invalid request");
        }
        if (this.partnerOrderId === "") {
            return RoChannelStore.partnerOrderFailure("-3", "requestPartnerOrder must be called first");
        }
        if (RoChannelStore.textField(orderInfo, "orderId") !== this.partnerOrderId) {
            return RoChannelStore.partnerOrderFailure("-3", "Order ID mismatch");
        }
        const purchaseId = this.partnerPurchaseId;
        // An order id is single use: confirming again requires a fresh billing check.
        this.partnerOrderId = "";
        this.partnerPurchaseId = "";
        return { purchaseId, status: "Success" };
    }

    /** Builds a failed partner-order payload with the documented error keys populated. */
    private static partnerOrderFailure(errorCode: string, errorMessage: string): PartnerOrderPayload {
        return { errorCode, errorMessage, status: "Failure" };
    }

    /**
     * Reads an entry off an associative array as text, returning "" when it is absent.
     * A numeric value is accepted: the fields read this way are only ever compared and echoed as
     * strings, so rejecting the number the XML parser produces would fail a valid order.
     */
    private static textField(source: RoAssociativeArray, name: string): string {
        const value = source.get(new BrsString(name));
        if (isBrsString(value)) {
            return value.getValue().trim();
        }
        return isAnyNumber(value) ? jsValueOf(value).toString() : "";
    }

    /**
     * Mints the pair of ids a partner order reports, from a single read of `csfake/PlaceOrder.xml`.
     *
     * Both come from that one fixture, so they are derived together: reading it again at confirm time
     * would re-stat, re-read and re-parse the same file for one more string. Taking the ids from the
     * fixture (rather than generating them) is what keeps test output deterministic; with no fixture
     * present, fall back to the engine's unique-id helper.
     */
    private mintPartnerOrderIds() {
        const hasFixture = BrsDevice.fileSystem.existsSync("pkg:/csfake/PlaceOrder.xml");
        const fixture = hasFixture ? this.getFakeOrderData("PlaceOrder") : {};
        // The XML parser coerces a numeric-looking id to a number, so accept both scalar shapes and
        // ignore anything else; getFakeOrderData reports a missing file by seeding `id` with the file
        // name, which `hasFixture` already rules out.
        const id = fixture.id;
        const fixtureId = typeof id === "string" || typeof id === "number" ? String(id) : "";
        this.partnerOrderId = fixtureId || genHexAddress();
        const items = Array.isArray(fixture.order) ? fixture.order : [];
        const first = items[0];
        const purchaseId = first instanceof RoAssociativeArray ? RoChannelStore.textField(first, "purchaseId") : "";
        this.partnerPurchaseId = purchaseId || `${this.partnerOrderId}-1`;
    }

    getAttestationToken() {
        // Sample JWT token from Roku documentation
        const sampleJwt = `eyJ4NXUiOiJodHRwczovL2V4YW1wbGUucm9rdS5jb20vc2FtcGxlY2VydCIsInR5cCI6IkpXVCIsImFsZyI6IlJTMjU2In0.\
eyJuYmYiOjE2NTYzNzQyNzQsIngtcm9rdS1hdHRlc3RhdGlvbi1kYXRhIjp7Im5vbmNlIjoiNUUwNjkyRTBBMzg5RjRGNiIsImNoYW5uZWxJZCI6Im\
RldiIsImRldmVsb3BlcklkIjoiY2FhNzNmYmI1ZTc1YTQ2YTRiNjExNGRlNTFhNWFkYTdkNjE2ZTJlZCIsInRpbWVzdGFtcE1zIjoxNjU2Mzc3ODcz\
OTkwfSwiaXNzIjoidXJuOnJva3U6Y2xvdWQtc2VydmljZXM6ZGV2aWNlLWF0dGVzdGF0aW9uIiwiZXhwIjoxNjU2NDY0Mjc0fQ.nywDvSUys27oeaQ\
Z3yXwNBfOnXbO-TUDuekOPZYjSssfZhNhWwRXvPLbJKHcNMR5Z0vFOQLVDFeqEVGauIMxMEke5UFLuCRxhr3ayBJJPt_BPfrEFbAvYjFEGdKkxJqYU\
huFE38R8lU2k7dhO0iFxDw1Qq7W4w8_7CjmDy4YFf7IfyhV7Vf2kGiOx5C94Niw5N2td3s21F3z77Rq_bofQ51DOKIwo_cDVuvPQnDyxG-CNEydZKC\
ZZwGPYCKEHMPrIOOXJ-S9ZjArgaEpBUpMXWJibFxnkpVUVzbC22GEaqz_SjOJXFMQU7TaCKkDeCYVKylgKwCvbvHRDlgogf7kq`;
        return new BrsString(sampleJwt);
    }

    toString(parent?: BrsType): string {
        return "<Component: roChannelStore>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    dispose() {
        this.port?.removeReference();
    }

    private static parseChannelStoreXml(xmlText: string): Record<string, any> {
        const document = new XmlDocument(xmlText);
        return { [document.name]: RoChannelStore.elementToObject(document) };
    }

    private static elementToObject(element: XmlElement): any {
        const isElementNode = function (node: XmlNode): node is XmlElement {
            return node.type === "element";
        };
        const childElements = (element.children ?? []).filter(isElementNode) as XmlElement[];
        if (childElements.length === 0) {
            return RoChannelStore.coerceValue(element.val ?? "");
        }
        const result: Record<string, any> = {};
        for (const child of childElements) {
            const value = RoChannelStore.elementToObject(child);
            const key = child.name;
            if (result[key] === undefined) {
                result[key] = value;
            } else if (Array.isArray(result[key])) {
                result[key].push(value);
            } else {
                result[key] = [result[key], value];
            }
        }
        return result;
    }

    private static coerceValue(text: string): string | number {
        const trimmed = text.trim();
        if (trimmed.length === 0) {
            return "";
        }
        const asNumber = Number(trimmed);
        if (!Number.isNaN(asNumber) && Number.isFinite(asNumber)) {
            return asNumber;
        }
        return trimmed;
    }

    private getFakeProductData(xml: string) {
        const data: RoAssociativeArray[] = [];
        const fsys = BrsDevice.fileSystem;
        if (fsys.existsSync(`pkg:/csfake/${xml}.xml`)) {
            const fileContent = fsys.readFileSync(`pkg:/csfake/${xml}.xml`);
            const xmlText = typeof fileContent === "string" ? fileContent : fileContent.toString();
            let errMessage = "";
            try {
                const parsed = RoChannelStore.parseChannelStoreXml(xmlText);
                const products = parsed?.result?.products?.product;
                const productList = Array.isArray(products) ? products : products ? [products] : [];
                if (productList.length > 0) {
                    for (const item of productList) {
                        if (item && typeof item === "object") {
                            const obj = item as FlexObject;
                            const prod: FlexObject = {};
                            prod.code = obj.code;
                            prod.cost = obj.cost;
                            prod.freeTrialQuantity = obj.freeTrialQuantity;
                            prod.freeTrialType = obj.freeTrialType;
                            prod.name = obj.name;
                            prod.productType = obj.productType;
                            prod.purchaseDate = obj.purchaseDate;
                            prod.qty = obj.qty;
                            prod.inDunning = obj.inDunning ?? "false";
                            prod.isUpgrade = obj.isUpgrade ?? "false";
                            prod.trialCost = obj.trialCost ?? "$0.00";
                            prod.trialQuantity = obj.trialQuantity ?? 0;

                            if (obj.description) prod.description = obj.description;
                            if (obj.id) prod.id = obj.id;
                            if (obj.expirationDate) prod.expirationDate = obj.expirationDate;
                            if (obj.purchaseId) prod.purchaseId = obj.purchaseId;
                            if (obj.renewalDate) prod.renewalDate = obj.renewalDate;
                            if (obj.trialType) prod.trialType = obj.trialType;
                            if (obj.status) prod.status = obj.status;
                            data.push(toAssociativeArray(prod));
                        }
                    }
                } else {
                    errMessage = "warning,Warning: Empty or invalid result when parsing Product XML.";
                }
            } catch (err: any) {
                errMessage = `error,Error parsing Product XML: ${err?.message ?? err}`;
            }
            if (errMessage !== "" && BrsDevice.isDevMode) {
                BrsDevice.stderr.write(errMessage);
            }
        }
        return data;
    }

    private getFakeOrderData(xml: string) {
        const fs = BrsDevice.fileSystem;
        const data: FlexObject = { id: xml };
        if (fs.existsSync(`pkg:/csfake/${xml}.xml`)) {
            const xmlData = fs.readFileSync(`pkg:/csfake/${xml}.xml`);
            const xmlText = typeof xmlData === "string" ? xmlData : xmlData.toString();
            let errMessage = "";
            try {
                const parsed = RoChannelStore.parseChannelStoreXml(xmlText);
                const order = parsed?.result?.order as FlexObject | undefined;
                if (order) {
                    const orderObj: any = order;
                    if (orderObj.id) {
                        data.id = orderObj.id;
                    }
                    const itemsObj: any = orderObj.items ?? {};
                    const orderItems = itemsObj.orderItem;
                    const orderArray: RoAssociativeArray[] = [];
                    if (Array.isArray(orderItems)) {
                        for (const item of orderItems) {
                            orderArray.push(toAssociativeArray(item as FlexObject));
                        }
                    } else if (orderItems) {
                        orderArray.push(toAssociativeArray(orderItems as FlexObject));
                    }
                    data.order = orderArray;
                } else {
                    errMessage = "warning,Warning: Empty or invalid result when parsing Order XML.";
                }
            } catch (err: any) {
                errMessage = `error,Error parsing Order XML: ${err?.message ?? err}`;
            }
            if (errMessage !== "" && BrsDevice.isDevMode) {
                BrsDevice.stderr.write(errMessage);
            }
        }
        return data;
    }

    private isValidProductOrder(catalog: RoAssociativeArray[], item: RoAssociativeArray) {
        // Order items assembled from a ContentNode hold BOXED values (`roString`/`roInt`), because
        // that is what `addFields` stores — so match on the unwrapped value, never on `instanceof`.
        const qty = item.get(new BrsString("qty"));
        if (isAnyNumber(qty) && jsValueOf(qty) <= 0) {
            return false;
        }
        const orderCode = item.get(new BrsString("code"));
        if (!isBrsString(orderCode)) {
            return false;
        }
        return catalog.some((prod) => {
            const prodCode = prod.get(new BrsString("code"));
            return isBrsString(prodCode) && prodCode.getValue() === orderCode.getValue();
        });
    }

    // ifChannelStore ------------------------------------------------------------------------------------

    /** Returns a unique number that can be used to identify whether a roChannelStoreEvent originated from this object. */
    private readonly getIdentity = new Callable("getIdentity", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.id);
        },
    });

    /** Requests the list of In-Channel products which are linked to the running channel. */
    private readonly getCatalog = new Callable("getCatalog", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            if (this.port) {
                const status = { code: -4, message: "Empty List" };
                const catalog = this.getProductData("GetCatalog", status);
                this.port.pushMessage(new RoChannelStoreEvent(this.id, catalog, status));
            }
            return BrsInvalid.Instance;
        },
    });

    /** Requests the list of globally available In-Channel products, which are available to all channels. */
    private readonly getStoreCatalog = new Callable("getStoreCatalog", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            if (this.port) {
                const status = { code: -4, message: "Empty List" };
                const catalog = this.getProductData("GetCatalog", status);
                this.port.pushMessage(new RoChannelStoreEvent(this.id, catalog, status));
            }
            return BrsInvalid.Instance;
        },
    });

    /** Requests the list of active purchases associated with the current user account. */
    private readonly getPurchases = new Callable("getPurchases", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            if (this.port) {
                const status = { code: -4, message: "Empty List" };
                const purchases = this.getProductData("GetPurchases", status);
                this.port.pushMessage(new RoChannelStoreEvent(this.id, purchases, status));
            }
            return BrsInvalid.Instance;
        },
    });

    /** Requests the list of all purchases associated with the current user account, including expired. */
    private readonly getAllPurchases = new Callable("getAllPurchases", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            if (this.port) {
                const status = { code: -4, message: "Empty List" };
                const purchases = this.getProductData("GetPurchases", status);
                this.port.pushMessage(new RoChannelStoreEvent(this.id, purchases, status));
            }
            return BrsInvalid.Instance;
        },
    });

    /** Sets the current Order which must be an roList of roAssociativeArray items. */
    private readonly setOrder = new Callable("setOrder", {
        signature: {
            args: [
                new StdlibArgument("order", ValueKind.Object),
                new StdlibArgument("orderInfo", ValueKind.Object, BrsInvalid.Instance),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, order: BrsComponent, orderInfo: RoAssociativeArray | BrsInvalid) => {
            if (order instanceof RoList || order instanceof RoArray) {
                const items = order.getElements().filter((item) => item instanceof RoAssociativeArray);
                this.setNewOrder(items, orderInfo);
            }
            return BrsInvalid.Instance;
        },
    });

    /** Clears the current Order (shopping cart). After this call, the Order is empty. */
    private readonly clearOrder = new Callable("clearOrder", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.setNewOrder([], BrsInvalid.Instance);
            return BrsInvalid.Instance;
        },
    });

    /** Applies a change in quantity to one item in the current Order (shopping cart). */
    private readonly deltaOrder = new Callable("deltaOrder", {
        signature: {
            args: [new StdlibArgument("code", ValueKind.String), new StdlibArgument("qty", ValueKind.Int32)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, code: BrsString, qty: Int32) => {
            return new Int32(this.setDeltaOrder(code.value, qty.getValue()));
        },
    });

    /** Retrieves the current Order (shopping cart). */
    private readonly getOrder = new Callable("getOrder", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return new RoList(this.order);
        },
    });

    /** If the user approves the order, this function returns true, otherwise it returns false */
    private readonly doOrder = new Callable("doOrder", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            if (!this.port) {
                return BrsBoolean.False;
            }
            // placeOrder rejects an empty cart itself; the fakeServer check has to stay here, or with
            // fakeServer off but a csfake/ folder present it would report "Invalid Product Order".
            const status = { code: -3, message: "Invalid Order" };
            const order = this.fakeServerEnabled ? this.placeOrder(status) : [];
            this.port.pushMessage(new RoChannelStoreEvent(this.id, order, status));
            return BrsBoolean.from(status.code === 1);
        },
    });

    /** This test mode short circuits communication to the Roku Channel store. */
    private readonly fakeServer = new Callable("fakeServer", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            this.fakeServerEnabled = enable.toBoolean();
            return BrsInvalid.Instance;
        },
    });

    /** Provides a way to request user authorization to share his account information with the calling channel. */
    private readonly getUserData = new Callable("getUserData", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.getUserAccountData() ?? BrsInvalid.Instance;
        },
    });

    /** Retrieves the state, zip code, and country associated with the customer's Roku account. */
    private readonly getUserRegionData = new Callable("getUserRegionData", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.getRegionData() ?? toAssociativeArray({ state: "", zip: "", country: "" });
        },
    });

    /** Provides a way to request user authorization to share his account information with the calling channel. */
    private readonly getPartialUserData = new Callable("getPartialUserData", {
        signature: {
            args: [
                new StdlibArgument("properties", ValueKind.String),
                new StdlibArgument("requestInfo", ValueKind.Object, BrsInvalid.Instance),
            ],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, properties: BrsString, requestInfo: BrsType) => {
            const context =
                requestInfo instanceof RoAssociativeArray ? RoChannelStore.textField(requestInfo, "context") : "";
            return this.getUserAccountData(properties.value, context || "signup") ?? BrsInvalid.Instance;
        },
    });

    /** Stores an access token, oAuth token, or other authentication artifact that can be retrieved by calling the GetChannelCred method. */
    private readonly storeChannelCredData = new Callable("storeChannelCredData", {
        signature: {
            args: [new StdlibArgument("data", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, data: BrsString) => {
            return this.storeCredData(data.value);
        },
    });

    /** Returns channel information from the Channel Store. */
    private readonly getChannelCred = new Callable("getChannelCred", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.getChannelCredData();
        },
    });

    /** Generates a signed JSON web token (JWT) in the Roku cloud and returns it to the app. */
    private readonly getDeviceAttestation = new Callable("getDeviceAttestation", {
        signature: {
            args: [new StdlibArgument("nonce", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, nonce: BrsString) => {
            return this.getAttestationToken();
        },
    });

    /** Checks the user's billing status and is a prerequisite for ConfirmPartnerOrder() when doing transactional purchases. */
    private readonly requestPartnerOrder = new Callable("requestPartnerOrder", {
        signature: {
            args: [
                new StdlibArgument("orderInfo", ValueKind.Object),
                new StdlibArgument("productId", ValueKind.String),
            ],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, orderInfo: RoAssociativeArray, productId: BrsString) => {
            return toAssociativeArray(this.requestPartnerOrderData(orderInfo, productId.value));
        },
    });

    /** This function is equivalent to doOrder() for transactional purchases. */
    private readonly confirmPartnerOrder = new Callable("confirmPartnerOrder", {
        signature: {
            args: [
                new StdlibArgument("confirmOrderInfo", ValueKind.Object),
                new StdlibArgument("productId", ValueKind.String),
            ],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, confirmOrderInfo: RoAssociativeArray, productId: BrsString) => {
            return toAssociativeArray(this.confirmPartnerOrderData(confirmOrderInfo, productId.value));
        },
    });
}
