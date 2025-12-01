import { ValueKind, BrsString, BrsInvalid, RoBitmap, RoTextureRequest } from "..";
import { BrsEvent } from "./BrsEvent";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";

export class RoTextureRequestEvent extends BrsEvent {
    private readonly id: number;
    private readonly state: number;
    private readonly uri: string;
    private readonly bmp: RoBitmap | BrsInvalid;

    constructor(req: RoTextureRequest, bmp: RoBitmap | BrsInvalid) {
        super("roTextureRequestEvent");
        this.id = req.identity;
        this.state = req.state;
        this.uri = req.uri;
        this.bmp = bmp;

        this.registerMethods({
            ifTextureRequestEvent: [this.getId, this.getState, this.getURI, this.getBitmap],
        });
    }

    getValue() {
        return this.uri;
    }

    /** Returns a unique id for the request. */
    private readonly getId = new Callable("getId", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.id);
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

    /** Returns the state of the request. */
    private readonly getURI = new Callable("getURI", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.uri);
        },
    });

    /** Returns an roBitmap from the request if the state is ready. */
    private readonly getBitmap = new Callable("getBitmap", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.bmp;
        },
    });
}
