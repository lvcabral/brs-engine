import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoList, RoArray, RoMessagePort } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { RoChannelStoreEvent } from "./RoChannelStoreEvent";
import { RoAssociativeArray, AAMember } from "./RoAssociativeArray";

export class RoChannelStore extends BrsComponent implements BrsValue {
    private id: number;
    private order: BrsType[];
    private credData: string;
    private port?: RoMessagePort;
    readonly kind = ValueKind.Object;

    constructor() {
        super("roChannelStore");
        this.id = Math.floor(Math.random() * 100) + 1;
        this.order = [];
        this.credData = "";
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
                this.requestPartnerOrder,
                this.confirmPartnerOrder,
            ],
            ifSetMessagePort: [this.setMessagePort],
            ifGetMessagePort: [this.getMessagePort],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roChannelStore>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    // ifChannelStore ------------------------------------------------------------------------------------

    /** Returns a unique number that can be used to identify whether a roChannelStoreEvent originated from this object. */
    private getIdentity = new Callable("getIdentity", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.id);
        },
    });

    /** Requests the list of In-Channel products which are linked to the running channel. */
    private getCatalog = new Callable("getCatalog", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            if (this.port) {
                this.port.pushMessage(new RoChannelStoreEvent(this.id, []));
            }
            return BrsInvalid.Instance;
        },
    });

    /** Requests the list of globally available In-Channel products, which are available to all channels. */
    private getStoreCatalog = new Callable("getStoreCatalog", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            if (this.port) {
                this.port.pushMessage(new RoChannelStoreEvent(this.id, []));
            }
            return BrsInvalid.Instance;
        },
    });

    /** Requests the list of active purchases associated with the current user account. */
    private getPurchases = new Callable("getPurchases", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            if (this.port) {
                this.port.pushMessage(new RoChannelStoreEvent(this.id, []));
            }
            return BrsInvalid.Instance;
        },
    });

    /** Requests the list of all purchases associated with the current user account, including expired. */
    private getAllPurchases = new Callable("getAllPurchases", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            if (this.port) {
                this.port.pushMessage(new RoChannelStoreEvent(this.id, []));
            }
            return BrsInvalid.Instance;
        },
    });

    /** Sets the current Order which must be an roList of roAssociativeArray items. */
    private setOrder = new Callable("setOrder", {
        signature: {
            args: [new StdlibArgument("order", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, order: BrsComponent) => {
            if (order instanceof RoList || order instanceof RoArray) {
                this.order = order.getElements();
            }
            return BrsInvalid.Instance;
        },
    });

    /** Clears the current Order (shopping cart). After this call, the Order is empty. */
    private clearOrder = new Callable("clearOrder", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.order = [];
            return BrsInvalid.Instance;
        },
    });

    /** Applies a change in quantity to one item in the current Order (shopping cart). */
    private deltaOrder = new Callable("deltaOrder", {
        signature: {
            args: [
                new StdlibArgument("code", ValueKind.String),
                new StdlibArgument("qty", ValueKind.Int32),
            ],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, code: BrsString, qty: Int32) => {
            // TODO: Change order quantities
            return new Int32(this.order.length);
        },
    });

    /** Retrieves the current Order (shopping cart). */
    private getOrder = new Callable("getOrder", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return new RoList(this.order);
        },
    });

    /** If the user approves the order, this function returns true, otherwise it returns false */
    private doOrder = new Callable("doOrder", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            // TODO: when there is a Catalog list this should return `true`
            // when the order list contain valid product, and added to Purchased list.
            return BrsBoolean.False;
        },
    });

    /** This test mode short circuits communication to the Roku Channel store. */
    private fakeServer = new Callable("fakeServer", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            return BrsInvalid.Instance;
        },
    });

    /** Provides a way to request user authorization to share his account information with the calling channel. */
    private getUserData = new Callable("getUserData", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return BrsInvalid.Instance;
        },
    });

    /** Retrieves the state, zip code, and country associated with the customer's Roku account. */
    private getUserRegionData = new Callable("getUserRegionData", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            let result = new Array<AAMember>();
            result.push({ name: new BrsString("state"), value: new BrsString("") });
            result.push({ name: new BrsString("zip"), value: new BrsString("") });
            result.push({ name: new BrsString("country"), value: new BrsString("") });
            return new RoAssociativeArray(result);
        },
    });

    /** Provides a way to request user authorization to share his account information with the calling channel. */
    private getPartialUserData = new Callable("getPartialUserData", {
        signature: {
            args: [new StdlibArgument("properties", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, properties: BrsString) => {
            return BrsInvalid.Instance;
        },
    });

    /** Stores an access token, oAuth token, or other authentication artifact that can be retrieved by calling the GetChannelCred method. */
    private storeChannelCredData = new Callable("storeChannelCredData", {
        signature: {
            args: [new StdlibArgument("data", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, data: BrsString) => {
            this.credData = data.value;
            let result = new Array<AAMember>();
            result.push({ name: new BrsString("status"), value: new Int32(0) });
            return new RoAssociativeArray(result);
        },
    });

    /** Returns channel information from the Channel Store. */
    private getChannelCred = new Callable("getChannelCred", {
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
            let clientId = interpreter.deviceInfo.get("clientId");
            let result = new Array<AAMember>();
            result.push({ name: new BrsString("channelId"), value: new BrsString("dev") });
            result.push({ name: new BrsString("json"), value: new BrsString(json) });
            result.push({
                name: new BrsString("publisherDeviceId"),
                value: new BrsString(clientId),
            });
            result.push({ name: new BrsString("status"), value: new Int32(status) });
            return new RoAssociativeArray(result);
        },
    });

    /** Checks the user's billing status and is a prerequisite for ConfirmPartnerOrder() when doing transactional purchases. */
    private requestPartnerOrder = new Callable("requestPartnerOrder", {
        signature: {
            args: [
                new StdlibArgument("orderInfo", ValueKind.Object),
                new StdlibArgument("productId", ValueKind.String),
            ],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, orderInfo: RoAssociativeArray, productId: BrsString) => {
            let result = new Array<AAMember>();
            result.push({ name: new BrsString("errorCode"), value: new BrsString("-1") });
            result.push({ name: new BrsString("errorMessage"), value: new BrsString("") });
            result.push({ name: new BrsString("status"), value: new BrsString("Failure") });
            return new RoAssociativeArray(result);
        },
    });

    /** This function is equivalent to doOrder() for transactional purchases. */
    private confirmPartnerOrder = new Callable("confirmPartnerOrder", {
        signature: {
            args: [
                new StdlibArgument("confirmOrderInfo", ValueKind.Object),
                new StdlibArgument("productId", ValueKind.String),
            ],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, confirmOrderInfo: RoAssociativeArray, productId: BrsString) => {
            let result = new Array<AAMember>();
            result.push({ name: new BrsString("errorCode"), value: new BrsString("-1") });
            result.push({ name: new BrsString("errorMessage"), value: new BrsString("") });
            result.push({ name: new BrsString("status"), value: new BrsString("Failure") });
            return new RoAssociativeArray(result);
        },
    });

    // ifGetMessagePort ----------------------------------------------------------------------------------

    /** Returns the message port (if any) currently associated with the object */
    private getMessagePort = new Callable("getMessagePort", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.port ?? BrsInvalid.Instance;
        },
    });

    // ifSetMessagePort ----------------------------------------------------------------------------------

    /** Sets the roMessagePort to be used for all events from the screen */
    private setMessagePort = new Callable("setMessagePort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, port: RoMessagePort) => {
            this.port = port;
            return BrsInvalid.Instance;
        },
    });
}
