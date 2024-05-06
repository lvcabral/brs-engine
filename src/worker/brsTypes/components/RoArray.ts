import { BrsType, isBrsString, isBrsNumber, Int32, Float } from "..";
import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid, Comparable } from "../BrsType";
import { BrsComponent, BrsIterable } from "./BrsComponent";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RoAssociativeArray } from "./RoAssociativeArray";

export class RoArray extends BrsComponent implements BrsValue, BrsIterable {
    readonly kind = ValueKind.Object;
    private maxSize = 0;
    private resizable = true;
    elements: BrsType[];
    enumIndex: number;

    constructor(elements: BrsType[]);
    constructor(capacity: Int32 | Float, resizable: BrsBoolean);
    constructor(...args: any) {
        super("roArray");
        this.elements = [];
        if (args.length === 1 && Array.isArray(args[0])) {
            this.elements = args[0];
        } else if (
            args.length === 2 &&
            (args[0] instanceof Int32 || args[0] instanceof Float) &&
            (args[1] instanceof BrsBoolean || isBrsNumber(args[1]))
        ) {
            this.maxSize = args[0].getValue();
            this.resizable = args[1].toBoolean();
        } else {
            throw new Error(
                `BRIGHTSCRIPT: ERROR: Runtime: "roArray": invalid number of parameters:`
            );
        }
        this.enumIndex = this.elements.length ? 0 : -1;
        this.registerMethods({
            ifArray: [
                this.peek,
                this.pop,
                this.push,
                this.shift,
                this.unshift,
                this.delete,
                this.count,
                this.clear,
                this.append,
            ],
            ifArrayGet: [this.getEntry],
            ifArraySet: [this.setEntry],
            ifArrayJoin: [this.join],
            ifArraySort: [this.sort, this.sortBy, this.reverse],
            ifArraySizeInfo: [this.capacity, this.isResizable],
            ifArraySlice: [this.slice],
            ifEnum: [this.isEmpty, this.isNext, this.next, this.reset],
        });
    }

    toString(parent?: BrsType): string {
        if (parent) {
            return "<Component: roArray>";
        }

        return [
            "<Component: roArray> =",
            "[",
            ...Array.from(this.elements, (el: BrsType) =>
                el === undefined ? "    invalid" : `    ${el.toString(this)}`
            ),
            "]",
        ].join("\n");
    }

    equalTo(other: BrsType) {
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
            this.elements[Math.trunc(index.getValue())] = value;
        }
        return BrsInvalid.Instance;
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

    updateNext() {
        const hasItems = this.elements.length > 0;
        if (this.enumIndex === -1 && hasItems) {
            this.enumIndex = 0;
        } else if (this.enumIndex >= this.elements.length || !hasItems) {
            this.enumIndex = -1;
        }
    }

    updateCapacity(growthFactor = 0) {
        if (this.resizable && growthFactor > 0) {
            if (this.elements.length > 0 && this.elements.length > this.maxSize) {
                let count = this.elements.length - 1;
                let newCap = Math.trunc(count * growthFactor);
                if (newCap - this.maxSize < 10) {
                    this.maxSize = Math.trunc(10 * (count / 10 + 1));
                } else {
                    this.maxSize = newCap;
                }
            }
        } else {
            this.maxSize = Math.max(this.elements.length, this.maxSize);
        }
    }

    aaCompare(
        fieldName: BrsString,
        flags: BrsString,
        a: RoAssociativeArray,
        b: RoAssociativeArray
    ) {
        let compare = 0;
        const originalArrayCopy = [...this.elements];
        const caseInsensitive = flags.toString().indexOf("i") > -1;
        const aHasField = a.elements.has(fieldName.toString().toLowerCase());
        const bHasField = b.elements.has(fieldName.toString().toLowerCase());
        if (aHasField && bHasField) {
            const valueA = a.get(fieldName);
            const valueB = b.get(fieldName);
            compare = sortCompare(originalArrayCopy, valueA, valueB, caseInsensitive);
        } else if (aHasField) {
            // assocArray with fields come before assocArrays without
            compare = -1;
        } else if (bHasField) {
            // assocArray with fields come before assocArrays without
            compare = 1;
        }
        return compare;
    }

    removeReference(): void {
        super.removeReference();
        if (this.references === 0) {
            this.elements.forEach((element) => {
                if (element instanceof BrsComponent) {
                    element.removeReference("roArray");
                }
            });
        }
    }

