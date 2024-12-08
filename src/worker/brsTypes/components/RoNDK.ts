import { BrsValue, ValueKind, BrsBoolean, BrsString } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, Int32, isBrsString, RoArray } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { NDKStart } from "../../common";

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
        impl: (_: Interpreter, app: BrsString, params: RoArray, env: RoArray) => {
            const stringParams = params.elements.filter((el) => isBrsString(el));
            const stringEnv = env.elements.filter((el) => isBrsString(el));
            if (app.value === "roku_browser" || app.value === "SDKLauncher") {
                const ndkStart: NDKStart = {
                    app: app.value,
                    params: stringParams.map((el) => el.toString()),
                    env: stringEnv.map((el) => el.toString()),
                };
                ndkStart.params.push("source=other-channel");
                postMessage(ndkStart);
                return new Int32(0);
            }
            return new Int32(211);
        },
    });
}
