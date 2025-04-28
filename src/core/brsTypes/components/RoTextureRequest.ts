import {
    Callable,
    ValueKind,
    BrsString,
    StdlibArgument,
    BrsBoolean,
    BrsType,
    BrsComponent,
    BrsValue,
    Int32,
    Uninitialized,
} from "..";
import { Interpreter } from "../../interpreter";
import { BrsHttpAgent, IfHttpAgent } from "../interfaces/IfHttpAgent";

export enum RequestState {
    Requested = 0,
    Downloading = 1,
    Downloaded = 2,
    Ready = 3,
    Failed = 4,
    Cancelled = 5,
}

let nextIdentity = 1;

export class RoTextureRequest extends BrsComponent implements BrsValue, BrsHttpAgent {
    readonly kind = ValueKind.Object;
    readonly identity: number;
    readonly customHeaders: Map<string, string>;
    uri: string;
    async: boolean;
    state: RequestState;
    scaleMode: number;
    cookiesEnabled: boolean;
    size?: { width: number; height: number };

    constructor(uri: BrsString) {
        super("roTextureRequest");
        this.identity = nextIdentity++;
        this.uri = uri.value;
        this.async = true;
        this.state = RequestState.Requested;
        this.scaleMode = 0;
        this.cookiesEnabled = false;
        this.customHeaders = new Map<string, string>();
        const ifHttpAgent = new IfHttpAgent(this);
        this.registerMethods({
            ifTextureRequest: [this.getId, this.getState, this.setAsync, this.setSize, this.setScaleMode],
            ifHttpAgent: [
                ifHttpAgent.addHeader,
                ifHttpAgent.setHeaders,
                ifHttpAgent.initClientCertificates,
                ifHttpAgent.setCertificatesFile,
                ifHttpAgent.setCertificatesDepth,
                ifHttpAgent.enableCookies,
                ifHttpAgent.getCookies,
                ifHttpAgent.addCookies,
                ifHttpAgent.clearCookies,
            ],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roTextureRequest>";
    }

    equalTo(other: BrsType): BrsBoolean {
        return BrsBoolean.False;
    }

    /** Returns a unique id for the request. */
    private readonly getId = new Callable("getId", {
        signature: { args: [], returns: ValueKind.Int32 },
        impl: (_: Interpreter) => {
            return new Int32(this.identity);
        },
    });

    /** Returns the state of the request. */
    private readonly getState = new Callable("getState", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.state);
        },
    });

    /** Sets the request to be either asynchronous (true) or synchronous (false). */
    private readonly setAsync = new Callable("setAsync", {
        signature: {
            args: [new StdlibArgument("async", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, async: BrsBoolean) => {
            this.async = async.toBoolean();
            return Uninitialized.Instance;
        },
    });

    /** Sets the desired size of the roBitmap. */
    private readonly setSize = new Callable("setSize", {
        signature: {
            args: [new StdlibArgument("width", ValueKind.Int32), new StdlibArgument("height", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, width: Int32, height: Int32) => {
            this.size = { width: width.getValue(), height: height.getValue() };
            return Uninitialized.Instance;
        },
    });

    /** Sets the scaling mode to be used. */
    private readonly setScaleMode = new Callable("setScaleMode", {
        signature: {
            args: [new StdlibArgument("mode", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, mode: Int32) => {
            this.scaleMode = mode.getValue() ? 1 : 0;
            return Uninitialized.Instance;
        },
    });
}
