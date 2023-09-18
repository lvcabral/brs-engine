import { BrsType, Int32 } from "..";
import { BrsValue, ValueKind, BrsBoolean, BrsInvalid, BrsString } from "../BrsType";
import { BrsComponent, BrsIterable } from "./BrsComponent";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RoList } from "./RoList";
import { RoArray } from "./RoArray";
import { RoXMLElement } from "./RoXMLElement";

export class RoXMLList extends BrsComponent implements BrsValue, BrsIterable {
    readonly kind = ValueKind.Object;
    private roList: RoList;

    constructor() {
        super("roXMLList");
        this.roList = new RoList();
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
                this.addHead,
                this.addTail,
                this.getHead,
                this.getTail,
                this.removeHead,
                this.removeTail,
                this.count,
                this.clear,
                this.resetIndex,
                this.getIndex,
                this.removeIndex,
            ],
            ifArrayGet: [this.getEntry],
            ifArraySet: [this.setEntry],
            ifEnum: [this.isEmpty],
            ifListToArray: [this.toArray],
        });
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
        ].join("\n");
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

    get(index: BrsType) {
        switch (index.kind) {
            case ValueKind.Float:
                return this.getElements()[Math.trunc(index.getValue())] || BrsInvalid.Instance;
            case ValueKind.Int32:
                return this.getElements()[index.getValue()] || BrsInvalid.Instance;
            case ValueKind.String:
                return this.getMethod(index.value) || this.namedElements(index.value, true);
            default:
                postMessage(
                    "warning,List indexes must be 32-bit integers, or method names must be strings."
                );
                return BrsInvalid.Instance;
        }
    }

    set(index: BrsType, value: BrsType) {
        if (index.kind === ValueKind.Int32 || index.kind === ValueKind.Float) {
            this.roList.elements[Math.trunc(index.getValue())] = value;
        } else {
            postMessage("warning,List indexes must be 32-bit integers.");
        }
        return BrsInvalid.Instance;
    }

    add(element: RoXMLElement) {
        this.roList.add(element);
    }

    length() {
        return this.roList.length();
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
    private getAttributes = new Callable("getAttributes", {
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
    private getText = new Callable("getText", {
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
    private getChildElements = new Callable("getChildElements", {
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
    private getNamedElements = new Callable("getNamedElements", {
        signature: {
            args: [new StdlibArgument("name", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, name: BrsString) => {
            return this.namedElements(name.value, false);
        },
    });

    /** Same as GetNamedElements except the name matching is case-insensitive. */
    private getNamedElementsCi = new Callable("getNamedElementsCi", {
        signature: {
            args: [new StdlibArgument("name", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, name: BrsString) => {
            return this.namedElements(name.value, true);
        },
    });

    /** If the list contains exactly one item, Simplify() returns that item. Otherwise, it returns itself */
    private simplify = new Callable("simplify", {
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

    //--------------------------------- ifList ---------------------------------

    /** Adds typed value to head of list */
    private addHead = new Callable("addHead", {
        signature: {
            args: [new StdlibArgument("tvalue", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, tvalue: RoXMLElement) => {
            this.roList.add(tvalue, false);
            return BrsInvalid.Instance;
        },
    });

    /** Adds typed value to tail of list */
    private addTail = new Callable("addTail", {
        signature: {
            args: [new StdlibArgument("talue", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, tvalue: RoXMLElement) => {
            this.roList.add(tvalue, true);
            return BrsInvalid.Instance;
        },
    });

    /** Gets the entry at head of list and keep entry in list */
    private getHead = new Callable("getHead", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.roList.elements[0] || BrsInvalid.Instance;
        },
    });

    /** Gets the Object at tail of List and keep Object in list */
    private getTail = new Callable("getTail", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.roList.elements[this.roList.tail()] || BrsInvalid.Instance;
        },
    });

    /** Removes entry at head of list */
    private removeHead = new Callable("removeHead", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.roList.remove(0) || BrsInvalid.Instance;
        },
    });

    /** Removes entry at tail of list */
    private removeTail = new Callable("removeTail", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.roList.remove(this.roList.tail()) || BrsInvalid.Instance;
        },
    });

    /** Resets the current index or position in list to the head element */
    private resetIndex = new Callable("resetIndex", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            this.roList.currentIndex = this.length() > 0 ? 0 : -1;
            return BrsBoolean.from(this.roList.currentIndex === 0);
        },
    });

    /** Gets the entry at current index or position from the list and increments the index or position in the list */
    private getIndex = new Callable("getIndex", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.roList.getCurrent() ?? BrsInvalid.Instance;
        },
    });

    /** Removes the entry at the current index or position from the list and increments the index or position in the list */
    private removeIndex = new Callable("removeIndex", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.roList.remove(this.roList.currentIndex) || BrsInvalid.Instance;
        },
    });

    /** Returns the number of elements in list */
    private count = new Callable("count", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.length());
        },
    });

    /** Removes all elements from list */
    private clear = new Callable("clear", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.roList = new RoList();
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
        impl: (_: Interpreter) => {
            return new RoArray(this.roList.elements);
        },
    });

    //------------------------------- ifArrayGet --------------------------------

    /** Returns an array entry based on the provided index. */
    private getEntry = new Callable("getEntry", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Dynamic)],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter, index: BrsType) => {
            if (index.kind === ValueKind.Int32 || index.kind === ValueKind.Float) {
                return this.roList.elements[Math.trunc(index.getValue())] || BrsInvalid.Instance;
            }
            return BrsInvalid.Instance;
        },
    });

    //------------------------------- ifArraySet --------------------------------

    private setEntry = new Callable("setEntry", {
        signature: {
            args: [
                new StdlibArgument("index", ValueKind.Dynamic),
                new StdlibArgument("tvalue", ValueKind.Dynamic),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, index: BrsType, tvalue: BrsType) => {
            return this.set(index, tvalue);
        },
    });

    //--------------------------------- ifEnum ---------------------------------

    /** Returns true if enumeration contains no elements, false otherwise	 */
    private isEmpty = new Callable("isEmpty", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.length() === 0);
        },
    });
}
