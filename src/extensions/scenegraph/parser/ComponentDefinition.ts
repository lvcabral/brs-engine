import {
    Environment,
    BrsError,
    FileSystem,
    ExecutionOptions,
    Interpreter,
    BrsInvalid,
    RoAssociativeArray,
} from "brs-engine";
import { ComponentScopeResolver } from "./ComponentScopeResolver";
import * as path from "path";
import { XmlDocument, XmlElement } from "xmldoc";
import pSettle, { PromiseResult } from "p-settle";

/**
 * Represents the attributes of a field within a component.
 */
interface FieldAttributes {
    id: string;
    type: string;
    alias?: string;
    value?: string;
    onChange?: string;
    alwaysNotify?: string;
}

/**
 * A map of field IDs to their corresponding attributes.
 */
interface ComponentFields {
    [key: string]: FieldAttributes;
}

/**
 * Represents the attributes of a function within a component.
 */
interface FunctionAttributes {
    name: string;
}

/**
 * A map of function names to their corresponding attributes.
 */
interface ComponentFunctions {
    [key: string]: FunctionAttributes;
}

/**
 * Represents the fields of a node within a component.
 */
interface NodeField {
    [id: string]: string;
}

/**
 * Represents a child node within a component.
 */
export interface ComponentNode {
    name: string;
    fields: NodeField;
    children: ComponentNode[];
}

/**
 * Represents a script associated with a component.
 */
export interface ComponentScript {
    type: string;
    uri?: string;
    xmlPath?: string;
    content?: string;
}

// Singleton file system instance for reading component XML and script files.
let fs: FileSystem | undefined;

/**
 * Represents a component definition parsed from an XML file.
 * Includes methods for parsing and processing component definitions.
 *
 **/
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
            if (fs === undefined) {
                throw new Error("FileSystem not set");
            }
            this.contents = fs.readFileSync(this.xmlPath, "utf-8");
            this.xmlNode = new XmlDocument(this.contents ?? "");
            this.name = this.xmlNode.attr.name;

            return this;
        } catch (err) {
            // TODO: provide better parse error reporting
            //   cases:
            //     * file read error
            //     * XML parse error
            throw err;
        }
    }

    public get extends(): string {
        return this.xmlNode?.attr?.extends ?? "";
    }

    public get initialFocus(): string {
        return this.xmlNode?.attr?.initialFocus ?? "";
    }
}

/**
 * Retrieves a map of component definitions from the specified directories.
 * @param fileSystem The file system instance to use for reading files.
 * @param additionalDirs Additional directories to search for component XML files.
 * @param libraryName Optional library name to prefix component names.
 * @returns A promise that resolves to a map of component definitions.
 */
export async function getComponentDefinitionMap(
    fileSystem: FileSystem,
    additionalDirs: string[] = [],
    libraryName?: string
) {
    fs = fileSystem;

    const xmlFiles: string[] = [];
    const directories = ["components", ...additionalDirs];
    for (const dir of directories) {
        const dirPath = path.join("pkg:/", dir);
        if (fs?.existsSync(dirPath)) {
            xmlFiles.push(...fs.findSync(dirPath, "xml"));
        }
    }

    const defs = xmlFiles.map((file) => new ComponentDefinition(file));
    const parsedPromises = defs.map(async (def) => def.parse());
    return processXmlTree(pSettle(parsedPromises), libraryName);
}

/**
 * Processes the XML tree of component definitions and builds a map of component definitions.
 * @param settledPromises A promise that resolves to an array of settled component definition promises.
 * @param libraryName Optional library name to prefix component names.
 * @returns A promise that resolves to a map of component definitions.
 */
