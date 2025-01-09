import { BrsInvalid, ValueKind } from "../BrsType";
import { Callable } from "../Callable";
import { BrsComponent } from "../components/BrsComponent";

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
