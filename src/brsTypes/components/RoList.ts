import { BrsValue, ValueKind, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsType } from "..";
import { BrsComponent, BrsIterable } from "./BrsComponent";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { LinkedList } from "linked-list-typescript";
import { RoArray } from "./RoArray";

export class RoList extends BrsComponent implements BrsValue, BrsIterable {
    readonly kind = ValueKind.Object;
    private elements: LinkedList<BrsType>;

    constructor(elements?: BrsType[]) {
        super("roList");
        if (elements) {
            this.elements = new LinkedList<BrsType>(...elements);
        } else {
            this.elements = new LinkedList<BrsType>();
        }
        this.registerMethods([
            this.addHead,
            this.addTail,
            this.getHead,
            this.getTail,
            this.removeHead,
            this.removeTail,
            this.isEmpty,
            this.peek,
            this.pop,
            this.push,
            this.shift,
            this.unshift,
            this.delete,
            this.count,
            this.clear,
            this.append,
            this.toArray,
        ]);
    }

    toString(parent?: BrsType): string {
        if (parent) {
            return "<Component: roList>";
        }

        return [
            "<Component: roList> =",
            "(",
            ...this.elements.toArray().map((el: BrsValue) => `    ${el.toString(this)}`),
            ")",
        ].join("\n");
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    getValue() {
        return this.elements;
    }

    getElements() {
        return this.elements.toArray().slice();
    }

    get(index: BrsType) {
        switch (index.kind) {
            case ValueKind.Float:
                return this.getElements()[Math.trunc(index.getValue())] || BrsInvalid.Instance;
            case ValueKind.Int32:
                return this.getElements()[index.getValue()] || BrsInvalid.Instance;
            case ValueKind.String:
                return this.getMethod(index.value) || BrsInvalid.Instance;
            default:
                throw new Error(
                    "List indexes must be 32-bit integers, or method names must be strings"
                );
        }
    }

    set(index: BrsType, value: BrsType) {
        if (index.kind !== ValueKind.Int32 && index.kind != ValueKind.Float) {
            throw new Error("List indexes must be 32-bit integers");
        }
        let current = 0;
        for (let item of this.elements) {
            if (Math.trunc(index.getValue()) === current) {
                item = value;
                break;
            }
            current++;
        }
        return BrsInvalid.Instance;
    }

    add(element: BrsType) {
        this.elements.append(element);
    }

    length() {
        return this.elements.length;
    }

    //--------------------------------- ifList ---------------------------------

    /** Adds typed value to head of list */
    private addHead = new Callable("addHead", {
        signature: {
            args: [new StdlibArgument("tvalue", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, tvalue: BrsType) => {
            this.elements.prepend(tvalue);
            return BrsInvalid.Instance;
        },
    });

    /** Adds typed value to tail of list */
    private addTail = new Callable("addTail", {
        signature: {
            args: [new StdlibArgument("talue", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, tvalue: BrsType) => {
            this.elements.append(tvalue);
            return BrsInvalid.Instance;
        },
    });

    /** Gets the entry at head of list and keep entry in list */
    private getHead = new Callable("getHead", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter) => {
            return this.elements.head || BrsInvalid.Instance;
        },
    });

    /** Gets the Object at tail of List and keep Object in list */
    private getTail = new Callable("getTail", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter) => {
            return this.elements.tail || BrsInvalid.Instance;
        },
    });

    /** Removes entry at head of list */
    private removeHead = new Callable("removeHead", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter) => {
            return this.elements.removeHead() || BrsInvalid.Instance;
        },
    });

    /** Removes entry at tail of list */
    private removeTail = new Callable("removeTail", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter) => {
            return this.elements.removeTail() || BrsInvalid.Instance;
        },
    });

    /** Returns the number of elements in list */
    private count = new Callable("count", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (interpreter: Interpreter) => {
            return new Int32(this.elements.length);
        },
    });

    /** Removes all elements from list */
    private clear = new Callable("clear", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter) => {
            this.elements = new LinkedList<BrsType>();
            return BrsInvalid.Instance;
        },
    });

    //--------------------------------- ifEnum ---------------------------------

    /** Returns true if enumeration contains no elements, false otherwise	 */
    private isEmpty = new Callable("isEmpty", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter) => {
            return BrsBoolean.from(this.elements.length === 0);
        },
    });

    //--------------------------------- ifArray ---------------------------------

    /** Returns the last (highest index) array entry without removing it. If the array is empty, returns invalid */
    private peek = new Callable("peek", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter) => {
            return this.elements.tail || BrsInvalid.Instance;
        },
    });

    /** Returns the last (highest index) array entry and removes it from the array. If the array is empty, returns invalid */
    private pop = new Callable("pop", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter) => {
            return this.elements.removeTail() || BrsInvalid.Instance;
        },
    });

    /** Adds tvalue as the new highest index entry in the array (adds to the end of the array) */
    private push = new Callable("push", {
        signature: {
            args: [new StdlibArgument("talue", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, tvalue: BrsType) => {
            this.elements.append(tvalue);
            return BrsInvalid.Instance;
        },
    });

    /** Removes the index zero entry from the array and shifts every other entry down one to fill the hole */
    private shift = new Callable("shift", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter) => {
            return this.elements.removeHead() || BrsInvalid.Instance;
        },
    });

    /** Adds a new index zero to the array and shifts every other entry up one to accommodate */
    private unshift = new Callable("unshift", {
        signature: {
            args: [new StdlibArgument("tvalue", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, tvalue: BrsType) => {
            this.elements.prepend(tvalue);
            return BrsInvalid.Instance;
        },
    });

    /** Deletes the entry and shifts down all entries above to fill the hole. If it was successfully deleted, returns true. */
    private delete = new Callable("delete", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, index: Int32) => {
            if (index.lessThan(new Int32(0)).toBoolean()) {
                return BrsBoolean.False;
            }
            let current = 0;
            for (let item of this.elements) {
                if (index.getValue() === current) {
                    this.elements.remove(item);
                    return BrsBoolean.True;
                }
                current++;
            }
            return BrsBoolean.False;
        },
    });

    /** Appends each entry of one roArray to another. If the passed Array contains "holes", they are not appended */
    private append = new Callable("append", {
        signature: {
            args: [new StdlibArgument("array", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, array: BrsComponent) => {
            if (!(array instanceof RoArray)) {
                // TODO: validate against RBI
                return BrsInvalid.Instance;
            }
            array.getElements().forEach(element => {
                if (element) {
                    // don't copy "holes" where no value exists
                    this.elements.append(element);
                }
            });
            return BrsInvalid.Instance;
        },
    });

    //--------------------------------- ifListToArray ---------------------------------

    /** Returns an roArray containing the same elements as the list */
    private toArray = new Callable("toArray", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            return new RoArray(this.elements.toArray());
        },
    });
}
