import { BrsValue, ValueKind, BrsBoolean, BrsString } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, Int32, isBrsString, RoArray, RoMessagePort } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";

export class RoNDK extends BrsComponent implements BrsValue {
    private port?: RoMessagePort;
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
     *  this implementation is based on some examples shared by Roku developers.
     */
    private readonly start = new Callable("start", {
        signature: {
            args: [
                new StdlibArgument("app", ValueKind.String),
                new StdlibArgument("params", ValueKind.Object),
            ],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, app: BrsString, params: RoArray) => {
            // Filter parameters that are strings
            const stringElements = params.elements.filter((el) => isBrsString(el));
            const csvString = stringElements.map((el) => el.toString()).join(",");
            postMessage(`ndk,${app.value},${csvString}`);
            return new Int32(0);
        },
    });
}
