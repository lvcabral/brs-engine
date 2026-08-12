import { ValueKind, BrsString } from "..";
import { BrsEvent } from "./BrsEvent";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { AnimatedImageState } from "../components/RoAnimatedImage";

/**
 * Delivered through `roAnimatedImage`'s message port after `SetContent` finishes decoding.
 * PROVISIONAL: Roku's OS 15.3 release notes only confirm a "ready event" is fired
 * (`' ... wait for ready event ...'` in the documented example) without naming this event or its
 * methods — shaped after `RoTextureRequestEvent`, the closest existing async-load precedent, until
 * the official spec is available.
 */
export class RoAnimatedImageEvent extends BrsEvent {
    private readonly state: AnimatedImageState;
    private readonly uri: string;

    constructor(state: AnimatedImageState, uri: string) {
        super("roAnimatedImageEvent");
        this.state = state;
        this.uri = uri;

        this.registerMethods({
            ifAnimatedImageEvent: [this.getState, this.getURI],
        });
    }

    getValue() {
        return this.uri;
    }

    /** Returns the state of the content load (see `AnimatedImageState`). */
    private readonly getState = new Callable("getState", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.state);
        },
    });

    /** Returns the uri passed to SetContent. */
    private readonly getURI = new Callable("getURI", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.uri);
        },
    });
}
