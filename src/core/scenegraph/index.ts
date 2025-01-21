import * as fs from "fs";
import * as path from "path";
import { XmlDocument, XmlElement } from "xmldoc";
import pSettle from "p-settle";
import * as fg from "fast-glob";
import { Environment } from "../interpreter/Environment";
import { BrsError } from "../Error";

interface FieldAttributes {
    id: string;
    type: string;
    alias?: string;
    value?: string;
    onChange?: string;
    alwaysNotify?: string;
}

interface ComponentFields {
    [key: string]: FieldAttributes;
}

interface FunctionAttributes {
    name: string;
}

interface ComponentFunctions {
    [key: string]: FunctionAttributes;
}

interface NodeField {
    [id: string]: string;
}

export interface ComponentNode {
    name: string;
    fields: NodeField;
    children: ComponentNode[];
}

export interface ComponentScript {
    type: string;
    uri?: string;
    content?: string;
}

export class ComponentDefinition {
    public contents?: string;
    public xmlNode?: XmlDocument;
    public name?: string;
    // indicates whether this component hierarchy has been processed before
    // which means the fields, children, and inherited functions are correctly set
    public processed: boolean = false;
    public fields: ComponentFields = {};
    public functions: ComponentFunctions = {};
    public children: ComponentNode[] = [];
    public scripts: ComponentScript[] = [];
    public environment: Environment | undefined;

    constructor(readonly xmlPath: string) {}

    async parse(): Promise<ComponentDefinition> {
        try {
            this.contents = fs.readFileSync(this.xmlPath, "utf-8");
            this.xmlNode = new XmlDocument(this.contents);
            this.name = this.xmlNode.attr.name;

            return Promise.resolve(this);
        } catch (err) {
            // TODO: provide better parse error reporting
            //   cases:
            //     * file read error
            //     * XML parse error
            return Promise.reject(this);
        }
    }

    public get extends(): string {
        return this.xmlNode ? this.xmlNode.attr.extends : "";
    }
}

export async function getComponentDefinitionMap(
    rootDir: string = "",
    additionalDirs: string[] = [],
    libraryName?: string
) {
    let searchString = "{components, }";
    if (additionalDirs.length) {
        searchString = `{components,${additionalDirs.join(",")}}`;
    }
    const componentsPattern = path
        .join(rootDir, searchString, "**", "*.xml")
        .replace(/[\/\\]+/g, path.posix.sep);
    const xmlFiles: string[] = fg.sync(componentsPattern, {});

    let defs = xmlFiles.map((file) => new ComponentDefinition(file));
    let parsedPromises = defs.map(async (def) => def.parse());

    return processXmlTree(pSettle(parsedPromises), rootDir, libraryName);
}

async function processXmlTree(
    settledPromises: Promise<pSettle.SettledResult<ComponentDefinition>[]>,
    rootDir: string,
    libraryName?: string
) {
    let nodeDefs = await settledPromises;
    let nodeDefMap = new Map<string, ComponentDefinition>();

    // create map of just ComponentDefinition objects
    nodeDefs.map((item) => {
        if (item.isFulfilled && !item.isRejected) {
            let name = item.value?.name?.toLowerCase();
            if (libraryName) {
                name = `${libraryName.toLowerCase()}:${name}`;
            }
            if (name) {
                nodeDefMap.set(name, item.value!);
            }
        }
    });

    // recursively create an inheritance stack for each component def and build up
    // the component backwards from most extended component first
    let inheritanceStack: ComponentDefinition[] = [];

    nodeDefMap.forEach((nodeDef) => {
        if (nodeDef && nodeDef.processed === false) {
            let xmlNode = nodeDef.xmlNode;
            inheritanceStack.push(nodeDef);
            //builds inheritance stack
            while (xmlNode && xmlNode.attr.extends) {
                let superNodeDef = nodeDefMap.get(xmlNode.attr.extends?.toLowerCase());
                if (superNodeDef) {
                    inheritanceStack.push(superNodeDef);
                    xmlNode = superNodeDef.xmlNode;
                } else {
                    xmlNode = undefined;
                }
            }

            let inheritedFunctions: ComponentFunctions = {};
            // pop the stack & build our component
            // we can safely assume nodes are valid ComponentDefinition objects
            while (inheritanceStack.length > 0) {
                let newNodeDef = inheritanceStack.pop();
                if (newNodeDef) {
                    if (newNodeDef.processed) {
                        inheritedFunctions = newNodeDef.functions;
                    } else {
                        let nodeInterface = processInterface(newNodeDef.xmlNode!);
                        inheritedFunctions = { ...inheritedFunctions, ...nodeInterface.functions };

                        // Use inherited functions in children so that we can correctly find functions in callFunc.
                        newNodeDef.functions = inheritedFunctions;
                        newNodeDef.fields = nodeInterface.fields;
                        newNodeDef.processed = true;
                    }
                }
            }
        }
    });

    for (let nodeDef of nodeDefMap.values()) {
        let xmlNode = nodeDef.xmlNode;
        if (xmlNode) {
            nodeDef.children = getChildren(xmlNode);
            nodeDef.scripts = await getScripts(xmlNode, nodeDef, rootDir);
        }
    }

    return nodeDefMap;
}

