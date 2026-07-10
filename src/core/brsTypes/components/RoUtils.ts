import { BrsValue, ValueKind, BrsBoolean, BrsString } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import {
    BrsType,
    BrsObjects,
    RoArray,
    RoAssociativeArray,
    RoInvalid,
    isAnyNumber,
    isBrsString,
    isBoxedNumber,
} from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { isSceneGraphNode } from "../../extensions";

export class RoUtils extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;

    constructor() {
        super("roUtils");
        this.registerMethods({
            ifUtils: [
                this.deepCopy,
                this.isSameObject,
                this.hasComponent,
                this.isNumber,
                this.isString,
                this.isFloatingPoint,
            ],
        });
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
            if (data instanceof RoArray || data instanceof RoAssociativeArray || isSceneGraphNode(data)) {
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

    /** Verifies whether a component name is already registered (creatable via CreateObject). */
    private readonly hasComponent = new Callable("hasComponent", {
        signature: {
            args: [new StdlibArgument("componentName", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, componentName: BrsString) => {
            return BrsBoolean.from(BrsObjects.has(componentName.value));
        },
    });

    /** Checks whether the given value is any kind of number, boxed or unboxed. */
    private readonly isNumber = new Callable("isNumber", {
        signature: {
            args: [new StdlibArgument("value", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, value: BrsType) => {
            return BrsBoolean.from(isAnyNumber(value));
        },
    });

    /** Checks whether the given value is a string, boxed or unboxed. */
    private readonly isString = new Callable("isString", {
        signature: {
            args: [new StdlibArgument("value", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, value: BrsType) => {
            return BrsBoolean.from(isBrsString(value));
        },
    });

    /** Checks whether the given value is a floating-point number (Float or Double), boxed or unboxed. */
    private readonly isFloatingPoint = new Callable("isFloatingPoint", {
        signature: {
            args: [new StdlibArgument("value", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, value: BrsType) => {
            const unboxed = isBoxedNumber(value) ? value.unbox() : value;
            return BrsBoolean.from(unboxed.kind === ValueKind.Float || unboxed.kind === ValueKind.Double);
        },
    });
}
