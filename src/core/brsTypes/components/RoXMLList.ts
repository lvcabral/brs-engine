import { BrsType, isBoxedNumber, RoInvalid } from "..";
import { BrsValue, ValueKind, BrsBoolean, BrsInvalid, BrsString } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RoList } from "./RoList";
import { RoXMLElement } from "./RoXMLElement";
import { BrsList, IfList, IfListToArray } from "../interfaces/IfList";
import { IfArray, IfArrayGet, IfArraySet } from "../interfaces/IfArray";
import { IfEnum } from "../interfaces/IfEnum";

export class RoXMLList extends BrsComponent implements BrsValue, BrsList {
    readonly kind = ValueKind.Object;
    private readonly roList: RoList;
    readonly resizable: boolean = true;
    maxSize = 0;

    constructor(elements?: BrsType[]) {
        super("roXMLList");
        this.roList = new RoList(elements);
        const ifList = new IfList(this);
        const ifListToArray = new IfListToArray(this);
        const ifArray = new IfArray(this);
        const ifArrayGet = new IfArrayGet(this);
        const ifArraySet = new IfArraySet(this);
        const ifEnum = new IfEnum(this);
        this.registerMethods({
            ifXMLList: [
                this.getAttributes,
                this.getChildElements,
                this.getNamedElements,
                this.getNamedElementsCi,
                this.getText,
                this.simplify,
            ],
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

    get listIndex(): number {
        return this.roList.listIndex;
    }

    toString(parent?: BrsType): string {
        if (parent) {
            return "<Component: roXMLList>";
        }

        return [
            "<Component: roXMLList> =",
            "(",
            ...this.roList.elements.map((el: BrsValue) => `    ${el.toString(this)}`),
            ")",
        ].join("\r\n");
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    getValue() {
        return this.roList.elements;
    }

    getElements() {
        return this.roList.elements.slice();
    }

    getAttribute(index: BrsType) {
        if (index.kind !== ValueKind.String) {
            throw new Error("XML Element attribute must be strings");
        }
        if (this.length() === 1) {
            let xmlElm = this.roList.elements[0];
            if (xmlElm instanceof RoXMLElement) {
                return xmlElm.getAttribute(index);
            }
        }
        return BrsInvalid.Instance;
    }

    deepCopy(): BrsType {
        // Roku implementation still does not support deep copying of roXMLList
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
                return this.getMethod(index.value) ?? this.namedElements(index.value, true);
            default:
                return BrsInvalid.Instance;
        }
    }

    set(index: BrsType, value: BrsType) {
        if (isBoxedNumber(index)) {
            index = index.unbox();
        }
        if (index.kind === ValueKind.Int32 || index.kind === ValueKind.Float) {
            this.roList.elements[Math.trunc(index.getValue())] = value;
        }
        return BrsInvalid.Instance;
    }

    hasNext() {
        return this.roList.hasNext();
    }

    getNext() {
        return this.roList.getNext();
    }

    resetNext() {
        this.roList.resetNext();
    }

    updateNext(): void {
        this.roList.updateNext();
    }

    add(element: RoXMLElement) {
        this.roList.add(element);
    }

    remove(index: number) {
        return this.roList.remove(index);
    }

    clear(): void {
        this.roList.clear();
    }

    length() {
        return this.roList.length();
    }

    getCurrent() {
        return this.roList.getCurrent();
    }

    resetCurrent(): boolean {
        return this.roList.resetCurrent();
    }

    tail(): number {
        return this.roList.tail();
    }

    namedElements(name: string, ci: boolean) {
        if (ci) {
            name = name.toLocaleLowerCase();
        }
        let elements = new RoXMLList();
        let xmlElm = this.roList.elements[0];
        if (xmlElm instanceof RoXMLElement) {
            let childElm = xmlElm.childElements();
            for (let index = 0; index < childElm.length(); index++) {
                const element = childElm.getElements()[index] as RoXMLElement;
                let key: string;
                if (ci) {
                    key = element.name().value.toLocaleLowerCase();
                } else {
                    key = element.name().value;
                }
                if (key === name) {
                    elements.add(element);
                }
            }
        }
        return elements;
    }
    //--------------------------------- ifXMLList ---------------------------------

    /** If list contains only one item, returns the attributes of that item. Otherwise returns invalid */
    private readonly getAttributes = new Callable("getAttributes", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            if (this.length() === 1) {
                let xmlElm = this.roList.elements[0];
                if (xmlElm instanceof RoXMLElement) {
                    return xmlElm.attributes();
                }
            }
            return BrsInvalid.Instance;
        },
    });

    /** If list contains only one item, returns the text of that item. Otherwise, returns an empty string */
    private readonly getText = new Callable("getText", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            if (this.length() === 1) {
                let xmlElm = this.roList.elements[0];
                if (xmlElm instanceof RoXMLElement) {
                    return xmlElm.text();
                }
            }
            return new BrsString("");
        },
    });

    /** If the list contains exactly one item, returns the child elements of that item. */
    private readonly getChildElements = new Callable("getChildElements", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            if (this.length() === 1) {
                let xmlElm = this.roList.elements[0];
                if (xmlElm instanceof RoXMLElement) {
                    return xmlElm.childElements();
                }
            }
            return BrsInvalid.Instance;
        },
    });

    /** Returns a new XMLList that contains all roXMLElements that matched the passed in name. */
    private readonly getNamedElements = new Callable("getNamedElements", {
        signature: {
            args: [new StdlibArgument("name", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, name: BrsString) => {
            return this.namedElements(name.value, false);
        },
    });

    /** Same as GetNamedElements except the name matching is case-insensitive. */
    private readonly getNamedElementsCi = new Callable("getNamedElementsCi", {
        signature: {
            args: [new StdlibArgument("name", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, name: BrsString) => {
            return this.namedElements(name.value, true);
        },
    });

    /** If the list contains exactly one item, Simplify() returns that item. Otherwise, it returns itself */
    private readonly simplify = new Callable("simplify", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            if (this.length() === 1) {
                return this.roList.elements[0];
            }
            return this;
        },
    });
}