/**
 * Returns all the fields and functions found in the Xml node.
 * @param node Xml node with fields
 * @return { fields, functions }: the fields and functions parsed as
 * ComponentFields and ComponentFunctions respectively
 */
function processInterface(node: XmlDocument): {
    fields: ComponentFields;
    functions: ComponentFunctions;
} {
    let iface = node.childNamed("interface");
    let fields: ComponentFields = {};
    let functions: ComponentFunctions = {};

    if (!iface) {
        return { fields, functions };
    }

    iface.eachChild((child) => {
        if (child.name === "field") {
            fields[child.attr.id] = {
                type: child.attr.type,
                id: child.attr.id,
                alias: child.attr.alias,
                onChange: child.attr.onChange,
                alwaysNotify: child.attr.alwaysNotify,
                value: child.attr.value,
            };
        } else if (child.name === "function") {
            functions[child.attr.name] = {
                name: child.attr.name,
            };
        }
    });

    return { fields, functions };
}

/**
 * Given a node as a XmlDocument it will get all the children and return
 * them parsed.
 * @param node The XmlDocument that has the children.
 * @returns The parsed children
 */
function getChildren(node: XmlDocument): ComponentNode[] {
    let xmlElement = node.childNamed("children");

    if (!xmlElement) {
        return [];
    }

    let children: ComponentNode[] = [];
    parseChildren(xmlElement, children);

    return children;
}

/**
 * Parses children in the XmlElement converting then into an object
 * that follows the ComponentNode interface. This process makes
 * the tree creation simpler.
 * @param element The XmlElement that has the children to be parsed
 * @param children The array where parsed children will be added
 */
function parseChildren(element: XmlElement, children: ComponentNode[]): void {
    element.eachChild((child) => {
        let childComponent: ComponentNode = {
            name: child.name,
            fields: child.attr,
            children: [],
        };

        if (child.children.length > 0) {
            parseChildren(child, childComponent.children);
        }

        children.push(childComponent);
    });
}

async function getScripts(
    node: XmlDocument,
    nodeDef: ComponentDefinition,
    rootDir: string
): Promise<ComponentScript[]> {
    let scripts = node.childrenNamed("script");
    let componentScripts: ComponentScript[] = [];

    for (let script of scripts) {
        if (script.attr.uri && script.val) {
            return Promise.reject({
                message: BrsError.format(
                    `<script> element cannot contain both internal and external source`,
                    getScriptTagLocation(nodeDef, script)
                ).trim(),
            });
        } else if (script.attr?.uri) {
            let absoluteUri = await getScriptUri(script, nodeDef, rootDir);
            componentScripts.push({
                type: script.attr.type,
                uri: absoluteUri.href,
            });
        } else if (typeof script.val === "string") {
            componentScripts.push({
                type: script.attr.type,
                content: script.val,
            });
        }
    }
    return componentScripts;
}

async function getScriptUri(
    script: XmlElement,
    nodeDef: ComponentDefinition,
    rootDir: string
): Promise<URL> {
    let absoluteUri: URL;
    let posixRoot = rootDir.replace(/[\/\\]+/g, path.posix.sep);
    let posixPath = nodeDef.xmlPath.replace(/[\/\\]+/g, path.posix.sep);

    try {
        if (process.platform === "win32") {
            posixRoot = posixRoot.replace(/^[a-zA-Z]:/, "");
            posixPath = posixPath.replace(/^[a-zA-Z]:/, "");
        }
        absoluteUri = new URL(script.attr.uri, `pkg:/${path.posix.relative(posixRoot, posixPath)}`);
    } catch (err) {
        return Promise.reject({
            message: BrsError.format(
                `Invalid path '${script.attr.uri}' found in <script/> tag`,
                getScriptTagLocation(nodeDef, script)
            ).trim(),
        });
    }
    return absoluteUri;
}

function getScriptTagLocation(nodeDef: ComponentDefinition, script: XmlElement) {
    const tag = nodeDef.contents?.substring(script.startTagPosition, script.position) ?? "";
    const tagLines = tag.split("\n");
    const leadingLines = nodeDef.contents?.substring(0, script.startTagPosition).split("\n") ?? [];
    const start = {
        line: leadingLines.length,
        column: columnsInLastLine(leadingLines),
    };
    return {
        file: nodeDef.xmlPath,
        start: start,
        end: {
            line: start.line + tagLines.length - 1,
            column: start.column + columnsInLastLine(tagLines),
        },
    };
}

/**
 * Returns the number of columns occupied by the final line in an array of lines as parsed by `xmldoc`.
 * xmldoc parses positions to ignore `\n` characters, which is pretty confusing.  This function
 * compensates for that.
 *
 * @param lines an array of strings, where each is a line from an XML document
 *
 * @return the corrected column number for the last line of text as parsed by `xmlDoc`
 */
function columnsInLastLine(lines: string[]): number {
    return lines[lines.length - 1].length + lines.length - 1;
}
