import { BrsBoolean, BrsInvalid, ValueKind, BrsType, Float, Int32 } from "..";
import { BrsComponent, BrsIterable } from "../components/BrsComponent";
import { BrsDevice } from "../../device/BrsDevice";
import { Interpreter } from "../../interpreter";
import { Callable, StdlibArgument } from "../Callable";

/**
 * BrightScript Interface ifArray
 * https://developer.roku.com/docs/references/brightscript/interfaces/ifarray.md
 */
export class IfArray {
    private readonly component: BrsComponent & BrsArray;
    private readonly name: string;

    constructor(component: BrsComponent & BrsArray) {
        this.component = component;
        this.name = component.getComponentName();
    }

    readonly peek = new Callable("peek", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            const elements = this.component.getElements();
            return elements[elements.length - 1] || BrsInvalid.Instance;
        },
    });

    readonly pop = new Callable("pop", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.component.remove(this.component.tail()) || BrsInvalid.Instance;
        },
    });

    readonly push = new Callable("push", {
        signature: {
            args: [new StdlibArgument("talue", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, tvalue: BrsType) => {
            const elements = this.component.getValue();
            if (this.component.resizable || elements.length < this.component.maxSize) {
                this.component.add(tvalue, true);
            } else {
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: ${
                        this.name
                    }.Push: set ignored for index out of bounds on non-resizable array: ${interpreter.formatLocation()}`
                );
            }
            return BrsInvalid.Instance;
        },
    });

    readonly shift = new Callable("shift", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.component.remove(0) || BrsInvalid.Instance;
        },
    });

    readonly unshift = new Callable("unshift", {
        signature: {
            args: [new StdlibArgument("tvalue", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, tvalue: BrsType) => {
            const elements = this.component.getValue();
            if (this.component.resizable || elements.length < this.component.maxSize) {
                this.component.add(tvalue, false);
            } else {
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: ${
                        this.name
                    }.Unshift: set ignored for index out of bounds on non-resizable array: ${interpreter.formatLocation()}`
                );
            }
            return BrsInvalid.Instance;
        },
    });

    readonly delete = new Callable("delete", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, index: Int32) => {
            if (index.lessThan(new Int32(0)).toBoolean()) {
                return BrsBoolean.False;
            }
            return this.component.remove(index.getValue()) ? BrsBoolean.True : BrsBoolean.False;
        },
    });

    readonly count = new Callable("count", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.component.getValue().length);
        },
    });

    readonly clear = new Callable("clear", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.component.clear();
            return BrsInvalid.Instance;
        },
    });

    readonly append = new Callable("append", {
        signature: {
            args: [new StdlibArgument("array", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, array: BrsComponent & BrsArray) => {
            if (this.name !== array.getComponentName()) {
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: ${
                        this.name
                    }.Append: invalid parameter type ${array.getComponentName()}: ${interpreter.formatLocation()}`
                );
                return BrsInvalid.Instance;
            }
            const comp = this.component;
            const elem = comp.getValue();
            if (comp.resizable || elem.length + array.getValue().length <= comp.maxSize) {
                // don't copy "holes" where no value exists
                const noGap = array.getValue().filter((element) => {
                    if (element) {
                        if (comp.addChildRef) {
                            comp.addChildRef(element);
                        }
                        return true;
                    }
                    return false;
                });
                elem.push(...noGap);
                this.component.updateNext(true, 0);
            }
            return BrsInvalid.Instance;
        },
    });
}

/**
 * Interface IfArrayGet
 * https://developer.roku.com/docs/references/brightscript/interfaces/ifarrayget.md
 */
export class IfArrayGet {
    readonly kind = ValueKind.Object;
    private readonly component: BrsComponent & BrsArray;

    constructor(component: BrsComponent & BrsArray) {
        this.component = component;
    }

    readonly getEntry = new Callable("getEntry", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Int32 | ValueKind.Float)],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter, index: Int32 | Float) => {
            return this.component.get(index) || BrsInvalid.Instance;
        },
    });
}

/**
 * Interface IfArraySet
 * https://developer.roku.com/docs/references/brightscript/interfaces/ifarrayset.md
 */
export class IfArraySet {
    readonly kind = ValueKind.Object;
    private readonly component: BrsComponent & BrsArray;

    constructor(component: BrsComponent & BrsArray) {
        this.component = component;
    }
    readonly setEntry = new Callable("setEntry", {
        signature: {
            args: [
                new StdlibArgument("index", ValueKind.Int32 | ValueKind.Float),
                new StdlibArgument("tvalue", ValueKind.Dynamic),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, index: Int32 | Float, tvalue: BrsType) => {
            return this.component.set(index, tvalue);
        },
    });
}

export interface BrsArray extends BrsIterable {
    readonly resizable: boolean;
    readonly maxSize: number;

    getValue(): BrsType[];

    add(value: BrsType, toTail: boolean): void;

    remove(index: number): BrsType | undefined;

    clear(): void;

    updateNext(grow?: boolean, index?: number): void;

    tail(): number;

    addChildRef?: (value: BrsType | undefined) => void;
}
