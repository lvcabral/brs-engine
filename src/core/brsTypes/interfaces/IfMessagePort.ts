import { BrsComponent, BrsInvalid, BrsType, RoMessagePort, ValueKind } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { BrsDevice } from "../../device/BrsDevice";
import { getNow } from "../../common";
import { Interpreter } from "../../interpreter";

/**
 * BrightScript Interface ifSetMessagePort
 * https://developer.roku.com/docs/references/brightscript/interfaces/ifsetmessageport.md
 */
export class IfSetMessagePort {
    private readonly component: any;
    private readonly callback?: Function;
    private readonly key?: string;

    constructor(value: BrsComponent, callback?: Function, key?: string) {
        this.component = value;
        this.callback = callback;
        this.key = key;
    }

    /** Sets the roMessagePort to be used for all events from the component; a non-port value detaches it. */
    private set(interpreter: Interpreter, method: string, port: BrsType) {
        const component = this.component.getComponentName();
        const newPort = port instanceof RoMessagePort ? port : undefined;
        if (!newPort && BrsDevice.tracking) {
            const kind = port instanceof BrsComponent ? port.getComponentName() : ValueKind.toString(port.kind);
            BrsDevice.stderr.write(
                `warning,${getNow()} [msgport.set.bad] ${component}.${method}() given ${kind}, not a roMessagePort: ${interpreter.formatLocation()}`
            );
        }
        newPort?.addReference();
        this.component.port?.removeReference();
        if (this.callback) {
            this.component.port?.unregisterCallback(component, this.key);
            newPort?.registerCallback(component, this.callback, this.key);
        }
        this.component.port = newPort;
        return BrsInvalid.Instance;
    }

    readonly setMessagePort = new Callable("setMessagePort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, port: BrsType) => {
            return this.set(interpreter, "SetMessagePort", port);
        },
    });

    readonly setPort = new Callable("setPort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, port: BrsType) => {
            return this.set(interpreter, "SetPort", port);
        },
    });
}

/**
 * Interface IfGetMessagePort
 * https://developer.roku.com/docs/references/brightscript/interfaces/ifgetmessageport.md
 */
export class IfGetMessagePort {
    private readonly component: any;

    constructor(value: BrsComponent) {
        this.component = value;
    }

    /** Returns the message port (if any) currently associated with the object */
    readonly getMessagePort = new Callable("getMessagePort", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_) => {
            return this.component.port ?? BrsInvalid.Instance;
        },
    });

    /** Returns the message port (if any) currently associated with the object */
    readonly getPort = new Callable("getPort", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_) => {
            return this.component.port ?? BrsInvalid.Instance;
        },
    });
}
