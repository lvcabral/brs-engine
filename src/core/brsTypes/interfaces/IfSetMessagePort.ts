import { Interpreter } from "../../interpreter";
import { BrsInvalid, ValueKind } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";
import { BrsComponent } from "../components/BrsComponent";
import { RoMessagePort } from "../components/RoMessagePort";

export class IfSetMessagePort {
    private readonly component: any;
    private readonly callback?: Function;

    constructor(value: BrsComponent, callback?: Function) {
        this.component = value;
        this.callback = callback;
    }

    /** Sets the roMessagePort to be used for all events from the component */
    private set(port: RoMessagePort) {
        if (this.callback) {
            const component = this.component.getComponentName();
            this.component.port?.unregisterCallback(component);
            this.component.port = port;
            this.component.port.registerCallback(component, this.callback);
        } else {
            port.addReference();
            this.component.port?.removeReference();
            this.component.port = port;
        }
        return BrsInvalid.Instance;
    }

    readonly setMessagePort = new Callable("setMessagePort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, port: RoMessagePort) => {
            return this.set(port);
        },
    });

    readonly setPort = new Callable("setPort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, port: RoMessagePort) => {
            return this.set(port);
        },
    });
}
