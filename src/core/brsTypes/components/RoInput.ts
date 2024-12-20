import { BrsValue, ValueKind, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoMessagePort } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";

export class RoInput extends BrsComponent implements BrsValue {
    private port?: RoMessagePort;
    readonly kind = ValueKind.Object;

    constructor() {
        super("roInput");
        this.registerMethods({
            ifInput: [
                this.enableTransportEvents,
                this.eventResponse,
                this.getMessagePort,
                this.setMessagePort,
            ],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roInput>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    dispose() {
        this.port?.removeReference();
    }

    // ifInput ------------------------------------------------------------------------------------

    /** Sets the current Order which must be an roList of roAssociativeArray items. */
    private readonly eventResponse = new Callable("eventResponse", {
        signature: {
            args: [new StdlibArgument("aa", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, aa: BrsComponent) => {
            // TODO: Generate the event
            return BrsBoolean.True;
        },
    });

    /** Registers an app to receive roInput events, which are voice commands sent via the Roku remote control. */
    private readonly enableTransportEvents = new Callable("enableTransportEvents", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.True;
        },
    });

    /** Returns the message port (if any) currently associated with the object */
    private readonly getMessagePort = new Callable("getMessagePort", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.port ?? BrsInvalid.Instance;
        },
    });

    /** Sets the roMessagePort to be used for all events from the screen */
    private readonly setMessagePort = new Callable("setMessagePort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, port: RoMessagePort) => {
            port.addReference();
            this.port?.removeReference();
            this.port = port;
            return BrsInvalid.Instance;
        },
    });
}
