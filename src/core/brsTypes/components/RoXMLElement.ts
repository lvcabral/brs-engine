import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsComponent, BrsIterable } from "./BrsComponent";
import { BrsType, RoInvalid } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RoAssociativeArray } from "./RoAssociativeArray";
import { RoList } from "./RoList";
import { RoXMLList } from "./RoXMLList";
import { XmlDocument, XmlElement, XmlNode, XmlTextNode, XmlCDataNode } from "xmldoc";
import * as sax from "sax";
import { BrsDevice } from "../../device/BrsDevice";

function isElementNode(node: XmlNode): node is XmlElement {
    return node.type === "element";
}

function isTextNode(node: XmlNode): node is XmlTextNode {
    return node.type === "text";
}

function isCDataNode(node: XmlNode): node is XmlCDataNode {
    return node.type === "cdata";
}

export class RoXMLElement extends BrsComponent implements BrsValue, BrsIterable {
    readonly kind = ValueKind.Object;
    private xmlElement: XmlElement;

    constructor(parsedXML?: XmlElement) {
        super("roXMLElement");
        this.xmlElement = parsedXML ?? RoXMLElement.createElement("_root_");
        this.registerMethods({
            ifXMLElement: [
                this.parse,
                this.getBody,
                this.getAttributes,
                this.getName,
                this.getText,
                this.getChildElements,
                this.getChildNodes,
                this.getNamedElements,
                this.getNamedElementsCi,
                this.genXML,
                this.genXMLHdr,
                this.isName,
                this.hasAttribute,
                this.setBody,
                this.addBodyElement,
                this.addElement,
                this.addElementWithBody,
                this.addText,
                this.addAttribute,
                this.setName,
                this.clear,
            ],
        });
    }

    private static createElement(name: string): XmlElement {
        const tagName = name || "_root_";
        const document = new XmlDocument(`<${tagName}></${tagName}>`);
        RoXMLElement.syncDerivedState(document);
        return document;
    }

    private static syncDerivedState(element: XmlElement) {
        const children = element.children ?? [];
        element.firstChild = children.length > 0 ? children[0] : null;
        element.lastChild = children.length > 0 ? children[children.length - 1] : null;
        const textParts: string[] = [];
        for (const child of children) {
            if (isTextNode(child)) {
                textParts.push(child.text);
            } else if (isCDataNode(child)) {
                textParts.push(child.cdata);
            }
        }
        element.val = textParts.join("");
    }

    private static getTextFromElement(element: XmlElement): string {
        if (!element.children || element.children.length === 0) {
            return element.val ?? "";
        }
        const parts: string[] = [];
        for (const child of element.children) {
            if (isTextNode(child)) {
                parts.push(child.text);
            } else if (isCDataNode(child)) {
                parts.push(child.cdata);
            }
        }
        if (parts.length === 0) {
            return element.val ?? "";
        }
        return parts.join("");
    }

    private static replaceTextContent(element: XmlElement, text: string) {
        const children = element.children ?? [];
        const filtered = children.filter((child) => !isTextNode(child) && !isCDataNode(child));
        element.children = filtered;
        if (text.length > 0) {
            element.children.push(new XmlTextNode(text));
        }
        RoXMLElement.syncDerivedState(element);
    }

    private static appendTextContent(element: XmlElement, text: string) {
        if (text.length === 0) {
            return;
        }
        const existing = RoXMLElement.getTextFromElement(element);
        RoXMLElement.replaceTextContent(element, existing + text);
    }

    private static validateXml(xml: string): string | undefined {
        try {
            const parser = sax.parser(true, { trim: false, normalize: false });
            parser.onerror = (err: Error) => {
                throw err;
            };
            parser.write(xml).close();
            return undefined;
        } catch (err: any) {
            return err?.message ?? String(err);
        }
    }

    private getElement(): XmlElement {
        return this.xmlElement;
    }

    toString(parent?: BrsType): string {
        return "<Component: roXMLElement>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    getElements() {
        return this.childElements().getElements();
    }

    deepCopy(): BrsType {
        // Roku implementation still does not support deep copying of roXMLElement
        return new RoInvalid();
    }

    get(index: BrsType) {
        if (index.kind !== ValueKind.String) {
            throw new Error("XML Element indexes must be strings");
        }
        return this.getMethod(index.value) ?? this.namedElements(index.value, true);
    }

    set(index: BrsType, value: BrsType) {
        if (index.kind !== ValueKind.String) {
            throw new Error("XML Element indexes must be strings");
        }
        // TODO: Replicate Roku behavior
        return BrsInvalid.Instance;
    }

