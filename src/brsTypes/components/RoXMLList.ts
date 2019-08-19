import { BrsValue, ValueKind, BrsBoolean, BrsInvalid, BrsString } from "../BrsType";
import { BrsType } from "..";
import { BrsComponent, BrsIterable } from "./BrsComponent";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { LinkedList } from "linked-list-typescript";
import { RoArray } from "./RoArray";
import { RoXMLElement } from "./RoXMLElement";

export class RoXMLList extends BrsComponent implements BrsValue, BrsIterable {
    readonly kind = ValueKind.Object;
    private elements: LinkedList<RoXMLElement>;

    constructor() {
        super("roXMLList");
        this.elements = new LinkedList<RoXMLElement>();
        this.registerMethods([
            this.getAttributes,
            this.getChildElements,
            this.getNamedElements,
            this.getNamedElementsCi,
            this.getText,
            this.simplify,
            this.addHead,
            this.addTail,
            this.getHead,
            this.getTail,
            this.removeHead,
            this.removeTail,
            this.count,
            this.clear,
            this.isEmpty,
            this.toArray,
        ]);
    }

    toString(parent?: BrsType): string {
        if (parent) {
            return "<Component: roXMLList>";
        }

        return [
            "<Component: roXMLList> =",
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
            case ValueKind.Int32:
                return this.getElements()[index.getValue()] || BrsInvalid.Instance;
            case ValueKind.String:
                return this.getMethod(index.value) || BrsInvalid.Instance;
            default:
                throw new Error(
                    "Array indexes must be 32-bit integers, or method names must be strings"
                );
        }
    }

    set(index: BrsType, value: RoXMLElement) {
        if (index.kind !== ValueKind.Int32) {
            throw new Error("Array indexes must be 32-bit integers");
        }
        let current = 0;
        for (let item of this.elements) {
            if (index.getValue() === current) {
                item = value;
                break;
            }
            current++;
        }
        return BrsInvalid.Instance;
    }

    add(element: RoXMLElement) {
        this.elements.append(element);
    }

    length() {
        return this.elements.length;
    }

    //--------------------------------- ifXMLList ---------------------------------

    /** If list contains only one item, returns the attributes of that item. Otherwise returns invalid */
    private getAttributes = new Callable("getAttributes", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            if (this.elements.length === 1) {
                let xmlElm = this.elements.head;
                if (xmlElm instanceof RoXMLElement) {
                    return xmlElm.attributes();
                }
            }
            return BrsInvalid.Instance;
        },
    });

    /** If list contains only one item, returns the text of that item. Otherwise, returns an empty string */
    private getText = new Callable("getText", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            if (this.elements.length === 1) {
                let xmlElm = this.elements.head;
                if (xmlElm instanceof RoXMLElement) {
                    return xmlElm.text();
                }
            }
            return new BrsString("");
        },
    });

    /** If the list contains exactly one item, returns the child elements of that item. */
    private getChildElements = new Callable("getChildElements", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            if (this.elements.length === 1) {
                let xmlElm = this.elements.head;
                if (xmlElm instanceof RoXMLElement) {
                    return xmlElm.childElements();
                }
            }
            return BrsInvalid.Instance;
        },
    });

    /** Returns a new XMLList that contains all roXMLElements that matched the passed in name. */
    private getNamedElements = new Callable("getNamedElements", {
        signature: {
            args: [new StdlibArgument("name", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, name: BrsString) => {
            let elements = new RoXMLList();
            for (let element of this.elements) {
                if (element.name().value === name.value) {
                    elements.add(element);
                }
            }
            return elements;
        },
    });

    /** Same as GetNamedElements except the name matching is case-insensitive. */
    private getNamedElementsCi = new Callable("getNamedElementsCi", {
        signature: {
            args: [new StdlibArgument("name", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, name: BrsString) => {
            let elements = new RoXMLList();
            for (let element of this.elements) {
                if (element.name().value.toLocaleLowerCase() === name.value.toLocaleLowerCase()) {
                    elements.add(element);
                }
            }
            return elements;
        },
    });

    /** If the list contains exactly one item, Simplify() returns that item. Otherwise, it returns itself */
    private simplify = new Callable("simplify", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            if (this.elements.length === 1) {
                return this.elements.head;
            }
            return this;
        },
    });

    //--------------------------------- ifList ---------------------------------

    /** Adds typed value to head of list */
    private addHead = new Callable("addHead", {
        signature: {
            args: [new StdlibArgument("tvalue", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, tvalue: RoXMLElement) => {
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
        impl: (interpreter: Interpreter, tvalue: RoXMLElement) => {
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
            this.elements = new LinkedList<RoXMLElement>();
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
