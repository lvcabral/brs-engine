import { BrsValue, ValueKind, BrsBoolean, BrsString } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, Int32, isBrsString, RoArray } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";

export class RoNDK extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;

    constructor() {
        super("roNDK");
        this.registerMethods({
            ifNDK: [this.start],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roNDK>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    // ifNDK ------------------------------------------------------------------------------------

    /** Starts a NDK application. There is no public documentation for this component
     *  this implementation is based on some examples found on the internet.
     */
    private readonly start = new Callable("start", {
        signature: {
            args: [
                new StdlibArgument("app", ValueKind.String),
                new StdlibArgument("params", ValueKind.Object, new RoArray([])),
                new StdlibArgument("env", ValueKind.Object, new RoArray([])),
            ],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, app: BrsString, params: RoArray, _env: RoArray) => {
            const stringParams = params.elements.filter((el) => isBrsString(el));
            const csvParams = stringParams.map((el) => el.toString()).join(",");
            postMessage(`ndk,${app.value},${csvParams}`);
            return new Int32(0);
        },
    });
}