    hasNext() {
        return this.childElements().hasNext();
    }

    getNext() {
        return this.childElements().getNext();
    }

    resetNext() {
        this.childElements().resetNext();
    }

    updateNext() {
        this.childElements().updateNext();
    }

    getAttribute(index: BrsType) {
        if (index.kind !== ValueKind.String) {
            throw new Error("XML Element attribute must be strings");
        }
        const element = this.getElement();
        const target = index.value.toLocaleLowerCase();
        for (const [name, value] of Object.entries(element.attr ?? {})) {
            if (name.toLocaleLowerCase() === target) {
                return new BrsString(value);
            }
        }
        return BrsInvalid.Instance;
    }

    attributes() {
        let attributes = new RoAssociativeArray([]);
        for (const [name, value] of Object.entries(this.getElement().attr ?? {})) {
            attributes.set(new BrsString(name), new BrsString(value));
        }
        return attributes;
    }

    name() {
        const elementName = this.getElement().name;
        return new BrsString(elementName === "_root_" ? "" : elementName);
    }

    text() {
        return new BrsString(RoXMLElement.getTextFromElement(this.getElement()));
    }

    childElements() {
        let elements = new RoXMLList();
        const element = this.getElement();
        for (const child of element.children ?? []) {
            if (isElementNode(child)) {
                elements.add(new RoXMLElement(child));
            }
        }
        return elements;
    }

    childNodes() {
        let nodes = new RoList();
        const element = this.getElement();
        for (const child of element.children ?? []) {
            if (isElementNode(child)) {
                nodes.add(new RoXMLElement(child));
            } else if (isTextNode(child)) {
                nodes.add(new BrsString(child.text));
            } else if (isCDataNode(child)) {
                nodes.add(new BrsString(child.cdata));
            }
        }
        return nodes;
    }

    namedElements(name: string, ci: boolean) {
        let elements = new RoXMLList();
        if (ci) {
            name = name.toLocaleLowerCase();
        }
        const element = this.getElement();
        for (const child of element.children ?? []) {
            if (isElementNode(child)) {
                const childName = ci ? child.name.toLocaleLowerCase() : child.name;
                if (childName === name) {
                    elements.add(new RoXMLElement(child));
                }
            }
        }
        return elements;
    }

