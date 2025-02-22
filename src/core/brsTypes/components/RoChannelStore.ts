import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoList, RoArray, RoMessagePort, toAssociativeArray, FlexObject } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { RoChannelStoreEvent } from "../events/RoChannelStoreEvent";
import { RoAssociativeArray } from "./RoAssociativeArray";
import { AppData } from "../../common";
import { parseString, processors } from "xml2js";
import { IfSetMessagePort, IfGetMessagePort } from "../interfaces/IfMessagePort";
import { BrsDevice } from "../../device/BrsDevice";

export class RoChannelStore extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly id: number;
    private order: RoAssociativeArray[];
    private orderInfo: RoAssociativeArray | BrsInvalid;
    private credData: string;
    private fakeServerEnabled: boolean;
    private port?: RoMessagePort;

    constructor() {
        super("roChannelStore");
        this.id = 103809000 + Math.floor(Math.random() * 100) + 1;
        this.order = [];
        this.orderInfo = BrsInvalid.Instance;
        this.credData = "";
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

    toString(parent?: BrsType): string {
        return "<Component: roChannelStore>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    dispose() {
        this.port?.removeReference();
    }

    private getFakeProductData(xml: string) {
        const options = {
            explicitArray: false,
            ignoreAttrs: true,
            valueProcessors: [processors.parseNumbers],
        };
        const data: RoAssociativeArray[] = [];
        if (BrsDevice.fileSystem.existsSync(`pkg:/csfake/${xml}.xml`)) {
            const xmlData = BrsDevice.fileSystem.readFileSync(`pkg:/csfake/${xml}.xml`);
            parseString(xmlData, options, function (err: any, parsed: any) {
                let errMessage = "";
                if (err) {
                    errMessage = `error,Error parsing Product XML: ${err.message}`;
                } else if (parsed?.result?.products?.product) {
                    try {
                        parsed.result.products.product.forEach((item: any) => {
                            const obj = JSON.parse(JSON.stringify(item));
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
                        });
                    } catch (e: any) {
                        err.message = `error,Error parsing Product XML: ${e.message}`;
                    }
                } else {
                    errMessage =
                        "warning,Warning: Empty or invalid result when parsing Product XML.";
                }
                if (errMessage !== "" && BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(errMessage);
                }
            });
        }
        return data;
    }

    private getFakeOrderData(xml: string) {
        const options = {
            explicitArray: false,
            ignoreAttrs: true,
            valueProcessors: [processors.parseNumbers],
        };
        const fs = BrsDevice.fileSystem;
        const data: FlexObject = { id: xml };
        if (fs.existsSync(`pkg:/csfake/${xml}.xml`)) {
            const xmlData = fs.readFileSync(`pkg:/csfake/${xml}.xml`);
            parseString(xmlData, options, function (err: any, parsed: any) {
                let errMessage = "";
                if (err) {
                    errMessage = `error,Error parsing Order XML: ${err.message}`;
                } else if (parsed?.result?.order) {
                    try {
                        const order = JSON.parse(JSON.stringify(parsed.result.order));
                        data.id = order.id;
                        const orderArray = new Array<RoAssociativeArray>();
                        if (order.items.orderItem instanceof Array) {
                            order.items.orderItem.forEach((item: any) => {
                                orderArray.push(toAssociativeArray(item));
                            });
                        } else {
                            orderArray.push(toAssociativeArray(order.items.orderItem));
                        }
                        data.order = orderArray;
                    } catch (e: any) {
                        errMessage = `error,Error parsing Order XML: ${e.message}`;
                    }
                } else {
                    errMessage = "warning,Warning: Empty or invalid result when parsing Order XML.";
                }
                if (errMessage !== "" && BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(errMessage);
                }
            });
        }
        return data;
    }

    private isValidProductOrder(catalog: RoAssociativeArray[], item: RoAssociativeArray) {
        const qty = item.get(new BrsString("qty"));
        if (qty instanceof Int32 && qty.getValue() <= 0) {
            return false;
        }
        return (
            catalog.find((prod) => {
                const prodCode = prod.get(new BrsString("code"));
                const orderCode = item.get(new BrsString("code"));
                if (
                    prodCode instanceof BrsString &&
                    orderCode instanceof BrsString &&
                    prodCode.value === orderCode.value
                ) {
                    return true;
                }
                return false;
            }) !== undefined
        );
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
                let catalog: RoAssociativeArray[] = [];
                let status = { code: -4, message: "Empty List" };
                if (this.fakeServerEnabled) {
                    catalog = this.getFakeProductData("GetCatalog");
                    status = { code: 1, message: "Items Received" };
                }
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
                let catalog: RoAssociativeArray[] = [];
                let status = { code: -4, message: "Empty List" };
                if (this.fakeServerEnabled) {
                    catalog = this.getFakeProductData("GetCatalog");
                    status = { code: 1, message: "Items Received" };
                }
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
                let purchases: RoAssociativeArray[] = [];
                let status = { code: -4, message: "Empty List" };
                if (this.fakeServerEnabled) {
                    purchases = this.getFakeProductData("GetPurchases");
                    status = { code: 1, message: "Items Received" };
                }
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
                let purchases: RoAssociativeArray[] = [];
                let status = { code: -4, message: "Empty List" };
                if (this.fakeServerEnabled) {
                    purchases = this.getFakeProductData("GetPurchases");
                    status = { code: 1, message: "Items Received" };
                }
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
                this.order = order
                    .getElements()
                    .filter((item) => item instanceof RoAssociativeArray);
                if (this.order.length > 0 && orderInfo instanceof RoAssociativeArray) {
                    this.orderInfo = orderInfo;
                } else {
                    this.orderInfo = BrsInvalid.Instance;
                }
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
            this.order = [];
            this.orderInfo = BrsInvalid.Instance;
            return BrsInvalid.Instance;
        },
    });

    /** Applies a change in quantity to one item in the current Order (shopping cart). */
    private readonly deltaOrder = new Callable("deltaOrder", {
        signature: {
            args: [
                new StdlibArgument("code", ValueKind.String),
                new StdlibArgument("qty", ValueKind.Int32),
            ],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, code: BrsString, qty: Int32) => {
            const codeValue = code.value;
            const qtyValue = qty.getValue();
            let found = false;
            for (let item of this.order) {
                const code = item.get(new BrsString("code"));
                const qty = item.get(new BrsString("qty"));
                if (code instanceof BrsString && code.value === codeValue && qty instanceof Int32) {
                    item.set(new BrsString("qty"), new Int32(qty.getValue() + qtyValue));
                    found = true;
                    break;
                }
            }
            if (!found) {
                this.order.push(toAssociativeArray({ code: codeValue, qty: qtyValue }));
            }
            return new Int32(this.order.length);
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
            const status = { code: -3, message: "Invalid Order" };
            let order: RoAssociativeArray[] = [];
            if (!this.fakeServerEnabled || this.order.length === 0) {
                this.port.pushMessage(new RoChannelStoreEvent(this.id, order, status));
                return BrsBoolean.False;
            }
            status.code = 1;
            status.message = "Order Received";
            const catalog = this.getFakeProductData("GetCatalog");
            for (let item of this.order) {
                if (!this.isValidProductOrder(catalog, item)) {
                    status.code = -3;
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
                if (orderData.order instanceof Array) {
                    order = orderData.order.filter((item) => item instanceof RoAssociativeArray);
                }
            }
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
            return BrsInvalid.Instance;
        },
    });

    /** Retrieves the state, zip code, and country associated with the customer's Roku account. */
    private readonly getUserRegionData = new Callable("getUserRegionData", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return toAssociativeArray({ state: "", zip: "", country: "" });
        },
    });

    /** Provides a way to request user authorization to share his account information with the calling channel. */
    private readonly getPartialUserData = new Callable("getPartialUserData", {
        signature: {
            args: [new StdlibArgument("properties", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, properties: BrsString) => {
            return BrsInvalid.Instance;
        },
    });

    /** Stores an access token, oAuth token, or other authentication artifact that can be retrieved by calling the GetChannelCred method. */
    private readonly storeChannelCredData = new Callable("storeChannelCredData", {
        signature: {
            args: [new StdlibArgument("data", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, data: BrsString) => {
            this.credData = data.value;
            return toAssociativeArray({ status: 0 });
        },
    });

    /** Returns channel information from the Channel Store. */
    private readonly getChannelCred = new Callable("getChannelCred", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            let json = "";
            let status = 400;
            if (this.credData !== "") {
                json = `{channel_data="${this.credData}"}`;
                status = 0;
            }
            const app = BrsDevice.deviceInfo.appList?.find((app: AppData) => app.running);
            const channelCred = {
                channelId: app?.id ?? "dev",
                json: json,
                publisherDeviceId: BrsDevice.deviceInfo.clientId,
                status: status,
            };
            return toAssociativeArray(channelCred);
        },
    });

    /** Generates a signed JSON web token (JWT) in the Roku cloud and returns it to the app. */
    private readonly getDeviceAttestation = new Callable("getDeviceAttestation", {
        signature: {
            args: [new StdlibArgument("nonce", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, nonce: BrsString) => {
            // Sample JWT token from Roku documentation
            const sampleJwt = `eyJ4NXUiOiJodHRwczovL2V4YW1wbGUucm9rdS5jb20vc2FtcGxlY2VydCIsInR5cCI6IkpXVCIsImFsZyI6IlJTMjU2In0.\
eyJuYmYiOjE2NTYzNzQyNzQsIngtcm9rdS1hdHRlc3RhdGlvbi1kYXRhIjp7Im5vbmNlIjoiNUUwNjkyRTBBMzg5RjRGNiIsImNoYW5uZWxJZCI6Im\
RldiIsImRldmVsb3BlcklkIjoiY2FhNzNmYmI1ZTc1YTQ2YTRiNjExNGRlNTFhNWFkYTdkNjE2ZTJlZCIsInRpbWVzdGFtcE1zIjoxNjU2Mzc3ODcz\
OTkwfSwiaXNzIjoidXJuOnJva3U6Y2xvdWQtc2VydmljZXM6ZGV2aWNlLWF0dGVzdGF0aW9uIiwiZXhwIjoxNjU2NDY0Mjc0fQ.nywDvSUys27oeaQ\
Z3yXwNBfOnXbO-TUDuekOPZYjSssfZhNhWwRXvPLbJKHcNMR5Z0vFOQLVDFeqEVGauIMxMEke5UFLuCRxhr3ayBJJPt_BPfrEFbAvYjFEGdKkxJqYU\
huFE38R8lU2k7dhO0iFxDw1Qq7W4w8_7CjmDy4YFf7IfyhV7Vf2kGiOx5C94Niw5N2td3s21F3z77Rq_bofQ51DOKIwo_cDVuvPQnDyxG-CNEydZKC\
ZZwGPYCKEHMPrIOOXJ-S9ZjArgaEpBUpMXWJibFxnkpVUVzbC22GEaqz_SjOJXFMQU7TaCKkDeCYVKylgKwCvbvHRDlgogf7kq`;
            return new BrsString(sampleJwt);
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
            return toAssociativeArray({ errorCode: -1, errorMessage: "", status: "Failure" });
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
            return toAssociativeArray({ errorCode: -1, errorMessage: "", status: "Failure" });
        },
    });
}
