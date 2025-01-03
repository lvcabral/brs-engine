import { BrsValue, ValueKind, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsEvent, BrsType, RoInputEvent, RoMessagePort, toAssociativeArray } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { BufferType, DataType } from "../../common";

export class RoInput extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly interpreter: Interpreter;
    private port?: RoMessagePort;

    constructor(interpreter: Interpreter) {
        super("roInput");
        this.interpreter = interpreter;
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
        this.port?.unregisterCallback(this.getComponentName());
    }

    // Input Event -------------------------------------------------------------------------------

    private getNewEvents() {
        const events: BrsEvent[] = [];
        const bufferFlag = Atomics.load(this.interpreter.sharedArray, DataType.BUF);
        if (bufferFlag === BufferType.INPUT) {
            const strInput = this.interpreter.readDataBuffer();
            try {
                const input = JSON.parse(strInput);
                events.push(new RoInputEvent(toAssociativeArray(input)));
            } catch (e: any) {
                if (this.interpreter.isDevMode) {
                    this.interpreter.stdout.write(
                        `warning,[roSystemLog] Error parsing Input buffer: ${e.message}`
                    );
                }
            }
        }
        return events;
    }

    // ifInput ------------------------------------------------------------------------------------

    /** Registers an app to receive roInput events, which are voice commands sent via the Roku remote control. */
    private readonly enableTransportEvents = new Callable("enableTransportEvents", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            // Voice commands are not supported
            return BrsBoolean.False;
        },
    });

    /** Marks a transport command as handled, unhandled, or handled with an error. */
    private readonly eventResponse = new Callable("eventResponse", {
        signature: {
            args: [new StdlibArgument("aa", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, aa: BrsComponent) => {
            // Voice commands are not supported
            return BrsBoolean.False;
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
            const component = port.getComponentName();
            this.port?.unregisterCallback(component);
            this.port = port;
            this.port.registerCallback(component, this.getNewEvents.bind(this));
            return BrsInvalid.Instance;
        },
    });
}
