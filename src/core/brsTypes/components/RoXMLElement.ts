import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsComponent, BrsIterable } from "./BrsComponent";
import { BrsType, RoInvalid } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RoAssociativeArray } from "./RoAssociativeArray";
import { RoList } from "./RoList";
import { RoXMLList } from "./RoXMLList";
import * as xml2js from "xml2js";
import { BrsDevice } from "../../device/BrsDevice";

export class RoXMLElement extends BrsComponent implements BrsValue, BrsIterable {
    readonly kind = ValueKind.Object;
    private parsedXML: any;
    constructor(parsedXML?: any) {
        super("roXMLElement");
        this.parsedXML = parsedXML || { _root_: {} };
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
        if (this.parsedXML && Object.keys(this.parsedXML).length > 0) {
            let root = Object.keys(this.parsedXML)[0];
            if (this.parsedXML[root].$) {
                let attrs = this.parsedXML[root].$;
                let keys = Object.keys(attrs);
                let values = Object.values(attrs) as string[];
                for (let k = 0; k < keys.length; k++) {
                    if (keys[k].toLocaleLowerCase() === index.value.toLocaleLowerCase()) {
                        return new BrsString(values[k]);
                    }
                }
            }
        }
        return BrsInvalid.Instance;
    }

    attributes() {
        let attributes = new RoAssociativeArray([]);
        if (this.parsedXML && Object.keys(this.parsedXML).length > 0) {
            let root = Object.keys(this.parsedXML)[0];
            if (this.parsedXML[root].$) {
                let attrs = this.parsedXML[root].$;
                let keys = Object.keys(attrs);
                let values = Object.values(attrs) as string[];
                for (let index = 0; index < keys.length; index++) {
                    attributes.set(new BrsString(keys[index]), new BrsString(values[index]));
                }
            }
        }
        return attributes;
    }

    name() {
        let name = "";
        if (this.parsedXML && Object.keys(this.parsedXML).length > 0) {
            name = Object.keys(this.parsedXML)[0];
            if (name === "_root_") {
                name = "";
            }
        }
        return new BrsString(name);
    }

    text() {
        let text = "";
        let root = Object.keys(this.parsedXML)[0];
        if (this.parsedXML[root]._) {
            text = this.parsedXML[root]._;
        } else if (typeof this.parsedXML[root] === "string") {
            text = this.parsedXML[root];
        }
        return new BrsString(text);
    }

    childElements() {
        let elements = new RoXMLList();
        if (this.parsedXML && Object.keys(this.parsedXML).length > 0) {
            let root = Object.keys(this.parsedXML)[0];
            for (let [key, value] of Object.entries(this.parsedXML[root])) {
                if (key !== "$" && key !== "_") {
                    if (value instanceof Array) {
                        for (const item of value) {
                            let element = new RoXMLElement();
                            element.parsedXML = { [key]: item };
                            elements.add(element);
                        }
                    }
                }
            }
        }
        return elements;
    }

    childNodes() {
        let nodes = new RoList();
        if (this.parsedXML && Object.keys(this.parsedXML).length > 0) {
            let root = Object.keys(this.parsedXML)[0];
            for (let [key, value] of Object.entries(this.parsedXML[root])) {
                if (key !== "$") {
                    if (value instanceof Array) {
                        for (const item of value) {
                            let element = new RoXMLElement();
                            element.parsedXML = { [key]: item };
                            nodes.add(element);
                        }
                    } else if (typeof value === "string") {
                        nodes.add(new BrsString(value));
                    }
                }
            }
        }
        return nodes;
    }

