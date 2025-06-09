import { ComponentDefinition, ComponentNode } from ".";
import { BrsDevice, Interpreter } from "..";
import {
    RoSGNode,
    ContentNode,
    Group,
    LayoutGroup,
    Panel,
    Rectangle,
    Label,
    ScrollingLabel,
    Font,
    Poster,
    ArrayGrid,
    RowList,
    MarkupGrid,
    MarkupList,
    Task,
    Timer,
    Audio,
    Video,
    Scene,
    Keyboard,
    MiniKeyboard,
    TextEditBox,
    BrsInvalid,
    RoMessagePort,
    brsValueOf,
    BrsString,
    RoAssociativeArray,
    BrsType,
    Callable,
    getBrsValueFromFieldType,
    rootObjects,
    Overhang,
    ButtonGroup,
    Button,
    Dialog,
    KeyboardDialog,
    LabelList,
    CheckList,
    RadioButtonList,
    StandardDialog,
    StandardProgressDialog,
    StdDlgContentArea,
    StdDlgTitleArea,
    StdDlgProgressItem,
    BusySpinner,
    RSGPalette,
    SoundEffect,
} from "../brsTypes";
import { TaskData } from "../common";

export enum SGNodeType {
    Node = "Node",
    Group = "Group",
    LayoutGroup = "LayoutGroup",
    ButtonGroup = "ButtonGroup",
    Button = "Button",
    Panel = "Panel",
    ListPanel = "ListPanel",
    GridPanel = "GridPanel",
    Dialog = "Dialog",
    KeyboardDialog = "KeyboardDialog",
    Rectangle = "Rectangle",
    Label = "Label",
    ScrollingLabel = "ScrollingLabel",
    ScrollableText = "ScrollableText",
    Font = "Font",
    Poster = "Poster",
    ArrayGrid = "ArrayGrid",
    LabelList = "LabelList",
    CheckList = "CheckList",
    RowList = "RowList",
    RadioButtonList = "RadioButtonList",
    MarkupList = "MarkupList",
    MarkupGrid = "MarkupGrid",
    ContentNode = "ContentNode",
    Task = "Task",
    Timer = "Timer",
    Scene = "Scene",
    Keyboard = "Keyboard",
    MiniKeyboard = "MiniKeyboard",
    TextEditBox = "TextEditBox",
    Overhang = "Overhang",
    RSGPalette = "RSGPalette",
    Video = "Video",
    Audio = "Audio",
    SoundEffect = "SoundEffect",
    Animation = "Animation",
    SequentialAnimation = "SequentialAnimation",
    ParallelAnimation = "ParallelAnimation",
    FloatFieldInterpolator = "FloatFieldInterpolator",
    StandardDialog = "StandardDialog",
    StandardProgressDialog = "StandardProgressDialog",
    StdDlgContentArea = "StdDlgContentArea",
    StdDlgTitleArea = "StdDlgTitleArea",
    StdDlgProgressItem = "StdDlgProgressItem",
    BusySpinner = "BusySpinner",
    ChannelStore = "ChannelStore",
}

export function isSGNodeType(value: string): value is SGNodeType {
    return Object.values(SGNodeType).includes(value as SGNodeType);
}

export class SGNodeFactory {
    private static additionalNodes = new Map<string, (name: string) => RoSGNode>();

    /**
     * Adds additional node/component types to the factory, so other software can extend brs if necessary.
     * This would allow other software using this to add other node/component types at runtime
     * For example, adding custom implementations of the built-in types, or
     * adding additional types (PinPad, BusySpinner, etc) that aren't here yet
     *
     * @static
     * @param types Array of pairs of [nodeTypeName, construction function], such that when a given nodeType is requested, the construction function is called and returns one of those components
     */
    public static addNodeTypes(types: [string, (name: string) => RoSGNode][]) {
        types.forEach(([nodeType, ctor]) => {
            this.additionalNodes.set(nodeType.toLowerCase(), ctor);
        });
    }

