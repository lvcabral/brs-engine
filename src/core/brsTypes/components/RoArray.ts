import { BrsType, isBrsString, isBrsNumber, Int32, Float, isBoxedNumber, isBoxable } from "..";
import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid, Comparable } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RoAssociativeArray } from "./RoAssociativeArray";
import { BrsArray, IfArray, IfArrayGet, IfArraySet } from "../interfaces/IfArray";
import { IfEnum } from "../interfaces/IfEnum";
import { BrsDevice } from "../../device/BrsDevice";

export class RoArray extends BrsComponent implements BrsValue, BrsArray {
    readonly kind = ValueKind.Object;
    readonly resizable: boolean = true;
    maxSize = 0;
    elements: BrsType[];
    enumIndex: number;

    constructor(elements: BrsType[]);
    constructor(capacity: Int32 | Float, resizable: BrsBoolean);
    constructor(...args: any) {
        super("roArray");
        this.elements = [];
        if (args.length === 1 && Array.isArray(args[0])) {
            args[0].forEach((element) => {
                this.addChildRef(element);
                this.elements.push(element);
            });
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
        const ifArray = new IfArray(this);
        const ifArrayGet = new IfArrayGet(this);
        const ifArraySet = new IfArraySet(this);
        const ifEnum = new IfEnum(this);
        this.registerMethods({
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
            ifArrayJoin: [this.join],
            ifArraySort: [this.sort, this.sortBy, this.reverse],
            ifArraySlice: [this.slice],
            ifArraySizeInfo: [this.capacity, this.isResizable],
            ifEnum: [ifEnum.isEmpty, ifEnum.isNext, ifEnum.next, ifEnum.reset],
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

    add(element: BrsType, onTail: boolean = true) {
        this.addChildRef(element);
        if (onTail) {
            this.elements.push(element);
        } else {
            this.elements.unshift(element);
        }
        this.updateNext(true);
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
        this.updateNext();
        this.removeChildRef(removed);
        return removed;
    }

    clear() {
        this.elements.forEach((element) => {
            this.removeChildRef(element);
        });
        this.elements.length = 0;
        this.enumIndex = -1;
    }

    tail() {
        return this.elements.length - 1;
    }

    get(index: BrsType) {
        if (isBoxedNumber(index)) {
            index = index.unbox();
        }
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
        if (isBoxedNumber(index)) {
            index = index.unbox();
        }
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

    updateNext(grow?: boolean, factor?: number) {
        const hasItems = this.elements.length > 0;
        if (this.enumIndex === -1 && hasItems) {
            this.enumIndex = 0;
        } else if (this.enumIndex >= this.elements.length || !hasItems) {
            this.enumIndex = -1;
        }
        if (grow) {
            this.updateCapacity(factor ?? 1.25);
        }
    }

    private updateCapacity(growthFactor = 0) {
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

    private aaCompare(
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

    dispose() {
        this.elements.forEach((element) => {
            this.removeChildRef(element);
        });
    }

    addChildRef(value: BrsType | undefined) {
        if (value instanceof BrsComponent) {
            value.addReference();
        } else if (value && isBoxable(value)) {
            value.inArray = true;
        }
    }

    removeChildRef(value: BrsType | undefined) {
        if (value instanceof BrsComponent) {
            value.removeReference();
        }
    }

    // ifArrayJoin
    private readonly join = new Callable("join", {
        signature: {
            args: [new StdlibArgument("separator", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, separator: BrsString) => {
            if (
                this.elements.some(function (element) {
                    return !(element instanceof BrsString);
                })
            ) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(
                        "warning,roArray.Join: Array contains non-string value(s)."
                    );
                }
                return new BrsString("");
            }
            return new BrsString(this.elements.join(separator.value));
        },
    });

    // ifArraySort
    private readonly sort = new Callable("sort", {
        signature: {
            args: [new StdlibArgument("flags", ValueKind.String, new BrsString(""))],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, flags: BrsString) => {
            if (flags.toString().match(/([^ir])/g) != null) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(
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

    private readonly sortBy = new Callable("sortBy", {
        signature: {
            args: [
                new StdlibArgument("fieldName", ValueKind.String),
                new StdlibArgument("flags", ValueKind.String, new BrsString("")),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, fieldName: BrsString, flags: BrsString) => {
            if (flags.toString().match(/([^ir])/g) != null) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(
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

    private readonly reverse = new Callable("reverse", {
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
    private readonly slice = new Callable("slice", {
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
    private readonly capacity = new Callable("capacity", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.maxSize);
        },
    });

    /** Returns true if the array can be resized. */
    private readonly isResizable = new Callable("isResizable", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.resizable);
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
