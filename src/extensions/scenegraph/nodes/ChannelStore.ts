import {
    AAMember,
    BrsDevice,
    BrsInvalid,
    BrsString,
    BrsType,
    Int32,
    isAnyNumber,
    isBrsString,
    RoAssociativeArray,
    RoChannelStore,
} from "brs-engine";
import { Node } from "./Node";
import { ContentNode } from "./ContentNode";
import { jsValueOf, fromContentNode, toContentNode, toAssociativeArray } from "../factory/Serializer";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";

export class ChannelStore extends Node {
    readonly defaultFields: FieldModel[] = [
        { name: "command", type: "string" },
        { name: "requestedUserData", type: "string", value: "all" },
        { name: "requestedUserDataInfo", type: "node" },
        { name: "userData", type: "node", alwaysNotify: true },
        { name: "userRegionData", type: "node", alwaysNotify: true },
        { name: "order", type: "node" },
        { name: "deltaOrder", type: "assocarray" },
        { name: "requestPartnerOrder", type: "node" },
        { name: "confirmPartnerOrder", type: "node" },
        { name: "orderStatus", type: "node", alwaysNotify: true },
        { name: "purchases", type: "node", alwaysNotify: true },
        { name: "catalog", type: "node", alwaysNotify: true },
        { name: "storeCatalog", type: "node", alwaysNotify: true },
        { name: "requestPartnerOrderStatus", type: "node", alwaysNotify: true },
        { name: "confirmPartnerOrderStatus", type: "node", alwaysNotify: true },
        { name: "fakeServer", type: "boolean", value: "false" },
        { name: "nonce", type: "string" },
        { name: "deviceAttestationToken", type: "node", alwaysNotify: true },
        { name: "channelCredData", type: "string" },
        // The reference documents this one result as an roAssociativeArray while every other result
        // field on this node (`channelCred` included) is a ContentNode — keep that asymmetry.
        { name: "storeChannelCredDataStatus", type: "assocarray", alwaysNotify: true },
        { name: "channelCred", type: "node", alwaysNotify: true },
    ];

    /**
     * Backing store for every command. Deliberately thread-local: it is a plain property rather than
     * a field, so it never crosses a thread boundary — {@link handleCommand} re-derives the request
     * state it needs from this node's own fields instead of relying on state pushed into it.
     */
    private readonly channelStore: RoChannelStore;