    namedElements(name: string, ci: boolean) {
        let elements = new RoXMLList();
        if (ci) {
            name = name.toLocaleLowerCase();
        }
        if (this.parsedXML && Object.keys(this.parsedXML).length > 0) {
            let root = Object.keys(this.parsedXML)[0];
            for (let [key, value] of Object.entries(this.parsedXML[root])) {
                let cKey = ci ? key.toLocaleLowerCase() : key;
                if (cKey === name) {
                    if (value instanceof Array) {
                        for (const item of value) {
                            let element = new RoXMLElement();
                            element.parsedXML = { [key]: item };
                            elements.add(element);
                        }
                    }
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
            let result = false;
            let xmlParser = new xml2js.Parser();
            let parsedXML;
            xmlParser.parseString(xml.value, function (err: any, parsed: any) {
                let errMessage = "";
                if (err) {
                    errMessage = `error,Error parsing XML: ${err.message}`;
                } else if (parsed) {
                    parsedXML = parsed;
                    result = true;
                } else {
                    errMessage = "warning,Warning: Empty input was provided to parse XML.";
                }
                if (errMessage !== "" && BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(errMessage);
                }
            });
            this.parsedXML = parsedXML;
            return BrsBoolean.from(result);
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
            if (Object.keys(this.parsedXML).length > 0) {
                const root = Object.keys(this.parsedXML)[0];
                if (this.parsedXML[root].$) {
                    const attrs = this.parsedXML[root].$;
                    return BrsBoolean.from(attr.value in attrs);
                }
            }
            return BrsBoolean.False;
        },
    });

    /** Sets the element text from the specified string. */
    private readonly setBody = new Callable("setBody", {
        signature: {
            args: [new StdlibArgument("body", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, body: BrsString) => {
            if (Object.keys(this.parsedXML).length > 0) {
                const root = Object.keys(this.parsedXML)[0];
                if (this.parsedXML[root]["_"]) {
                    this.parsedXML[root]["_"] = body.value;
                } else {
                    Object.assign(this.parsedXML[root], { _: body.value });
                }
            }
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
            if (Object.keys(this.parsedXML).length > 0) {
                const root = Object.keys(this.parsedXML)[0];
                if (this.parsedXML[root]["_"]) {
                    this.parsedXML[root]["_"] += text.value;
                } else {
                    Object.assign(this.parsedXML[root], { _: text.value });
                }
            }
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
            let element = new RoXMLElement();
            if (Object.keys(this.parsedXML).length > 0) {
                const root = Object.keys(this.parsedXML)[0];
                const newObj = { child: {} };
                Object.assign(this.parsedXML[root], newObj);
                element.parsedXML = newObj;
            }
            return element;
        },
    });

    /** Adds a new child element with the specified name and returns the new element. */
    private readonly addElement = new Callable("addElement", {
        signature: {
            args: [new StdlibArgument("name", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, name: BrsString) => {
            let element = new RoXMLElement();
            if (Object.keys(this.parsedXML).length > 0) {
                const root = Object.keys(this.parsedXML)[0];
                const newObj = { [name.value]: {} };
                Object.assign(this.parsedXML[root], newObj);
                element.parsedXML = newObj;
            }
            return element;
        },
    });

    /** Adds a new child element with the specified name and text from the specified body string, and returns the new element. */
    private readonly addElementWithBody = new Callable("addElementWithBody", {
        signature: {
            args: [new StdlibArgument("name", ValueKind.String), new StdlibArgument("body", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, name: BrsString, body: BrsString) => {
            let element = new RoXMLElement();
            if (Object.keys(this.parsedXML).length > 0) {
                const root = Object.keys(this.parsedXML)[0];
                const newObj = { [name.value]: { _: body.value } };
                Object.assign(this.parsedXML[root], newObj);
                element.parsedXML = newObj;
            }
            return element;
        },
    });

    /** Adds an attribute value to the element. */
    private readonly addAttribute = new Callable("addAttribute", {
        signature: {
            args: [new StdlibArgument("attr", ValueKind.String), new StdlibArgument("value", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, attr: BrsString, value: BrsString) => {
            if (Object.keys(this.parsedXML).length > 0) {
                const root = Object.keys(this.parsedXML)[0];
                if (this.parsedXML[root]["$"]) {
                    Object.assign(this.parsedXML[root]["$"], { [attr.value]: value.value });
                } else {
                    Object.assign(this.parsedXML[root], { $: { [attr.value]: value.value } });
                }
            }
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
            if (Object.keys(this.parsedXML).length > 0) {
                const root = Object.keys(this.parsedXML)[0];
                delete Object.assign(this.parsedXML, { [name.value]: this.parsedXML[root] })[root];
            } else {
                this.parsedXML = { [name.value]: {} };
            }
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
            let options = {
                headless: true,
                renderOpts: { pretty: false },
            };
            let builder = new xml2js.Builder(options);
            return new BrsString(header.value + builder.buildObject(this.parsedXML));
        },
    });

    /** Serializes the element to XML document text. */
    private readonly genXML = new Callable("genXML", {
        signature: {
            args: [new StdlibArgument("gen_header", ValueKind.Boolean)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, gen_header: BrsBoolean) => {
            let options = {
                headless: !gen_header.toBoolean(),
                renderOpts: { pretty: false },
                xmldec: {
                    version: "1.0",
                    encoding: "UTF-8",
                },
            };
            let builder = new xml2js.Builder(options);
            return new BrsString(builder.buildObject(this.parsedXML));
        },
    });

    /** Removes all sub-elements and clear the name of the element */
    private readonly clear = new Callable("clear", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.parsedXML = { root: {} };
            return BrsInvalid.Instance;
        },
    });
}