    public static createNode(nodeType: SGNodeType | string, nodeName?: string): RoSGNode | undefined {
        let name = nodeName || nodeType;
        const additionalCtor = this.additionalNodes.get(nodeType?.toLowerCase());
        if (additionalCtor) {
            return additionalCtor(name);
        }
        switch (nodeType) {
            case SGNodeType.Node:
                return new RoSGNode([], name);
            case SGNodeType.Group:
            case SGNodeType.ScrollableText:
                return new Group([], name);
            case SGNodeType.LayoutGroup:
                return new LayoutGroup([], name);
            case SGNodeType.Panel:
            case SGNodeType.ListPanel:
            case SGNodeType.GridPanel:
                return new Panel([], name);
            case SGNodeType.Button:
                return new Button([], name);
            case SGNodeType.ButtonGroup:
                return new ButtonGroup([], name);
            case SGNodeType.KeyboardDialog:
                return new KeyboardDialog([], name);
            case SGNodeType.Dialog:
                return new Dialog([], name);
            case SGNodeType.Rectangle:
                return new Rectangle([], name);
            case SGNodeType.Label:
                return new Label([], name);
            case SGNodeType.ScrollingLabel:
                return new ScrollingLabel([], name);
            case SGNodeType.Font:
                return new Font([], name);
            case SGNodeType.Poster:
                return new Poster([], name);
            case SGNodeType.ArrayGrid:
                return new ArrayGrid([], name);
            case SGNodeType.LabelList:
                return new LabelList([], name);
            case SGNodeType.CheckList:
                return new CheckList([], name);
            case SGNodeType.RadioButtonList:
                return new RadioButtonList([], name);
            case SGNodeType.RowList:
                return new RowList([], name);
            case SGNodeType.MarkupList:
                return new MarkupList([], name);
            case SGNodeType.MarkupGrid:
                return new MarkupGrid([], name);
            case SGNodeType.ContentNode:
                return new ContentNode(name);
            case SGNodeType.Task:
                return new Task([], name);
            case SGNodeType.Timer:
                return new Timer([], name);
            case SGNodeType.Scene:
                return new Scene([], name);
            case SGNodeType.Audio:
                return new Audio([], name);
            case SGNodeType.SoundEffect:
                return new SoundEffect([], name);
            case SGNodeType.Video:
                return new Video([], name);
            case SGNodeType.Keyboard:
                return new Keyboard([], name);
            case SGNodeType.MiniKeyboard:
                return new MiniKeyboard([], name);
            case SGNodeType.TextEditBox:
                return new TextEditBox([], name);
            case SGNodeType.Overhang:
                return new Overhang([], name);
            case SGNodeType.StandardDialog:
                return new StandardDialog([], name);
            case SGNodeType.StandardProgressDialog:
                return new StandardProgressDialog([], name);
            case SGNodeType.StdDlgContentArea:
                return new StdDlgContentArea([], name);
            case SGNodeType.StdDlgTitleArea:
                return new StdDlgTitleArea([], name);
            case SGNodeType.StdDlgProgressItem:
                return new StdDlgProgressItem([], name);
            case SGNodeType.BusySpinner:
                return new BusySpinner([], name);
            case SGNodeType.RSGPalette:
                return new RSGPalette([], name);
            default:
                if (isSGNodeType(nodeType)) {
                    // Temporarily until all node types are implemented
                    BrsDevice.stderr.write(
                        `warning,The roSGNode with type "${nodeType}" is not implemented yet, created as regular "Node".`
                    );
                    return new RoSGNode([], name);
                }
                return;
        }
    }

    /**
     * Checks to see if the given node type can be resolved by the Factory
     * That is, if it is a built in type or has been added at run time.
     *
     * @static
     * @param nodeType The name of node to resolve
     * @returns {boolean} true if that type is resolvable/constructable, false otherwise
     */
    public static canResolveNodeType(nodeType: SGNodeType | string): boolean {
        return this.additionalNodes.has(nodeType?.toLowerCase()) || nodeType in SGNodeType;
    }
}

/** Function to create a Node by its name defined on the XML file */
export function createNodeByType(interpreter: Interpreter, type: BrsString): RoSGNode | BrsInvalid {
    // If this is a built-in node component, then return it.
    let node = SGNodeFactory.createNode(type.value) ?? BrsInvalid.Instance;
    if (node instanceof BrsInvalid) {
        let typeDef = rootObjects.nodeDefMap.get(type.value.toLowerCase());
        if (typeDef) {
            node = initializeNode(interpreter, type, typeDef);
        } else {
            BrsDevice.stderr.write(
                `warning,BRIGHTSCRIPT: ERROR: roSGNode: Failed to create roSGNode with type ${
                    type.value
                }: ${interpreter.formatLocation()}`
            );
        }
    }
    if (node instanceof Task) {
        // thread id = 0 is the Main worker thread
        node.id = rootObjects.tasks.length + 1;
        rootObjects.tasks.push(node);
    }
    if (node instanceof RoSGNode && rootObjects.tasks.length === 1) {
        const task = rootObjects.tasks[0];
        if (task.thread && node.getNodeParent() === BrsInvalid.Instance) {
            node.setNodeParent(task);
        }
    }
    return node;
}

