import { BrsInvalid, ValueKind } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { BrsComponent } from "../components/BrsComponent";
import { RoMessagePort } from "../components/RoMessagePort";

/**
 * BrightScript Interface ifSetMessagePort
 * https://developer.roku.com/docs/references/brightscript/interfaces/ifsetmessageport.md
 */
export class IfSetMessagePort {
    private readonly component: any;
    private readonly callback?: Function;

    constructor(value: BrsComponent, callback?: Function) {
        this.component = value;
        this.callback = callback;
    }

    /** Sets the roMessagePort to be used for all events from the component */
    private set(port: RoMessagePort) {
        port.addReference();
        this.component.port?.removeReference();
        if (this.callback) {
            const component = this.component.getComponentName();
            this.component.port?.unregisterCallback(component);
            port.registerCallback(component, this.callback);
        }
        this.component.port = port;
        return BrsInvalid.Instance;
    }

    readonly setMessagePort = new Callable("setMessagePort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_, port: RoMessagePort) => {
            return this.set(port);
        },
    });

    readonly setPort = new Callable("setPort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_, port: RoMessagePort) => {
            return this.set(port);
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