async function processXmlTree(settledPromises: Promise<PromiseResult<ComponentDefinition>[]>, libraryName?: string) {
    const nodeDefs = await settledPromises;
    const nodeDefMap = new Map<string, ComponentDefinition>();

    // short circuit if no components are found
    if (nodeDefs.length === 0) {
        return nodeDefMap;
    }

    // create map of just ComponentDefinition objects
    for (const item of nodeDefs) {
        if (item.isFulfilled && !item.isRejected) {
            let name = item.value?.name?.toLowerCase();
            if (libraryName) {
                name = `${libraryName.toLowerCase()}:${name}`;
            }
            if (name) {
                nodeDefMap.set(name, item.value!);
            }
        }
    }

    // recursively create an inheritance stack for each component def and build up
    // the component backwards from most extended component first
    let inheritanceStack: ComponentDefinition[] = [];

    for (const nodeDef of nodeDefMap.values()) {
        if (nodeDef?.processed === false) {
            let xmlNode = nodeDef.xmlNode;
            inheritanceStack.push(nodeDef);
            //builds inheritance stack
            while (xmlNode?.attr?.extends) {
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
        if (nodeDef?.xmlNode) {
            nodeDef.children = getChildren(nodeDef.xmlNode);
            nodeDef.scripts = await getScripts(nodeDef.xmlNode, nodeDef);
        }
    }

    return nodeDefMap;
}

/**
 * Builds out all the sub-environments for the given components. Components are saved into the calling interpreter
 * instance. This function will mutate the state of the calling interpreter.
 * @param interpreter The interpreter where components will be registered
 * @param componentMap Map of all components to be assigned to this interpreter
 * @param manifest The manifest map for the current running application
 * @param options Execution options for the interpreter
 */
export async function setupInterpreterWithSubEnvs(
    interpreter: Interpreter,
    componentMap: Map<string, ComponentDefinition>,
    manifest: Map<string, string>,
    options: Partial<ExecutionOptions>
) {
    if (!fs) {
        throw new Error("FileSystem not set");
    }
    const entryPoint = options.entryPoint ?? false;
    const componentScopeResolver = new ComponentScopeResolver(componentMap, fs, manifest);
    await pSettle(
        Array.from(componentMap).map(async (componentKV) => {
            const [_, component] = componentKV;
            component.environment = interpreter.environment.createSubEnvironment(/* includeModuleScope */ false);
            const statements = await componentScopeResolver.resolve(component);
            interpreter.inSubEnv((subInterpreter) => {
                const componentMPointer = new RoAssociativeArray([]);
                subInterpreter.options.entryPoint = false;
                subInterpreter.environment.setM(componentMPointer);
                subInterpreter.environment.setRootM(componentMPointer);
                subInterpreter.exec(statements);
                return BrsInvalid.Instance;
            }, component.environment);
        })
    );
    interpreter.options.entryPoint = entryPoint;
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
    const iface = node.childNamed("interface");
    const fields: ComponentFields = {};
    const functions: ComponentFunctions = {};

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
    const xmlElement = node.childNamed("children");

    if (!xmlElement) {
        return [];
    }

    const children: ComponentNode[] = [];
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
        const childComponent: ComponentNode = {
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

/**
 * Retrieves all scripts defined in the component XML node.
 * @param node The XmlDocument node representing the component
 * @param nodeDef The ComponentDefinition for error reporting
 * @returns An array of ComponentScript objects
 */
async function getScripts(node: XmlDocument, nodeDef: ComponentDefinition): Promise<ComponentScript[]> {
    const scripts = node.childrenNamed("script");
    const componentScripts: ComponentScript[] = [];

    for (const script of scripts) {
        if (script.attr.uri && script.val) {
            throw new Error(
                BrsError.format(
                    `<script> element cannot contain both internal and external source`,
                    getScriptTagLocation(nodeDef, script)
                ).trim()
            );
        } else if (script.attr?.uri) {
            let absoluteUri = await getScriptUri(script, nodeDef);
            componentScripts.push({
                type: script.attr.type,
                uri: absoluteUri,
            });
        } else if (typeof script.val === "string") {
            componentScripts.push({
                type: script.attr.type,
                content: script.val,
                xmlPath: nodeDef.xmlPath,
            });
        }
    }
    return componentScripts;
}

/**
 * Resolves the absolute URI for a script defined in a component.
 * @param script The XmlElement representing the <script> tag
 * @param nodeDef The ComponentDefinition for error reporting
 * @returns The absolute URI as a string
 */
async function getScriptUri(script: XmlElement, nodeDef: ComponentDefinition): Promise<string> {
    let absoluteUri: string;

    try {
        if (script.attr.uri.startsWith("pkg:/")) {
            absoluteUri = script.attr.uri;
        } else {
            let posixPath = path.dirname(nodeDef.xmlPath.replaceAll(/[/\\]+/g, path.posix.sep));
            if (process.platform === "win32") {
                posixPath = posixPath.replace(/^[a-zA-Z]:/, "");
            }
            absoluteUri = path.join(posixPath, script.attr.uri);
        }
    } catch (err) {
        throw new Error(
            BrsError.format(
                `Invalid path '${script.attr.uri}' found in <script/> tag`,
                getScriptTagLocation(nodeDef, script)
            ).trim()
        );
    }
    return absoluteUri;
}

/**
 * Retrieves the location of a <script> tag within a component XML for error reporting.
 * @param nodeDef The ComponentDefinition containing the script
 * @param script The XmlElement representing the <script> tag
 * @returns An object with file, start, and end positions
 */
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