/** Function to create a Scene by its name defined on the XML file */
export function createSceneByType(interpreter: Interpreter, type: BrsString): RoSGNode | BrsInvalid {
    let typeDef = rootObjects.nodeDefMap.get(type.value.toLowerCase());
    updateTypeDefHierarchy(typeDef);
    if (typeDef && isSubtypeCheck(type.value, SGNodeType.Scene)) {
        return new Scene([], type.value);
    } else {
        BrsDevice.stderr.write(
            `warning,BRIGHTSCRIPT: ERROR: roSGNode: Failed to create a Scene with type ${
                type.value
            }: ${interpreter.formatLocation()}`
        );
    }
    return BrsInvalid.Instance;
}

export function customNodeExists(node: BrsString) {
    return rootObjects.nodeDefMap.has(node.value.toLowerCase());
}

/** Function to initialize Nodes with its Fields, Children and Environment */
export function initializeNode(
    interpreter: Interpreter,
    type: BrsString,
    typeDef?: ComponentDefinition,
    node?: RoSGNode
) {
    if (typeDef) {
        //use typeDef object to tack on all the bells & whistles of a custom node
        let typeDefStack = updateTypeDefHierarchy(typeDef);
        let currentEnv = typeDef.environment?.createSubEnvironment();

        // Start from the "basemost" component of the tree.
        typeDef = typeDefStack.pop();

        // If not already created, create the node.
        if (!node) {
            // If this extends a built-in node component, create it.
            node = SGNodeFactory.createNode(typeDef!.extends as SGNodeType, type.value);
        }
        // Default to Node as parent.
        if (!node) {
            node = new RoSGNode([], type.value);
        }
        let mPointer = new RoAssociativeArray([]);
        currentEnv?.setM(new RoAssociativeArray([]));

        // Add children, fields and call each init method starting from the
        // "basemost" component of the tree.
        while (typeDef) {
            let init: BrsType;

            interpreter.inSubEnv((subInterpreter) => {
                addChildren(subInterpreter, node!, typeDef!);
                addFields(subInterpreter, node!, typeDef!);
                return BrsInvalid.Instance;
            }, currentEnv);

            // Pre-render default state of the tree.
            if (node instanceof Scene) {
                node.renderNode(interpreter, [0, 0], 0, 1);
            }

            interpreter.inSubEnv((subInterpreter) => {
                init = subInterpreter.getCallableFunction("init");
                return BrsInvalid.Instance;
            }, typeDef.environment);

            interpreter.inSubEnv((subInterpreter) => {
                subInterpreter.environment.hostNode = node;

                mPointer.set(new BrsString("top"), node!);
                mPointer.set(new BrsString("global"), rootObjects.mGlobal);
                subInterpreter.environment.setM(mPointer);
                subInterpreter.environment.setRootM(mPointer);
                node!.m = mPointer;
                if (init instanceof Callable) {
                    init.call(subInterpreter);
                }
                return BrsInvalid.Instance;
            }, currentEnv);

            typeDef = typeDefStack.pop();
        }
        return node;
    } else {
        BrsDevice.stderr.write(
            `warning,BRIGHTSCRIPT: ERROR: roSGNode: Failed to initialize roSGNode with type ${
                type.value
            }: ${interpreter.formatLocation()}`
        );
        return BrsInvalid.Instance;
    }
}