    /** Parse a string of XML. Returns true if successful. In that case, XML elements are available using other methods */
    private readonly parse = new Callable("parse", {
        signature: {
            args: [new StdlibArgument("xml", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, xml: BrsString) => {
            const trimmed = xml.value.trim();
            if (trimmed.length === 0) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write("warning,Warning: Empty input was provided to parse XML.");
                }
                this.xmlElement = RoXMLElement.createElement("_root_");
                return BrsBoolean.False;
            }
            const validationError = RoXMLElement.validateXml(trimmed);
            if (validationError) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`error,Error parsing XML: ${validationError}`);
                }
                this.xmlElement = RoXMLElement.createElement("_root_");
                return BrsBoolean.False;
            }
            try {
                const document = new XmlDocument(xml.value);
                RoXMLElement.syncDerivedState(document);
                this.xmlElement = document;
                return BrsBoolean.True;
            } catch (err: any) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`error,Error parsing XML: ${err?.message ?? err}`);
                }
                this.xmlElement = RoXMLElement.createElement("_root_");
                return BrsBoolean.False;
            }
        },
    });

    /** Returns the body of the element. If the element contains child elements, */
    /** returns an roXMLList representing those elements, like GetChildElements(). */
    /** If there are no children but the element contains text, returns an roString like GetText(). */
    /** If the element is empty, GetBody() returns invalid */
    private readonly getBody = new Callable("getBody", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            let elements = this.childElements();
            if (elements.length() > 0) {
                return elements;
            } else if (this.text().value !== "") {
                return this.text();
            }
            return BrsInvalid.Instance;
        },
    });

    /** Returns an roXMLList of child elements. If there are no child elements, returns invalid.  */
    private readonly getChildElements = new Callable("getChildElements", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            let elements = this.childElements();
            if (elements.length() > 0) {
                return elements;
            }
            return BrsInvalid.Instance;
        },
    });

    /** Returns an roXMLList of child elements. If there are no child elements, returns invalid. */
    private readonly getChildNodes = new Callable("getChildNodes", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            let nodes = this.childNodes();
            if (nodes.length() > 0) {
                return nodes;
            }
            return BrsInvalid.Instance;
        },
    });

    /** Returns an roXMLList representing all child elements of this element whose name is specified. */
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

    /** Returns an Associative Array representing the XML attributes of the element */
    private readonly getAttributes = new Callable("getAttributes", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.attributes();
        },
    });

    /** Returns the name of the element */
    private readonly getName = new Callable("getName", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return this.name();
        },
    });

    /** Returns any text contained in the element. */
    private readonly getText = new Callable("getText", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return this.text();
        },
    });

    /** Returns true if the element has the specified name. */
    private readonly isName = new Callable("isName", {
        signature: {
            args: [new StdlibArgument("name", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, name: BrsString) => {
            return BrsBoolean.from(this.name().value === name.value);
        },
    });

    /** Returns true if the element has the specified attribute. */
    private readonly hasAttribute = new Callable("hasAttribute", {
        signature: {
            args: [new StdlibArgument("attr", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, attr: BrsString) => {
            const element = this.getElement();
            return BrsBoolean.from(Boolean(element.attr && attr.value in element.attr));
        },
    });

    /** Sets the element text from the specified string. */
    private readonly setBody = new Callable("setBody", {
        signature: {
            args: [new StdlibArgument("body", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, body: BrsString) => {
            RoXMLElement.replaceTextContent(this.getElement(), body.value);
            return BrsInvalid.Instance;
        },
    });

    /** Adds text to the element body. */
    private readonly addText = new Callable("addText", {
        signature: {
            args: [new StdlibArgument("text", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, text: BrsString) => {
            RoXMLElement.appendTextContent(this.getElement(), text.value);
            return BrsInvalid.Instance;
        },
    });

    /** Adds an new empty child element and returns it. */
    private readonly addBodyElement = new Callable("addBodyElement", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            const parent = this.getElement();
            const child = RoXMLElement.createElement("child");
            parent.children.push(child);
            RoXMLElement.syncDerivedState(parent);
            return new RoXMLElement(child);
        },
    });

    /** Adds a new child element with the specified name and returns the new element. */
    private readonly addElement = new Callable("addElement", {
        signature: {
            args: [new StdlibArgument("name", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, name: BrsString) => {
            const parent = this.getElement();
            const child = RoXMLElement.createElement(name.value);
            parent.children.push(child);
            RoXMLElement.syncDerivedState(parent);
            return new RoXMLElement(child);
        },
    });

    /** Adds a new child element with the specified name and text from the specified body string, and returns the new element. */
    private readonly addElementWithBody = new Callable("addElementWithBody", {
        signature: {
            args: [new StdlibArgument("name", ValueKind.String), new StdlibArgument("body", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, name: BrsString, body: BrsString) => {
            const parent = this.getElement();
            const child = RoXMLElement.createElement(name.value);
            RoXMLElement.replaceTextContent(child, body.value);
            parent.children.push(child);
            RoXMLElement.syncDerivedState(parent);
            return new RoXMLElement(child);
        },
    });

    /** Adds an attribute value to the element. */
    private readonly addAttribute = new Callable("addAttribute", {
        signature: {
            args: [new StdlibArgument("attr", ValueKind.String), new StdlibArgument("value", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, attr: BrsString, value: BrsString) => {
            const element = this.getElement();
            element.attr = element.attr ?? {};
            element.attr[attr.value] = value.value;
            return BrsInvalid.Instance;
        },
    });

    /** Sets the name of the element. */
    private readonly setName = new Callable("setName", {
        signature: {
            args: [new StdlibArgument("name", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, name: BrsString) => {
            this.xmlElement.name = name.value;
            return BrsInvalid.Instance;
        },
    });

    /** Serializes the element to XML document text. */
    private readonly genXMLHdr = new Callable("genXMLHdr", {
        signature: {
            args: [new StdlibArgument("header", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, header: BrsString) => {
            const xml = this.xmlElement.toString({ compressed: true });
            return new BrsString(header.value + xml);
        },
    });

    /** Serializes the element to XML document text. */
    private readonly genXML = new Callable("genXML", {
        signature: {
            args: [new StdlibArgument("gen_header", ValueKind.Boolean)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, gen_header: BrsBoolean) => {
            const xml = this.xmlElement.toString({ compressed: true });
            const header = gen_header.toBoolean() ? '<?xml version="1.0" encoding="UTF-8"?>' : "";
            return new BrsString(header + xml);
        },
    });

    /** Removes all sub-elements and clear the name of the element */
    private readonly clear = new Callable("clear", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.xmlElement = RoXMLElement.createElement("root");
            return BrsInvalid.Instance;
        },
    });
}
