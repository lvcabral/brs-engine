import {
    AAMember,
    BrsInvalid,
    BrsString,
    BrsType,
    ContentNode,
    fromContentNode,
    Int32,
    isBrsBoolean,
    isBrsNumber,
    isBrsString,
    jsValueOf,
    Node,
    RoAssociativeArray,
    RoChannelStore,
    toContentNode,
} from "..";
import { FieldKind, FieldModel } from "./Field";
import { BrsDevice } from "../../device/BrsDevice";

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
    ];

    private readonly channelStore: RoChannelStore;

    constructor(members: AAMember[] = [], readonly name: string = "ChannelStore") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);

        this.channelStore = new RoChannelStore();
    }

    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "order") {
            const order: RoAssociativeArray[] = [];
            if (value instanceof ContentNode) {
                order.push(fromContentNode(value));
            }
            this.channelStore.setNewOrder(order);
        } else if (fieldName === "deltaorder") {
            if (value instanceof RoAssociativeArray) {
                const delta = value.get(new BrsString("delta"));
                const qty = value.get(new BrsString("qty"));
                if (isBrsString(delta) && isBrsNumber(qty)) {
                    this.channelStore.setDeltaOrder(delta.getValue(), jsValueOf(qty));
                }
            }
        } else if (fieldName === "fakeServer".toLowerCase() && isBrsBoolean(value)) {
            this.channelStore.setFakeServer(value.toBoolean());
        }
        super.setValue(index, value, alwaysNotify, kind);
        if (fieldName === "command" && isBrsString(value) && value.getValue() !== "") {
            this.handleCommand(value.getValue().toLowerCase());
        }
    }

    private handleCommand(command: string) {
        switch (command) {
            case "getuserdata":
            case "getuserregiondata":
                this.setUserData(command, command === "getuserdata" ? "userData" : "userRegionData");
                break;
            case "getcatalog":
            case "getstorecatalog":
                this.setStoreData("GetCatalog", command === "getcatalog" ? "catalog" : "storeCatalog");
                break;
            case "getpurchases":
            case "getallpurchases":
                this.setStoreData("GetPurchases", "purchases");
                break;
            case "doorder":
                this.doOrder();
                break;
            case "getdeviceattestationtoken": {
                const result = new ContentNode();
                result.setFieldValue("status", new Int32(1));
                result.setFieldValue("nonce", this.getFieldValue("nonce"));
                result.setFieldValue("token", this.channelStore.getAttestationToken());
                super.setValue("deviceAttestationToken", result);
                break;
            }
            default:
                BrsDevice.stderr.write(`warning,[ChannelStore] Invalid or unhandled 'command': ${command}`);
                break;
        }
    }

    private setStoreData(command: string, field: string) {
        const result = new ContentNode();
        const status = { code: -4, message: "Empty List" };
        const catalog = this.channelStore.getProductData(command, status);
        result.setFieldValue("status", new Int32(status.code));
        result.setFieldValue("message", new BrsString(status.message));
        for (const item of catalog) {
            result.appendChildToParent(toContentNode(item));
        }
        super.setValue(field, result);
    }

    private setUserData(command: string, field: string) {
        const result = new ContentNode();
        const fakeServer = this.getFieldValueJS("fakeServer") as boolean;
        if (!fakeServer) {
            super.setValue(field, BrsInvalid.Instance);
            return;
        }
        if (command === "getuserdata") {
            result.setFieldValue("email", new BrsString("johm.doe@email.com"));
            result.setFieldValue("firstName", new BrsString("John"));
            result.setFieldValue("lastName", new BrsString("Doe"));
            result.setFieldValue("gender", new BrsString("Male"));
            result.setFieldValue("birth", new BrsString("1970-01"));
            result.setFieldValue("phone", BrsInvalid.Instance);
        } else if (fakeServer && command === "getuserregiondata") {
            result.setFieldValue("state", new BrsString("CA"));
            result.setFieldValue("zip", new BrsString("90210"));
            result.setFieldValue("country", new BrsString("USA"));
        }
        super.setValue(field, result);
    }

    private doOrder() {
        const result = new ContentNode();
        const status = { code: -3, message: "Invalid Order" };
        const order = this.channelStore.placeOrder(status);
        result.setFieldValue("status", new Int32(status.code));
        result.setFieldValue("message", new BrsString(status.message));
        for (const item of order) {
            result.appendChildToParent(toContentNode(item));
        }
        super.setValue("orderStatus", result);
    }
}