/** Function to Initialize a Task on its own Worker thread */
export function initializeTask(interpreter: Interpreter, taskData: TaskData) {
    const type = taskData.name;
    let typeDef = rootObjects.nodeDefMap.get(type.toLowerCase());
    if (typeDef) {
        //use typeDef object to tack on all the bells & whistles of a custom node
        let typeDefStack = updateTypeDefHierarchy(typeDef);
        let currentEnv = typeDef.environment?.createSubEnvironment();

        // Start from the "basemost" component of the tree.
        typeDef = typeDefStack.pop();

        // Create the node.
        let node = SGNodeFactory.createNode(typeDef!.extends as SGNodeType, type) || new Task([], type);
        let mPointer = new RoAssociativeArray([]);
        currentEnv?.setM(new RoAssociativeArray([]));

        // Add children and fields starting from the "basemost" component of the tree.
        while (typeDef) {
            interpreter.inSubEnv((subInterpreter) => {
                addChildren(subInterpreter, node!, typeDef!);
                addFields(subInterpreter, node!, typeDef!);
                return BrsInvalid.Instance;
            }, currentEnv);

            interpreter.inSubEnv((subInterpreter) => {
                subInterpreter.environment.hostNode = node;

                mPointer.set(new BrsString("top"), node!);
                mPointer.set(new BrsString("global"), rootObjects.mGlobal);
                subInterpreter.environment.setM(mPointer);
                subInterpreter.environment.setRootM(mPointer);
                node!.m = mPointer;
                return BrsInvalid.Instance;
            }, currentEnv);

            typeDef = typeDefStack.pop();
        }
        // Load the task data into the node
        if (node instanceof Task) {
            node.id = taskData.id;
            node.thread = true;
            rootObjects.tasks.push(node);
            interpreter.environment.hostNode = node;
        }
        let port: RoMessagePort | null = null;
        if (taskData.m) {
            for (let [key, value] of Object.entries(taskData.m)) {
                if (key === "global" || key === "top") {
                    // Ignore special fields to be set later
                    continue;
                }
                const brsValue = brsValueOf(value);
                if (!port && brsValue instanceof RoMessagePort) {
                    console.debug("A port object was found!");
                    port = brsValue;
                }
                node.m.set(new BrsString(key), brsValue);
            }
        }
        if (taskData.m?.global) {
            restoreNode(interpreter, taskData.m.global, rootObjects.mGlobal, port);
        }
        if (taskData.m?.top) {
            restoreNode(interpreter, taskData.m.top, node, port);
        }
        return node;
    } else {
        BrsDevice.stderr.write(
            `warning,BRIGHTSCRIPT: ERROR: roSGNode: Failed to initialize Task with type ${type}: ${interpreter.formatLocation()}`
        );
        return BrsInvalid.Instance;
    }
}

/** Function to update the app components hierarchy map and return the stack for the passed TypeDef */
function updateTypeDefHierarchy(typeDef: ComponentDefinition | undefined) {
    let typeDefStack: ComponentDefinition[] = [];
    if (!typeDef) {
        return typeDefStack;
    }
    //use typeDef object to tack on all the bells & whistles of a custom node
    // Adding all component extensions to the stack to call init methods
    // in the correct order.
    typeDefStack.push(typeDef);
    while (typeDef) {
        // Add the current typedef to the subtypeHierarchy
        subtypeHierarchy.set(typeDef.name!.toLowerCase(), typeDef.extends || SGNodeType.Node);

        typeDef = rootObjects.nodeDefMap.get(typeDef.extends.toLowerCase());
        if (typeDef) typeDefStack.push(typeDef);
    }
    return typeDefStack;
}

/** Function to restore the node fields from the serialized object */
function restoreNode(interpreter: Interpreter, source: any, node: RoSGNode, port: RoMessagePort | null) {
    const observed = source["_observed_"];
    for (let [key, value] of Object.entries(source)) {
        if (key.startsWith("_") && key.endsWith("_") && key.length > 2) {
            // Ignore transfer metadata fields
            continue;
        }
        node.setFieldValue(key, brsValueOf(value));
        if (port && observed?.includes(key)) {
            if (node instanceof Task) {
                console.debug(`Adding observer port for top.${key}`);
            } else {
                console.debug(`Adding observer port for global.${key}`);
            }
            node.addObserver(interpreter, "unscoped", new BrsString(key), port);
        }
    }
}

