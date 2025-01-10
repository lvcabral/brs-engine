import { BrsType, RoArray } from "..";
import { BrsValue, ValueKind, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { BrsArray, IfArray, IfArrayGet, IfArraySet } from "../interfaces/IfArray";
import { IfEnum } from "../interfaces/IfEnum";

export class RoList extends BrsComponent implements BrsValue, BrsArray {
    readonly kind = ValueKind.Object;
    readonly resizable: boolean = true;
    maxSize = 0;
    elements: BrsType[];
    listIndex: number;
    enumIndex: number;

    constructor(elements?: BrsType[]) {
        super("roList");
        this.elements = [];
        if (elements) {
            elements.forEach((element) => {
                this.addChildRef(element);
                this.elements.push(element);
            });
        }
        this.listIndex = -1;
        this.enumIndex = -1;
        const ifArray = new IfArray(this);
        const ifArrayGet = new IfArrayGet(this);
        const ifArraySet = new IfArraySet(this);
        const ifEnum = new IfEnum(this);
        this.registerMethods({
            ifList: [
                this.addHead,
                this.addTail,
                this.getHead,
                this.getTail,
                this.removeHead,
                this.removeTail,
                this.resetIndex,
                this.getIndex,
                this.removeIndex,
            ],
            ifListToArray: [this.toArray],
            ifArray: [
                ifArray.peek,
                ifArray.pop,
                ifArray.push,
                ifArray.shift,
                ifArray.unshift,
                ifArray.delete,
                ifArray.count,
                ifArray.clear,
                ifArray.append,
            ],
            ifArrayGet: [ifArrayGet.getEntry],
            ifArraySet: [ifArraySet.setEntry],
            ifEnum: [ifEnum.isEmpty, ifEnum.isNext, ifEnum.next, ifEnum.reset],
        });
    }

    toString(parent?: BrsType): string {
        if (parent) {
            return "<Component: roList>";
        }

        return [
            "<Component: roList> =",
            "(",
            ...Array.from(this.elements, (el: BrsType) =>
                el === undefined ? "    invalid" : `    ${el.toString(this)}`
            ),
            ")",
        ].join("\n");
    }

    equalTo(_other: BrsType) {
        return BrsBoolean.False;
    }

    getValue() {
        return this.elements;
    }

    getElements() {
        return this.elements.slice();
    }

    get(index: BrsType) {
        switch (index.kind) {
            case ValueKind.Float:
                return this.getElements()[Math.trunc(index.getValue())] ?? BrsInvalid.Instance;
            case ValueKind.Int32:
                return this.getElements()[index.getValue()] ?? BrsInvalid.Instance;
            case ValueKind.String:
                return this.getMethod(index.value) ?? BrsInvalid.Instance;
            default:
                return BrsInvalid.Instance;
        }
    }

    set(index: BrsType, value: BrsType) {
        if (index.kind === ValueKind.Int32 || index.kind === ValueKind.Float) {
            const idx = Math.trunc(index.getValue());
            this.addChildRef(value);
            this.removeChildRef(this.elements[idx]);
            this.elements[idx] = value;
        }
        return BrsInvalid.Instance;
    }

    hasNext() {
        return BrsBoolean.from(this.enumIndex >= 0);
    }

    getNext() {
        const index = this.enumIndex;
        if (index >= 0) {
            this.enumIndex++;
            if (this.enumIndex >= this.elements.length) {
                this.enumIndex = -1;
            }
        }
        return this.elements[index];
    }

    resetNext() {
        this.enumIndex = this.elements.length > 0 ? 0 : -1;
    }

    updateNext() {
        const hasItems = this.elements.length > 0;
        if (this.enumIndex === -1 && hasItems) {
            this.enumIndex = 0;
        } else if (this.enumIndex >= this.elements.length || !hasItems) {
            this.enumIndex = -1;
        }
    }

    add(element: BrsType, onTail: boolean = true) {
        this.addChildRef(element);
        if (onTail) {
            this.elements.push(element);
        } else {
            this.elements.unshift(element);
            if (this.listIndex >= 0) {
                this.listIndex++;
            }
            if (this.enumIndex >= 0) {
                this.enumIndex++;
            }
        }
    }

    remove(index: number) {
        let removed;
        if (index === 0) {
            removed = this.elements.shift();
        } else if (index === this.tail()) {
            removed = this.elements.pop();
        } else {
            removed = this.elements.splice(index, 1)[0];
        }
        if (removed && this.listIndex > index) {
            this.listIndex--;
        }
        if (this.listIndex >= this.elements.length) {
            this.listIndex = -1;
        }
        if (removed && this.enumIndex > index) {
            this.enumIndex--;
        }
        if (this.enumIndex >= this.elements.length) {
            this.enumIndex = -1;
        }
        this.removeChildRef(removed);
        return removed;
    }

    clear() {
        this.elements.forEach((element) => {
            this.removeChildRef(element);
        });
        this.elements.length = 0;
        this.listIndex = -1;
        this.enumIndex = -1;
    }

    getCurrent() {
        const index = this.listIndex;
        if (index >= 0) {
            this.listIndex++;
            if (this.listIndex >= this.elements.length) {
                this.listIndex = -1;
            }
        }
        return this.elements[index];
    }

    length() {
        return this.elements.length;
    }

    tail() {
        return this.elements.length - 1;
    }

    dispose() {
        this.elements.forEach((element) => {
            this.removeChildRef(element);
        });
    }

    addChildRef(value: BrsType | undefined) {
        if (value instanceof BrsComponent) {
            value.addReference();
        }
    }

    removeChildRef(value: BrsType | undefined) {
        if (value instanceof BrsComponent) {
            value.removeReference();
        }
    }

    //--------------------------------- ifList ---------------------------------

    /** Adds typed value to head of list */
    private readonly addHead = new Callable("addHead", {
        signature: {
            args: [new StdlibArgument("tvalue", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, tvalue: BrsType) => {
            this.add(tvalue, false);
            return BrsInvalid.Instance;
        },
    });

    /** Adds typed value to tail of list */
    private readonly addTail = new Callable("addTail", {
        signature: {
            args: [new StdlibArgument("tvalue", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, tvalue: BrsType) => {
            this.elements.push(tvalue);
            return BrsInvalid.Instance;
        },
    });

    /** Gets the entry at head of list and keep entry in list */
    private readonly getHead = new Callable("getHead", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.elements[0] || BrsInvalid.Instance;
        },
    });

    /** Gets the Object at tail of List and keep Object in list */
    private readonly getTail = new Callable("getTail", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.elements[this.tail()] || BrsInvalid.Instance;
        },
    });

    /** Removes entry at head of list */
    private readonly removeHead = new Callable("removeHead", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.remove(0) || BrsInvalid.Instance;
        },
    });

    /** Removes entry at tail of list */
    private readonly removeTail = new Callable("removeTail", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.remove(this.tail()) || BrsInvalid.Instance;
        },
    });

    /** Resets the current index or position in list to the head element */
    private readonly resetIndex = new Callable("resetIndex", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            this.listIndex = this.elements.length > 0 ? 0 : -1;
            return BrsBoolean.from(this.listIndex === 0);
        },
    });

    /** Gets the entry at current index or position from the list and increments the index or position in the list */
    private readonly getIndex = new Callable("getIndex", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.getCurrent() ?? BrsInvalid.Instance;
        },
    });

    /** Removes the entry at the current index or position from the list and increments the index or position in the list */
    private readonly removeIndex = new Callable("removeIndex", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.remove(this.listIndex) || BrsInvalid.Instance;
        },
    });

    //--------------------------------- ifListToArray ---------------------------------

    /** Returns an roArray containing the same elements as the list */
    private readonly toArray = new Callable("toArray", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return new RoArray(this.elements);
        },
    });
}