    // ifArray
    private peek = new Callable("peek", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.elements[this.elements.length - 1] || BrsInvalid.Instance;
        },
    });

    private pop = new Callable("pop", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            const removed = this.elements.pop();
            this.updateNext();
            return removed || BrsInvalid.Instance;
        },
    });

    private push = new Callable("push", {
        signature: {
            args: [new StdlibArgument("talue", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, tvalue: BrsType) => {
            if (this.resizable || this.elements.length < this.maxSize) {
                this.elements.push(tvalue);
                this.updateNext();
                this.updateCapacity(1.25);
            } else {
                interpreter.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roArray.Push: set ignored for index out of bounds on non-resizable array: ${interpreter.formatLocation()}`
                );
            }
            return BrsInvalid.Instance;
        },
    });

    private shift = new Callable("shift", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            const removed = this.elements.shift();
            this.updateNext();
            return removed || BrsInvalid.Instance;
        },
    });

    private unshift = new Callable("unshift", {
        signature: {
            args: [new StdlibArgument("tvalue", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, tvalue: BrsType) => {
            if (this.resizable || this.elements.length < this.maxSize) {
                this.elements.unshift(tvalue);
                this.updateNext();
                this.updateCapacity(1.25);
            } else {
                interpreter.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roArray.Unshift: set ignored for index out of bounds on non-resizable array: ${interpreter.formatLocation()}`
                );
            }
            return BrsInvalid.Instance;
        },
    });

    private delete = new Callable("delete", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, index: Int32) => {
            if (index.lessThan(new Int32(0)).toBoolean()) {
                return BrsBoolean.False;
            }
            const deleted = this.elements.splice(index.getValue(), 1);
            this.updateNext();
            return BrsBoolean.from(deleted.length > 0);
        },
    });

    private count = new Callable("count", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.elements.length);
        },
    });

    private clear = new Callable("clear", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.elements = [];
            this.enumIndex = -1;
            return BrsInvalid.Instance;
        },
    });

    private append = new Callable("append", {
        signature: {
            args: [new StdlibArgument("array", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, array: BrsComponent) => {
            if (!(array instanceof RoArray)) {
                interpreter.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roArray.Append: invalid parameter type ${array.getComponentName()}: ${interpreter.formatLocation()}`
                );
                return BrsInvalid.Instance;
            }

            if (this.resizable || this.elements.length + array.elements.length <= this.maxSize) {
                this.elements = [
                    ...this.elements,
                    ...array.elements.filter((element) => !!element), // don't copy "holes" where no value exists
                ];
                this.updateNext();
                this.updateCapacity();
            }
            return BrsInvalid.Instance;
        },
    });

    // ifArrayGet
    private getEntry = new Callable("getEntry", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Int32 | ValueKind.Float)],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter, index: Int32 | Float) => {
            return this.elements[Math.trunc(index.getValue())] || BrsInvalid.Instance;
        },
    });

    // ifArraySet
    private setEntry = new Callable("setEntry", {
        signature: {
            args: [
                new StdlibArgument("index", ValueKind.Int32 | ValueKind.Float),
                new StdlibArgument("tvalue", ValueKind.Dynamic),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, index: Int32 | Float, tvalue: BrsType) => {
            return this.set(index, tvalue);
        },
    });

    // ifArrayJoin
    private join = new Callable("join", {
        signature: {
            args: [new StdlibArgument("separator", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter, separator: BrsString) => {
            if (
                this.elements.some(function (element) {
                    return !(element instanceof BrsString);
                })
            ) {
                if (interpreter.isDevMode) {
                    interpreter.stderr.write(
                        "warning,roArray.Join: Array contains non-string value(s)."
                    );
                }
                return new BrsString("");
            }
            return new BrsString(this.elements.join(separator.value));
        },
    });

    // ifArraySort
    private sort = new Callable("sort", {
        signature: {
            args: [new StdlibArgument("flags", ValueKind.String, new BrsString(""))],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, flags: BrsString) => {
            if (flags.toString().match(/([^ir])/g) != null) {
                if (interpreter.isDevMode) {
                    interpreter.stderr.write(
                        "warning,roArray.Sort: Flags contains invalid option(s)."
                    );
                }
            } else {
                const caseInsensitive = flags.toString().indexOf("i") > -1;
                const originalArrayCopy = [...this.elements];
                this.elements.sort((a, b) => {
                    return sortCompare(originalArrayCopy, a, b, caseInsensitive);
                });
                if (flags.toString().indexOf("r") > -1) {
                    this.elements.reverse();
                }
            }
            return BrsInvalid.Instance;
        },
    });

    private sortBy = new Callable("sortBy", {
        signature: {
            args: [
                new StdlibArgument("fieldName", ValueKind.String),
                new StdlibArgument("flags", ValueKind.String, new BrsString("")),
            ],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString, flags: BrsString) => {
            if (flags.toString().match(/([^ir])/g) != null) {
                if (interpreter.isDevMode) {
                    interpreter.stderr.write(
                        "warning,roArray.SortBy: Flags contains invalid option(s)."
                    );
                }
            } else {
                const originalArrayCopy = [...this.elements];
                this.elements.sort((a, b) => {
                    let compare = 0;
                    if (a instanceof RoAssociativeArray && b instanceof RoAssociativeArray) {
                        compare = this.aaCompare(fieldName, flags, a, b);
                    } else if (a !== undefined && b !== undefined) {
                        compare = sortCompare(originalArrayCopy, a, b, false, false);
                    }
                    return compare;
                });
                if (flags.toString().indexOf("r") > -1) {
                    this.elements.reverse();
                }
            }
            return BrsInvalid.Instance;
        },
    });

    private reverse = new Callable("reverse", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, separator: BrsString) => {
            this.elements.reverse();
            return BrsInvalid.Instance;
        },
    });

    // ifArraySlice

    /** Returns a copy of a portion of an array into a new array selected from start to end (end not included) */
    private slice = new Callable("slice", {
        signature: {
            args: [
                new StdlibArgument("start", ValueKind.Int32 | ValueKind.Float, new Int32(0)),
                new StdlibArgument("end", ValueKind.Int32 | ValueKind.Float, BrsInvalid.Instance),
            ],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, start: Int32 | Float, end: Int32 | Float | BrsInvalid) => {
            if (end instanceof BrsInvalid) {
                return new RoArray(this.elements.slice(start.getValue()));
            } else {
                return new RoArray(this.elements.slice(start.getValue(), end.getValue()));
            }
        },
    });

    // ifArraySizeInfo

    /** Returns the maximum number of entries that can be stored in the array. */
    private capacity = new Callable("capacity", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.maxSize);
        },
    });

    /** Returns true if the array can be resized. */
    private isResizable = new Callable("isResizable", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.resizable);
        },
    });

    // ifEnum

    /** Checks whether the array contains no elements. */
    private isEmpty = new Callable("isEmpty", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.elements.length === 0);
        },
    });

    /** Checks whether the current position is not past the end of the enumeration. */
    private isNext = new Callable("isNext", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.enumIndex >= 0);
        },
    });

    /** Resets the current position to the first element of the enumeration. */
    private reset = new Callable("reset", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.enumIndex = this.elements.length > 0 ? 0 : -1;
            return BrsInvalid.Instance;
        },
    });

    /** Increments the position of an enumeration. */
    private next = new Callable("next", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.getNext() ?? BrsInvalid.Instance;
        },
    });
}

/**
 * Gives the order for sorting different types in a mixed array
 *
 * Mixed Arrays seem to get sorted in this order (tested with Roku OS 9.4):
 *
 * numbers in numeric order
 * strings in alphabetical order,
 * assocArrays in original order
 * everything else in original order
 */
function getTypeSortIndex(a: BrsType): number {
    if (isBrsNumber(a)) {
        return 0;
    } else if (isBrsString(a)) {
        return 1;
    } else if (a instanceof RoAssociativeArray) {
        return 2;
    }
    return 3;
}

/**
 * Sorts two BrsTypes in the order that Roku would sort them
 * @param originalArray A copy of the original array. Used to get the order of items
 * @param a
 * @param b
 * @param caseInsensitive Should strings be compared case insensitively? defaults to false
 * @param sortInsideTypes Should two numbers or two strings be sorted? defaults to true
 * @return compare value for array.sort()
 */
function sortCompare(
    originalArray: BrsType[],
    a: BrsType,
    b: BrsType,
    caseInsensitive: boolean = false,
    sortInsideTypes: boolean = true
): number {
    let compare = 0;
    if (a !== undefined && b !== undefined) {
        const aSortOrder = getTypeSortIndex(a);
        const bSortOrder = getTypeSortIndex(b);
        if (aSortOrder < bSortOrder) {
            compare = -1;
        } else if (bSortOrder < aSortOrder) {
            compare = 1;
        } else if (sortInsideTypes && isBrsNumber(a)) {
            // two numbers are in numeric order
            compare = (a as Comparable).greaterThan(b).toBoolean() ? 1 : -1;
        } else if (sortInsideTypes && isBrsString(a)) {
            // two strings are in alphabetical order
            let aStr = a.toString();
            let bStr = b.toString();
            if (caseInsensitive) {
                aStr = aStr.toLowerCase();
                bStr = bStr.toLowerCase();
            }
            // roku does not use locale for sorting strings
            compare = aStr > bStr ? 1 : -1;
        } else {
            // everything else is in the same order as the original
            const aOriginalIndex = originalArray.indexOf(a);
            const bOriginalIndex = originalArray.indexOf(b);
            if (aOriginalIndex > -1 && bOriginalIndex > -1) {
                compare = aOriginalIndex - bOriginalIndex;
            }
        }
    }
    return compare;
}
