import * as xml2js from "xml2js";

import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsComponent, BrsIterable } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RoAssociativeArray } from "./RoAssociativeArray";
import { RoList } from "./RoList";
import { RoXMLList } from "./RoXMLList";

export class RoXMLElement extends BrsComponent implements BrsValue, BrsIterable {
    readonly kind = ValueKind.Object;
    parsedXML: any;
    constructor() {
        super("roXMLElement");
        this.parsedXML = {};
        this.registerMethods([
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
            // this.genXMLHdr,
            // this.isName,
            // this.hasAttribute,
            // this.setBody,
            // this.addBodyElement,
            // this.addElement,
            // this.addElementWithBody,
            // this.addText,
            // this.addAttribute,
            // this.setName,
            this.clear,
        ]);
    }

    toString(parent?: BrsType): string {
        return "<Component: roXMLElement>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    getElements() {
        return Array.from([]);
    }

    get(index: BrsType) {
        if (index.kind !== ValueKind.String) {
            throw new Error("XML Element indexes must be strings");
        }

        return this.getMethod(index.value) || this.namedElements(index.value, true);
    }

    set(index: BrsType, value: BrsType) {
        if (index.kind !== ValueKind.String) {
            throw new Error("Associative array indexes must be strings");
        }
        //this.elements.set(index.value.toLowerCase(), value);
        return BrsInvalid.Instance;
    }

    attributes() {
        let attributes = new RoAssociativeArray([]);
        if (Object.keys(this.parsedXML).length > 0) {
            let root = Object.keys(this.parsedXML)[0];
            if (this.parsedXML.$ || this.parsedXML[root].$) {
                let attrs = this.parsedXML.$ || this.parsedXML[root].$;
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
        if (Object.keys(this.parsedXML).length > 0) {
            name = Object.keys(this.parsedXML)[0];
        }
        return new BrsString(name);
    }

    text() {
        let text = "";
        let root = Object.keys(this.parsedXML)[0];
        if (this.parsedXML[root]._) {
            text = this.parsedXML[root]._;
        }
        return new BrsString(text);
    }

    childElements() {
        let elements = new RoXMLList();
        if (Object.keys(this.parsedXML).length > 0) {
            let root = Object.keys(this.parsedXML)[0];
            for (let [key, value] of Object.entries(this.parsedXML[root])) {
                if (key !== "$" && key !== "_") {
                    if (value instanceof Array) {
                        value.forEach(item => {
                            let element = new RoXMLElement();
                            element.parsedXML = item;
                            elements.add(element);
                        });
                    }
                }
            }
        }
        return elements;
    }

    childNodes() {
        let nodes = new RoList();
        if (Object.keys(this.parsedXML).length > 0) {
            let root = Object.keys(this.parsedXML)[0];
            for (let [key, value] of Object.entries(this.parsedXML[root])) {
                if (key !== "$") {
                    if (value instanceof Array) {
                        value.forEach(item => {
                            let element = new RoXMLElement();
                            element.parsedXML = item;
                            nodes.add(element);
                        });
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
        if (Object.keys(this.parsedXML).length > 0) {
            let root = Object.keys(this.parsedXML)[0];
            for (let [key, value] of Object.entries(this.parsedXML[root])) {
                if (ci) {
                    key = key.toLocaleLowerCase();
                }
                if (key === name) {
                    if (value instanceof Array) {
                        value.forEach(item => {
                            let element = new RoXMLElement();
                            element.parsedXML = item;
                            elements.add(element);
                        });
                    }
                }
            }
        }
        return elements;
    }

    /** Parse a string of XML. Returns true if successful. In that case, XML elements are available using other methods */
    private parse = new Callable("parse", {
        signature: {
            args: [new StdlibArgument("xml", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, xml: BrsString) => {
            let result = false;
            let xmlParser = new xml2js.Parser();
            let parsedXML;
            xmlParser.parseString(xml.value, function(err: Error, parsed: any) {
                if (err) {
                    console.error("Error parsing XML:" + err.message);
                } else if (parsed) {
                    parsedXML = parsed;
                    console.log(parsed);
                    result = true;
                } else {
                    console.error("Error parsing XML: Empty input");
                }
            });
            this.parsedXML = parsedXML;
            return BrsBoolean.from(result);
        },
    });

    /** Returns the body of the element. If the element contains child elements,
     * returns an roXMLList representing those elements, like GetChildElements().
     * If there are no children but the element contains text, returns an roString like GetText().
     * If the element is empty, GetBody() returns invalid */
    private getBody = new Callable("getBody", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
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
    private getChildElements = new Callable("getChildElements", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            let elements = this.childElements();
            if (elements.length() > 0) {
                return elements;
            }
            return BrsInvalid.Instance;
        },
    });

    /** Returns an roXMLList of child elements. If there are no child elements, returns invalid. */
    private getChildNodes = new Callable("getChildNodes", {
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
    private getNamedElements = new Callable("getNamedElements", {
        signature: {
            args: [new StdlibArgument("name", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, name: BrsString) => {
            return this.namedElements(name.value, false);
        },
    });

    /** Same as GetNamedElements except the name matching is case-insensitive. */
    private getNamedElementsCi = new Callable("getNamedElementsCi", {
        signature: {
            args: [new StdlibArgument("name", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, name: BrsString) => {
            return this.namedElements(name.value, true);
        },
    });

    /** Returns an Associative Array representing the XML attributes of the element */
    private getAttributes = new Callable("getAttributes", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            return this.attributes();
        },
    });

    /** Returns the name of the element */
    private getName = new Callable("getName", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return this.name();
        },
    });

    /** Returns any text contained in the element. */
    private getText = new Callable("getText", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return this.text();
        },
    });

    /** Serializes the element to XML document text. */
    private genXML = new Callable("genXML", {
        signature: {
            args: [new StdlibArgument("gen_header", ValueKind.Boolean)],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter, gen_header: BrsBoolean) => {
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
    private clear = new Callable("clear", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter) => {
            this.parsedXML = {};
            return BrsInvalid.Instance;
        },
    });
}