/** Function to add Fields to a Node based on its definition */
function addFields(interpreter: Interpreter, node: RoSGNode, typeDef: ComponentDefinition) {
    let fields = typeDef.fields;
    for (let [fieldName, fieldValue] of Object.entries(fields)) {
        if (fieldValue instanceof Object) {
            if (fieldValue.alias?.includes(".")) {
                const childName = fieldValue.alias.split(".")[0];
                const childField = fieldValue.alias.split(".")[1];
                const childNode = node.findNodeById(node, new BrsString(childName));
                if (childNode instanceof RoSGNode) {
                    const field = childNode.getNodeFields().get(childField?.toLowerCase());
                    if (field) {
                        node.addNodeFieldAlias(fieldName, field, childName, childField);
                    } else {
                        let msg = `warning,Error creating XML component ${node.nodeSubtype}\n`;
                        msg += `-- Interface field alias failed: Node "${childName}" has no field named "${childField}"\n`;
                        msg += `-- Error found ${typeDef.xmlPath}`;
                        BrsDevice.stderr.write(msg);
                        return;
                    }
                } else {
                    let msg = `warning,Error creating XML component ${node.nodeSubtype}\n`;
                    msg += `-- Interface field alias failed: No node named ${childName}\n`;
                    msg += `-- Error found ${typeDef.xmlPath}`;
                    BrsDevice.stderr.write(msg);
                    return;
                }
            } else {
                const field = node.getNodeFields().get(fieldName.toLowerCase());
                if (field) {
                    let msg = `warning,Error creating XML component ${node.nodeSubtype}\n`;
                    msg += `-- Attempt to add duplicate field "${fieldName}" to RokuML component "${node.nodeSubtype}"\n`;
                    msg += `---- Extends node type "${typeDef.extends}" already has a field named ${fieldName}\n`;
                    msg += `-- Error found ${typeDef.xmlPath}`;
                    BrsDevice.stderr.write(msg);
                    return;
                }
                node.addNodeField(fieldName, fieldValue.type, fieldValue.alwaysNotify === "true");
                // set default value if it was specified in xml
                if (fieldValue.value) {
                    node.setFieldValue(fieldName, getBrsValueFromFieldType(fieldValue.type, fieldValue.value));
                }
            }

            // Add the onChange callback if it exists.
            if (fieldValue.onChange) {
                const field = node.getNodeFields().get(fieldName.toLowerCase());
                const callableFunction = interpreter.getCallableFunction(fieldValue.onChange);
                if (callableFunction instanceof Callable && field) {
                    // observers set via `onChange` can never be removed, despite RBI's documentation claiming
                    // that it is equivalent to calling the ifSGNodeField observeField() method".
                    field.addObserver("permanent", interpreter, callableFunction, node, new BrsString(fieldName));
                }
            }
        }
    }
}

/** Function to the the Children of a Node based on its definition */
function addChildren(interpreter: Interpreter, node: RoSGNode, typeDef: ComponentDefinition | ComponentNode) {
    const children = typeDef.children;
    const appendChild = node.getMethod("appendchild");

    for (let child of children) {
        const newChild = createNodeByType(interpreter, new BrsString(child.name));
        if (newChild instanceof RoSGNode) {
            const setField = newChild.getMethod("setfield");
            if (setField) {
                const nodeFields = newChild.getNodeFields();
                for (let [key, value] of Object.entries(child.fields)) {
                    const field = nodeFields.get(key.toLowerCase());
                    if (field) {
                        setField.call(
                            interpreter,
                            new BrsString(key),
                            // use the field type to construct the field value
                            getBrsValueFromFieldType(field.getType(), value)
                        );
                    }
                }
            }
            if (child.fields?.role) {
                const targetField = child.fields.role;
                if (node.getNodeFields().get(targetField)) {
                    if (child.children.length > 0) {
                        // we need to add the child's own children
                        addChildren(interpreter, newChild, child);
                    }
                    node.set(new BrsString(targetField), newChild, false);
                } else {
                    throw new Error(`Role/Field ${targetField} does not exist in ${node.getId()} node`);
                }
            } else if (appendChild) {
                appendChild.call(interpreter, newChild);
                if (child.children.length > 0) {
                    // we need to add the child's own children
                    addChildren(interpreter, newChild, child);
                }
            }
        }
    }
}

/* Hierarchy of all node Types. Used to discover if a current node is a subtype of another node */
export const subtypeHierarchy = new Map<string, string>();

/**
 *  Checks the node sub type hierarchy to see if the current node is a sub component of the given node type
 *
 * @param {string} currentNodeType
 * @param {string} checkType
 * @returns {boolean}
 */
export function isSubtypeCheck(currentNodeType: string, checkType: string): boolean {
    checkType = checkType.toLowerCase();
    currentNodeType = currentNodeType.toLowerCase();
    if (currentNodeType === checkType) {
        return true;
    }
    let nextNodeType = subtypeHierarchy.get(currentNodeType);
    if (nextNodeType == null) {
        return false;
    }
    return isSubtypeCheck(nextNodeType, checkType);
}

export function getNodeType(subType: string) {
    if (isSGNodeType(subType)) {
        return subType;
    }
    let nextNodeType = subtypeHierarchy.get(subType.toLowerCase());
    if (nextNodeType == null) {
        return SGNodeType.Node;
    } else if (isSGNodeType(nextNodeType)) {
        return nextNodeType;
    } else {
        return getNodeType(nextNodeType);
    }
}