    constructor(members: AAMember[] = [], readonly name: string = SGNodeType.ChannelStore) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Node);
        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);

        this.channelStore = new RoChannelStore();
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "deltaorder") {
            // Intercepted before `super`: unlike every other input this is an incremental mutation
            // of the order, not a snapshot of it.
            this.applyDeltaOrder(value);
        }
        super.setValue(index, value, alwaysNotify, kind);
        if (fieldName === "command" && isBrsString(value) && value.getValue() !== "") {
            this.handleCommand(value.getValue().toLowerCase());
        }
    }

    /**
     * Mirrors the `order` field's ContentNode tree into the backing store.
     *
     * The reference puts one child per line item on the order node, while the top node carries only
     * order-level metadata (`action` = "Upgrade"/"Downgrade", which maps to the component's
     * `orderInfo`). A childless node is still accepted as a single-item order — that is a legitimate
     * shape and the one this node used to convert. Setting the field to `invalid` clears the order.
     * @param value The new value of the `order` field.
     */
    private syncOrderFromNode(value: BrsType) {
        if (!(value instanceof ContentNode)) {
            this.channelStore.setNewOrder([], BrsInvalid.Instance);
            return;
        }
        const items: RoAssociativeArray[] = [];
        for (const child of value.getNodeChildren()) {
            if (child instanceof ContentNode) {
                items.push(fromContentNode(child));
            }
        }
        const top = fromContentNode(value);
        if (items.length === 0 && ChannelStore.stringField(top, "code") !== "") {
            items.push(top);
        }
        const hasAction = ChannelStore.stringField(top, "action") !== "";
        this.channelStore.setNewOrder(items, hasAction ? top : BrsInvalid.Instance);
    }

    /**
     * Applies a `deltaOrder` write, then publishes the changed line item back to the `order` field.
     *
     * The reference documents the associative array as `{ code, qty }`; `delta` is tolerated as a
     * legacy spelling of the product code. A negative quantity reduces the item and removes it at 0.
     * @param value The new value of the `deltaOrder` field.
     */
    private applyDeltaOrder(value: BrsType) {
        if (!(value instanceof RoAssociativeArray)) {
            return;
        }
        let code = ChannelStore.stringField(value, "code");
        if (code === "") {
            code = ChannelStore.stringField(value, "delta");
        }
        const qty = value.get(new BrsString("qty"));
        if (code === "" || !isAnyNumber(qty)) {
            return;
        }
        this.syncOrderFromNode(this.getValue("order"));
        this.publishDeltaItem(code, this.channelStore.setDeltaOrder(code, jsValueOf(qty)));
    }

    /**
     * Applies one line-item change to the `order` field, so an order assembled incrementally through
     * `deltaOrder` reads back as the reference describes: a top node with one child per line item.
     *
     * Touches only the item that changed, rather than rebuilding the whole list. Rebuilding would
     * discard the top node the app holds a reference to (along with its order-level `action`), and
     * would fire one observer notification per surviving item — quadratic in the number of writes it
     * takes to fill a cart. One write means one notification, which is what "each time this field is
     * set, the order field is modified" describes.
     * @param code Product identifier of the changed line item.
     * @param quantity Its remaining quantity; 0 means it is no longer in the order.
     */
    private publishDeltaItem(code: string, quantity: number) {
        const current = this.getValue("order");
        const order = current instanceof ContentNode ? current : new ContentNode();
        const children = order.getNodeChildren();
        const existing = children.find(
            (child): child is ContentNode =>
                child instanceof ContentNode && ChannelStore.textOf(child.getValue("code")) === code
        );
        if (quantity <= 0) {
            // Also the "non-positive delta on an item that was never in the cart" case, hence the guard.
            if (existing) {
                order.removeChildrenAtIndex(children.indexOf(existing), 1);
            }
        } else if (existing) {
            existing.setValue("qty", new Int32(quantity));
        } else {
            order.appendChildToParent(toContentNode(toAssociativeArray({ code: code, qty: quantity })));
        }
        if (current !== order) {
            this.setValueSilent("order", order);
        }
    }

    /** Reads a string entry off an associative array, returning "" when absent or not a string. */
    private static stringField(source: RoAssociativeArray, name: string): string {
        return ChannelStore.textOf(source.get(new BrsString(name)));
    }

    /** Reads a BrightScript value as trimmed text, returning "" when it is not a string. */
    private static textOf(value: BrsType): string {
        return isBrsString(value) ? value.getValue().trim() : "";
    }

    private handleCommand(command: string) {
        // The backing store holds no authoritative state of its own: every command derives what it
        // needs from this node's own fields. That matters because `setValueSilent` writes a field
        // WITHOUT going through setValue() above — a cross-thread copy (Serializer's
        // `toSGNode`/`updateSGNode`), a Task read-reply, an XML `<interface>` default and
        // `appendNodeFields` all take that path, so anything pushed from setValue() may be stale.
        this.channelStore.setFakeServer(this.getValueJS("fakeServer") === true);

        switch (command) {
            case "getuserdata":
                this.setUserData();
                break;
            case "getuserregiondata": {
                const region = this.channelStore.getRegionData();
                super.setValue("userRegionData", region ? toContentNode(region) : BrsInvalid.Instance);
                break;
            }
            case "getcatalog":
            case "getstorecatalog":
                this.setStoreData("GetCatalog", command === "getcatalog" ? "catalog" : "storeCatalog");
                break;
            case "getpurchases":
            case "getallpurchases":
                this.setStoreData("GetPurchases", "purchases");
                break;
            case "doorder":
                // The only command that reads the order, so it is the only one that has to re-derive
                // it from the field (see the note above on `setValueSilent`).
                this.syncOrderFromNode(this.getValue("order"));
                this.doOrder();
                break;
            case "getdeviceattestationtoken": {
                const result = new ContentNode();
                result.setValueSilent("status", new Int32(1));
                result.setValueSilent("nonce", this.getValue("nonce"));
                result.setValueSilent("token", this.channelStore.getAttestationToken());
                super.setValue("deviceAttestationToken", result);
                break;
            }
            case "storechannelcreddata": {
                const data = (this.getValueJS("channelCredData") as string) ?? "";
                super.setValue("storeChannelCredDataStatus", this.channelStore.storeCredData(data));
                break;
            }
            case "getchannelcred": {
                super.setValue("channelCred", toContentNode(this.channelStore.getChannelCredData()));
                break;
            }
            case "requestpartnerorder":
                this.setPartnerOrderStatus("requestPartnerOrder");
                break;
            case "confirmpartnerorder":
                this.setPartnerOrderStatus("confirmPartnerOrder");
                break;
            default:
                BrsDevice.stderr.write(`warning,[ChannelStore] Invalid or unhandled 'command': ${command}`);
                break;
        }
    }

    /**
     * Runs one of the two partner-order (transactional purchase) commands and publishes its payload to
     * the matching status field.
     * @param command The request field to read; its result field is that name plus "Status".
     */
    private setPartnerOrderStatus(command: "requestPartnerOrder" | "confirmPartnerOrder") {
        const request = this.getValue(command);
        const orderInfo = request instanceof ContentNode ? fromContentNode(request) : BrsInvalid.Instance;
        const productId = orderInfo instanceof RoAssociativeArray ? ChannelStore.stringField(orderInfo, "code") : "";
        const payload =
            command === "requestPartnerOrder"
                ? this.channelStore.requestPartnerOrderData(orderInfo, productId)
                : this.channelStore.confirmPartnerOrderData(orderInfo, productId);
        const status = new ContentNode();
        for (const [key, value] of Object.entries(payload)) {
            // `ifChannelStore` names the order id `id`; this node names the same value `orderId`.
            status.setValueSilent(key === "id" ? "orderId" : key, new BrsString(value));
        }
        super.setValue(`${command}Status`, status);
    }

    private setStoreData(command: string, field: string) {
        const result = new ContentNode();
        const status = { code: -4, message: "Empty List" };
        const catalog = this.channelStore.getProductData(command, status);
        result.setValueSilent("status", new Int32(status.code));
        result.setValueSilent("message", new BrsString(status.message));
        for (const item of catalog) {
            result.appendChildToParent(toContentNode(item));
        }
        super.setValue(field, result);
    }

    /**
     * Runs `getUserData` and publishes the result.
     *
     * Honors both documented inputs: `requestedUserData` selects which account attributes come back,
     * and `requestedUserDataInfo.context` distinguishes a sign-up request from a sign-in one (which
     * only ever returns email/phone). Its `forceShowData` sibling is intentionally inert — it only
     * affects how the on-device Request For Information screen is drawn.
     */
    private setUserData() {
        // Both inputs are app-set fields that may hold any type, so read them as text.
        const requested = ChannelStore.textOf(this.getValue("requestedUserData")) || "all";
        const info = this.getValue("requestedUserDataInfo");
        const context = info instanceof Node ? ChannelStore.textOf(info.getValue("context")) : "";
        const data = this.channelStore.getUserAccountData(requested, context || "signup");
        super.setValue("userData", data ? toContentNode(data) : BrsInvalid.Instance);
    }

    private doOrder() {
        const result = new ContentNode();
        const status = { code: -3, message: "Invalid Order" };
        const order = this.channelStore.placeOrder(status);
        result.setValueSilent("status", new Int32(status.code));
        result.setValueSilent("message", new BrsString(status.message));
        for (const item of order) {
            result.appendChildToParent(toContentNode(item));
        }
        super.setValue("orderStatus", result);
    }
}
