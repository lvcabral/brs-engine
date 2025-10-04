import { BrsType, isBoxable, isBoxedNumber, RoInvalid } from "..";
import { BrsValue, ValueKind, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsList, IfList, IfListToArray } from "../interfaces/IfList";
import { IfArray, IfArrayGet, IfArraySet } from "../interfaces/IfArray";
import { IfEnum } from "../interfaces/IfEnum";

export class RoList extends BrsComponent implements BrsValue, BrsList {
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
        const ifList = new IfList(this);
        const ifListToArray = new IfListToArray(this);
        const ifArray = new IfArray(this);
        const ifArrayGet = new IfArrayGet(this);
        const ifArraySet = new IfArraySet(this);
        const ifEnum = new IfEnum(this);
        this.registerMethods({
            ifList: [
                ifList.addHead,
                ifList.addTail,
                ifList.getHead,
                ifList.getTail,
                ifList.removeHead,
                ifList.removeTail,
                ifList.resetIndex,
                ifList.getIndex,
                ifList.removeIndex,
            ],
            ifListToArray: [ifListToArray.toArray],
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

    deepCopy(): BrsType {
        // Roku implementation still does not support deep copying of roList
        return new RoInvalid();
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

    resetCurrent() {
        this.listIndex = this.elements.length > 0 ? 0 : -1;
        return this.listIndex === 0;
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
        } else if (value && isBoxable(value)) {
            value.inArray = true;
        }
    }

    removeChildRef(value: BrsType | undefined) {
        if (value instanceof BrsComponent) {
            value.removeReference();
        }
    }
}
