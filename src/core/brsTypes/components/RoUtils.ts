import { BrsValue, ValueKind, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoArray, RoAssociativeArray, RoInvalid } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";

export class RoUtils extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;

    constructor() {
        super("roUtils");
        this.registerMethods({ ifUtils: [this.deepCopy, this.isSameObject] });
    }

    toString(parent?: BrsType): string {
        return "<Component: roUtils>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    // ifUtils ------------------------------------------------------------------------------------

    /** Performs a deep copy of an object. If the object contains items that are not copyable, they are skipped. */
    private readonly deepCopy = new Callable("deepCopy", {
        signature: {
            args: [new StdlibArgument("data", ValueKind.Object)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, data: BrsType) => {
            if (data instanceof RoArray || data instanceof RoAssociativeArray) {
                return data.deepCopy();
            }
            return new RoInvalid();
        },
    });

    /** Checks whether two BrightScript objects refer to the same instance and returns a flag indicating the result. */
    private readonly isSameObject = new Callable("isSameObject", {
        signature: {
            args: [new StdlibArgument("data1", ValueKind.Object), new StdlibArgument("data2", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, data1: BrsComponent, data2: BrsComponent) => {
            return BrsBoolean.from(data1 === data2);
        },
    });
}
