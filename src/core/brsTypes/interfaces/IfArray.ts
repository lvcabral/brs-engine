import { BrsComponent, BrsIterable, BrsType, Float, Int32, RoList } from "..";
import { Interpreter } from "../../interpreter";
import { BrsBoolean, BrsInvalid, ValueKind } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";

export class IfArray {
    private readonly component: BrsComponent & BrsArray;

    constructor(component: BrsComponent & BrsArray) {
        this.component = component;
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
            if (this.component instanceof RoList) {
                return this.component.remove(this.component.tail()) || BrsInvalid.Instance;
            }
            const elements = this.component.getValue();
            const removed = elements.pop();
            if (this.component.removeChildRef) {
                this.component.removeChildRef(removed);
            }
            this.component.updateNext();
            return removed || BrsInvalid.Instance;
        },
    });

    readonly push = new Callable("push", {
        signature: {
            args: [new StdlibArgument("talue", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, tvalue: BrsType) => {
            if (this.component instanceof RoList) {
                this.component.add(tvalue, true);
                return BrsInvalid.Instance;
            }
            const elements = this.component.getValue();
            if (this.component.resizable || elements.length < this.component.maxSize) {
                if (this.component.addChildRef) {
                    this.component.addChildRef(tvalue);
                }
                elements.push(tvalue);
                this.component.updateNext(true);
            } else {
                interpreter.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: ${this.component.getComponentName()}.Push: set ignored for index out of bounds on non-resizable array: ${interpreter.formatLocation()}`
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
            if (this.component instanceof RoList) {
                return this.component.remove(0) || BrsInvalid.Instance;
            }
            const elements = this.component.getValue();
            const removed = elements.shift();
            if (this.component.removeChildRef) {
                this.component.removeChildRef(removed);
            }
            this.component.updateNext();
            return removed || BrsInvalid.Instance;
        },
    });

    readonly unshift = new Callable("unshift", {
        signature: {
            args: [new StdlibArgument("tvalue", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, tvalue: BrsType) => {
            if (this.component instanceof RoList) {
                this.component.add(tvalue, false);
                return BrsInvalid.Instance;
            }
            const elements = this.component.getValue();
            if (this.component.resizable || elements.length < this.component.maxSize) {
                if (this.component.addChildRef) {
                    this.component.addChildRef(tvalue);
                }
                elements.unshift(tvalue);
                this.component.updateNext(true);
            } else {
                interpreter.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: ${this.component.getComponentName()}.Unshift: set ignored for index out of bounds on non-resizable array: ${interpreter.formatLocation()}`
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
            const elements = this.component.getValue();
            if (index.lessThan(new Int32(0)).toBoolean()) {
                return BrsBoolean.False;
            }
            if (this.component instanceof RoList) {
                return this.component.remove(index.getValue()) ? BrsBoolean.True : BrsBoolean.False;
            }
            const deleted = elements.splice(index.getValue(), 1);
            deleted.forEach((element) => {
                if (this.component.removeChildRef) {
                    this.component.removeChildRef(element);
                }
            });
            this.component.updateNext();
            return BrsBoolean.from(deleted.length > 0);
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
            if (this.component instanceof RoList) {
                this.component.clear();
                return BrsInvalid.Instance;
            }
            const elements = this.component.getValue();
            elements.forEach((element) => {
                if (this.component.removeChildRef) {
                    this.component.removeChildRef(element);
                }
            });
            elements.length = 0;
            this.component.resetNext();
            return BrsInvalid.Instance;
        },
    });

    readonly append = new Callable("append", {
        signature: {
            args: [new StdlibArgument("array", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, array: BrsComponent & BrsArray) => {
            if (this.component.getComponentName() !== array.getComponentName()) {
                interpreter.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: ${this.component.getComponentName()}.Append: invalid parameter type ${array.getComponentName()}: ${interpreter.formatLocation()}`
                );
                return BrsInvalid.Instance;
            }
            const elements = this.component.getValue();
            if (
                this.component.resizable ||
                elements.length + array.getValue().length <= this.component.maxSize
            ) {
                array.getValue().forEach((element) => {
                    if (this.component.addChildRef) {
                        this.component.addChildRef(element);
                    }
                });
                elements.push(...array.getElements().filter((element) => !!element)); // don't copy "holes" where no value exists
                this.component.updateNext(true, 0);
            }
            return BrsInvalid.Instance;
        },
    });
}

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

/** Represents a BrightScript component that has elements that can be iterated across. */
export interface BrsArray extends BrsIterable {
    readonly resizable: boolean;
    readonly maxSize: number;

    getValue(): Array<any>;

    updateNext(grow?: boolean, index?: number): void;

    addChildRef?: (value: BrsType | undefined) => void;

    removeChildRef?: (value: BrsType | undefined) => void;
}
