import { BrsBoolean, BrsInvalid, ValueKind, BrsType, Int32, toIntegerArg } from "..";
import { BrsCollection, BrsComponent, BrsIterable } from "../components/BrsComponent";
import { BrsDevice } from "../../device/BrsDevice";
import { Interpreter } from "../../interpreter";
import { Callable, StdlibArgument } from "../Callable";
import { MemberStore } from "../Boxing";
import { RuntimeError, RuntimeErrorDetail } from "../../error/BrsError";

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
            return this.component.getValue().at(-1) ?? BrsInvalid.Instance;
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
                this.component.add(tvalue, true, "add");
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
                this.component.add(tvalue, false, "add");
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
                const noGap: BrsType[] = [];
                for (const element of array.getValue()) {
                    if (element) {
                        noGap.push(comp.addChildRef ? comp.addChildRef(element) : element);
                    }
                }
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
    private readonly component: BrsComponent & BrsCollection;

    constructor(component: BrsComponent & BrsCollection) {
        this.component = component;
    }

    readonly getEntry = new Callable("getEntry", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Dynamic)],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, index: BrsType) => {
            toIntegerArg(interpreter, index);
            return this.component.get(index);
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
            args: [new StdlibArgument("index", ValueKind.Dynamic), new StdlibArgument("tvalue", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, index: BrsType, tvalue: BrsType) => {
            if (isWritableIndex(interpreter, this.component, index)) {
                this.component.set(index, tvalue, false, "add");
            }
            return BrsInvalid.Instance;
        },
    });
}

/** The first index past the 32-bit `Integer` range; growing an array to it runs a device out of memory. */
const outOfMemoryIndex = 2 ** 31;

/**
 * Whether a write (`c[i] = v` or `SetEntry`) at `index` goes ahead, as on a Roku device. A negative index, or one at
 * or past the capacity of a non-resizable array, is ignored with a warning; an index past the 32-bit range is out of
 * memory.
 * @param interpreter the interpreter running the write.
 * @param component the array, list or byte array written to.
 * @param index the index argument.
 * @returns true if the write goes ahead.
 */
export function isWritableIndex(
    interpreter: Interpreter,
    component: BrsComponent & { readonly resizable: boolean; readonly maxSize: number },
    index: BrsType
): boolean {
    const idx = toIntegerArg(interpreter, index);
    if (idx >= outOfMemoryIndex) {
        interpreter.addError(
            new RuntimeError(RuntimeErrorDetail.OutOfMemory, interpreter.location, interpreter.getBacktrace())
        );
    }
    let reason: string;
    if (idx < 0) {
        reason = "invalid index";
    } else if (!component.resizable && idx >= component.maxSize) {
        reason = "index out of bounds on non-resizable array";
    } else {
        return true;
    }
    BrsDevice.stderr.write(
        `warning,BRIGHTSCRIPT: ERROR: ${component.getComponentName()}.SetEntry: set ignored for ${reason}: ${interpreter.formatLocation()}`
    );
    return false;
}

export interface BrsArray extends BrsIterable {
    readonly resizable: boolean;
    readonly maxSize: number;

    getValue(): BrsType[];

    add(value: BrsType, toTail: boolean, store?: MemberStore): void;

    remove(index: number): BrsType | undefined;

    clear(): void;

    updateNext(grow?: boolean, index?: number): void;

    tail(): number;

    addChildRef?: <T extends BrsType | undefined>(value: T, store?: MemberStore) => T;
}
