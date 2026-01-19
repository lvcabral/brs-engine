import {
    BrsDevice,
    Interpreter,
    TaskData,
    BrsBoolean,
    BrsInvalid,
    BrsString,
    BrsType,
    Callable,
    Double,
    Float,
    Int32,
    Int64,
    isInvalid,
    RoArray,
    RoAssociativeArray,
    RoInvalid,
    RoMessagePort,
    Uninitialized,
    ValueKind,
    RuntimeError,
} from "brs-engine";
import {
    ArrayGrid,
    Audio,
    BusySpinner,
    Button,
    ButtonGroup,
    ChannelStore,
    CheckList,
    ContentNode,
    Dialog,
    Font,
    Group,
    MaskGroup,
    Keyboard,
    KeyboardDialog,
    Label,
    LabelList,
    LayoutGroup,
    InfoPane,
    MarkupGrid,
    MarkupList,
    MiniKeyboard,
    Node,
    Overhang,
    Panel,
    Poster,
    PosterGrid,
    RadioButtonList,
    Rectangle,
    RowList,
    RSGPalette,
    Scene,
    ScrollingLabel,
    SGNodeType,
    SoundEffect,
    StandardDialog,
    StandardProgressDialog,
    StdDlgContentArea,
    StdDlgProgressItem,
    StdDlgTitleArea,
    Task,
    TextEditBox,
    Timer,
    TrickPlayBar,
    Video,
    ZoomRowList,
    Animation,
    ParallelAnimation,
    SequentialAnimation,
    FloatFieldInterpolator,
    ColorFieldInterpolator,
    Vector2DFieldInterpolator,
} from "../nodes";
import { ComponentDefinition, ComponentNode } from "../parser/ComponentDefinition";
import { brsValueOf, toSGNode } from "./Serializer";
import { sgRoot } from "../SGRoot";
import { convertHexColor } from "../SGUtil";
import Long from "long";

/**
 * Checks if a given string value is a valid SGNodeType.
 * @param value String to check against SGNodeType enum values
 * @returns True if the value matches a SGNodeType (case-insensitive), false otherwise
 */
export function isSGNodeType(value: string): value is SGNodeType {
    const lowerValue = value.toLowerCase();
    return Object.values(SGNodeType).some((enumVal) => enumVal.toLowerCase() === lowerValue);
}

export class SGNodeFactory {
    private static readonly additionalNodes = new Map<string, (name: string) => Node>();

    /**
     * Adds additional node/component types to the factory, so other software can extend brs if necessary.
     * This would allow other software using this to add other node/component types at runtime
     * For example, adding custom implementations of the built-in types, or
     * adding additional types (PinPad, BusySpinner, etc) that aren't here yet
     *
     * @static
     * @param types Array of pairs of [nodeTypeName, construction function], such that when a given nodeType is requested, the construction function is called and returns one of those components
     */
    public static addNodeTypes(types: [string, (name: string) => Node][]) {
        for (const [nodeType, ctor] of types) {
            this.additionalNodes.set(nodeType.toLowerCase(), ctor);
        }
    }

    /**
     * Creates a SceneGraph node of the specified type.
     * Supports built-in node types and custom nodes added via addNodeTypes.
     * @param nodeType Type of node to create (SGNodeType enum or string)
     * @param nodeName Optional name for the node (defaults to nodeType)
     * @returns Created node instance or undefined if type is not recognized
     */
    public static createNode(nodeType: SGNodeType | string, nodeName?: string): Node | undefined {
        const name = nodeName || nodeType;
        if (isSGNodeType(nodeType)) {
            BrsDevice.addNodeStat(nodeType);
        }
        const additionalCtor = this.additionalNodes.get(nodeType?.toLowerCase());
        if (additionalCtor) {
            return additionalCtor(name);
        }
        switch (nodeType.toLowerCase()) {
            case SGNodeType.Node.toLowerCase():
                return new Node([], name);
            case SGNodeType.Group.toLowerCase():
            case SGNodeType.TargetGroup.toLowerCase():
            case SGNodeType.ScrollableText.toLowerCase():
                return new Group([], name);
            case SGNodeType.MaskGroup.toLowerCase():
                return new MaskGroup([], name);
            case SGNodeType.LayoutGroup.toLowerCase():
                return new LayoutGroup([], name);
            case SGNodeType.Panel.toLowerCase():
            case SGNodeType.ListPanel.toLowerCase():
            case SGNodeType.GridPanel.toLowerCase():
                return new Panel([], name);
            case SGNodeType.Button.toLowerCase():
                return new Button([], name);
            case SGNodeType.ButtonGroup.toLowerCase():
                return new ButtonGroup([], name);
            case SGNodeType.KeyboardDialog.toLowerCase():
                return new KeyboardDialog([], name);
            case SGNodeType.Dialog.toLowerCase():
                return new Dialog([], name);
            case SGNodeType.Rectangle.toLowerCase():
                return new Rectangle([], name);
            case SGNodeType.Label.toLowerCase():
                return new Label([], name);
            case SGNodeType.InfoPane.toLowerCase():
                return new InfoPane([], name);
            case SGNodeType.ScrollingLabel.toLowerCase():
                return new ScrollingLabel([], name);
            case SGNodeType.Font.toLowerCase():
                return new Font([], name);
            case SGNodeType.Poster.toLowerCase():
                return new Poster([], name);
            case SGNodeType.PosterGrid.toLowerCase():
                return new PosterGrid([], name);
            case SGNodeType.ArrayGrid.toLowerCase():
                return new ArrayGrid([], name);
            case SGNodeType.LabelList.toLowerCase():
                return new LabelList([], name);
            case SGNodeType.CheckList.toLowerCase():
                return new CheckList([], name);
            case SGNodeType.RadioButtonList.toLowerCase():
                return new RadioButtonList([], name);
            case SGNodeType.RowList.toLowerCase():
                return new RowList([], name);
            case SGNodeType.ZoomRowList.toLowerCase():
                return new ZoomRowList([], name);
            case SGNodeType.MarkupList.toLowerCase():
                return new MarkupList([], name);
            case SGNodeType.MarkupGrid.toLowerCase():
                return new MarkupGrid([], name);
            case SGNodeType.ContentNode.toLowerCase():
                return new ContentNode(name);
            case SGNodeType.Task.toLowerCase():
                return new Task([], name);
            case SGNodeType.Timer.toLowerCase():
                return new Timer([], name);
            case SGNodeType.Scene.toLowerCase():
                return new Scene([], name);
            case SGNodeType.Audio.toLowerCase():
                return new Audio([], name);
            case SGNodeType.SoundEffect.toLowerCase():
                return new SoundEffect([], name);
            case SGNodeType.Video.toLowerCase():
                return new Video([], name);
            case SGNodeType.TrickPlayBar.toLowerCase():
                return new TrickPlayBar([], name);
            case SGNodeType.Keyboard.toLowerCase():
                return new Keyboard([], name);
            case SGNodeType.MiniKeyboard.toLowerCase():
                return new MiniKeyboard([], name);
            case SGNodeType.TextEditBox.toLowerCase():
                return new TextEditBox([], name);
            case SGNodeType.Overhang.toLowerCase():
                return new Overhang([], name);
            case SGNodeType.StandardDialog.toLowerCase():
                return new StandardDialog([], name);
            case SGNodeType.StandardProgressDialog.toLowerCase():
                return new StandardProgressDialog([], name);
            case SGNodeType.StdDlgContentArea.toLowerCase():
                return new StdDlgContentArea([], name);
            case SGNodeType.StdDlgTitleArea.toLowerCase():
                return new StdDlgTitleArea([], name);
            case SGNodeType.StdDlgProgressItem.toLowerCase():
                return new StdDlgProgressItem([], name);
            case SGNodeType.BusySpinner.toLowerCase():
                return new BusySpinner([], name);
            case SGNodeType.RSGPalette.toLowerCase():
                return new RSGPalette([], name);
            case SGNodeType.ChannelStore.toLowerCase():
                return new ChannelStore([], name);
            case SGNodeType.Animation.toLowerCase():
                return new Animation([], name);
            case SGNodeType.ParallelAnimation.toLowerCase():
                return new ParallelAnimation([], name);
            case SGNodeType.SequentialAnimation.toLowerCase():
                return new SequentialAnimation([], name);
            case SGNodeType.FloatFieldInterpolator.toLowerCase():
                return new FloatFieldInterpolator([], name);
            case SGNodeType.ColorFieldInterpolator.toLowerCase():
                return new ColorFieldInterpolator([], name);
            case SGNodeType.Vector2DFieldInterpolator.toLowerCase():
                return new Vector2DFieldInterpolator([], name);
            default:
                if (isSGNodeType(nodeType)) {
                    // Temporarily until all node types are implemented
                    BrsDevice.stderr.write(
                        `warning,The roSGNode with type "${nodeType}" is not implemented yet, created as regular "Node".`
                    );
                    return new Node([], name);
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
        return this.additionalNodes.has(nodeType?.toLowerCase()) || isSGNodeType(nodeType);
    }
}

/**
 * Creates a node by its type name as defined in XML component files.
 * Handles both built-in node types and custom component definitions.
 * Automatically registers Task nodes in the task list.
 * @param type Type name of the node to create
 * @param interpreter Optional interpreter instance for custom component initialization
 * @returns Created node instance or BrsInvalid if creation fails
 */
export function createNodeByType(type: string, interpreter?: Interpreter): Node | BrsInvalid {
    // If this is a built-in node component, then return it.
    let node = SGNodeFactory.createNode(type) ?? BrsInvalid.Instance;
    if (node instanceof BrsInvalid) {
        let typeDef = sgRoot.nodeDefMap.get(type.toLowerCase());
        if (typeDef && interpreter instanceof Interpreter) {
            node = initializeNode(interpreter, type, typeDef);
        } else if (typeDef) {
            const typeDefStack = updateTypeDefHierarchy(typeDef);
            // Get the "basemost" component of the inheritance tree.
            typeDef = typeDefStack.pop();
            node = SGNodeFactory.createNode(typeDef!.extends as SGNodeType, type) ?? BrsInvalid.Instance;
            if (node instanceof BrsInvalid) {
                node = new Node([], type);
            }
        } else {
            BrsDevice.stderr.write(
                `warning,BRIGHTSCRIPT: ERROR: roSGNode: Failed to create roSGNode with type ${type}: ${
                    interpreter?.formatLocation() ?? ""
                }`
            );
            return BrsInvalid.Instance;
        }
    }
    // If Node is being created in a task thread, ensure its parent is set to the current task.
    if (node instanceof Node && sgRoot.inTaskThread()) {
        const task = sgRoot.getCurrentThreadTask();
        if (task && isInvalid(node.getNodeParent())) {
            node.setNodeParent(task);
        }
    }
    return node;
}

/**
 * Creates a Scene node by its type name as defined in XML component files.
 * Validates that the type is a Scene subtype before creation.
 * @param interpreter Interpreter instance for component initialization
 * @param type Type name of the Scene to create
 * @returns Created Scene instance or BrsInvalid if creation fails or type is not a Scene subtype
 */
export function createSceneByType(interpreter: Interpreter, type: string): Node | BrsInvalid {
    let typeDef = sgRoot.nodeDefMap.get(type.toLowerCase());
    updateTypeDefHierarchy(typeDef);
    if (typeDef && isSubtypeCheck(type, SGNodeType.Scene)) {
        return new Scene([], type);
    } else {
        BrsDevice.stderr.write(
            `warning,BRIGHTSCRIPT: ERROR: roSGNode: Failed to create a Scene with type ${type}: ${interpreter.formatLocation()}`
        );
    }
    return BrsInvalid.Instance;
}

/**
 * Checks if a custom node type exists in the node definition map.
 * @param node Node type name to check
 * @returns True if the custom node definition exists, false otherwise
 */
export function customNodeExists(node: string) {
    return sgRoot.nodeDefMap.has(node.toLowerCase());
}

/**
 * Initializes a node with its fields, children, and execution environment.
 * Walks the component inheritance hierarchy and calls init() methods in order.
 * Sets up the node's m pointer with top and global references.
 * @param interpreter Interpreter instance for code execution
 * @param type Type name of the node
 * @param typeDef Optional component definition for the node type
 * @param node Optional pre-created node instance to initialize
 * @returns Initialized node instance or BrsInvalid if initialization fails
 */
export function initializeNode(interpreter: Interpreter, type: string, typeDef?: ComponentDefinition, node?: Node) {
    if (typeDef) {
        //use typeDef object to tack on all the bells & whistles of a custom node
        const typeDefStack = updateTypeDefHierarchy(typeDef);
        const currentEnv = typeDef.environment?.createSubEnvironment();

        // Start from the "basemost" component of the tree.
        typeDef = typeDefStack.pop();

        // If not already created, create the node.
        node ??= SGNodeFactory.createNode(typeDef!.extends as SGNodeType, type);
        // Default to Node as parent.
        node ??= new Node([], type);
        const mPointer = new RoAssociativeArray([]);
        currentEnv?.setM(new RoAssociativeArray([]));
        if (currentEnv) {
            currentEnv.hostNode = node;
        }

        // Add children, fields and call each init method starting from the
        // "basemost" component of the tree.
        while (typeDef) {
            let init: BrsType;

            interpreter.inSubEnv((subInterpreter) => {
                if (node instanceof Scene) {
                    node.setInitState("initializing");
                }
                addChildren(subInterpreter, node!, typeDef!);
                addFields(subInterpreter, node!, typeDef!);
                return BrsInvalid.Instance;
            }, currentEnv);

            // Pre-render default state of the tree.
            if (node instanceof Scene) {
                node.renderNode(interpreter, [0, 0], 0, 1);
            }

            interpreter.inSubEnv((subInterpreter: Interpreter) => {
                init = subInterpreter.getCallableFunction("init");
                return BrsInvalid.Instance;
            }, typeDef.environment);

            interpreter.inSubEnv((subInterpreter: Interpreter) => {
                subInterpreter.environment.hostNode = node;

                mPointer.set(new BrsString("top"), node!);
                mPointer.set(new BrsString("global"), sgRoot.mGlobal);
                subInterpreter.environment.setM(mPointer);
                subInterpreter.environment.setRootM(mPointer);
                node!.m = mPointer;
                if (init instanceof Callable) {
                    const originalLocation = interpreter.location;
                    const funcLoc = init.getLocation() ?? originalLocation;
                    interpreter.addToStack({
                        functionName: "init",
                        functionLocation: funcLoc,
                        callLocation: originalLocation,
                        signature: init.signatures[0].signature,
                    });
                    try {
                        node!.location = interpreter.formatLocation(funcLoc);
                        init.call(subInterpreter);
                        interpreter.popFromStack();
                        interpreter.location = originalLocation;
                    } catch (err) {
                        if (err instanceof RuntimeError) {
                            interpreter.checkCrashDebug(err);
                        }
                        if (!interpreter.inExitMode()) {
                            interpreter.popFromStack();
                            interpreter.location = originalLocation;
                        }
                        throw err;
                    }
                }
                return BrsInvalid.Instance;
            }, currentEnv);

            typeDef = typeDefStack.pop();
        }
        if (node instanceof Scene) {
            node.setInitState("initialized");
        }
        return node;
    } else {
        BrsDevice.stderr.write(
            `warning,BRIGHTSCRIPT: ERROR: roSGNode: Failed to initialize roSGNode with type ${type}: ${interpreter.formatLocation()}`
        );
        return BrsInvalid.Instance;
    }
}

/**
 * Initializes a Task node on its own Worker thread.
 * Creates the task with its component hierarchy and restores serialized state.
 * Sets up the task's execution environment and thread context.
 * @param interpreter Interpreter instance for the task thread
 * @param taskData Serialized task data including fields and context
 * @returns Initialized Task node or BrsInvalid if initialization fails
 */
export function initializeTask(interpreter: Interpreter, taskData: TaskData) {
    const type = taskData.name;
    let typeDef = sgRoot.nodeDefMap.get(type.toLowerCase());
    if (typeDef) {
        //use typeDef object to tack on all the bells & whistles of a custom node
        let typeDefStack = updateTypeDefHierarchy(typeDef);
        let currentEnv = typeDef.environment?.createSubEnvironment();

        // Start from the "basemost" component of the tree.
        typeDef = typeDefStack.pop();

        // Create the node.
        const node = SGNodeFactory.createNode(typeDef!.extends as SGNodeType, type) || new Task([], type);
        const mPointer = new RoAssociativeArray([]);
        currentEnv?.setM(new RoAssociativeArray([]));
        if (currentEnv) {
            currentEnv.hostNode = node;
        }

        // Add children and fields starting from the "basemost" component of the tree.
        while (typeDef) {
            interpreter.inSubEnv((subInterpreter: Interpreter) => {
                addChildren(subInterpreter, node!, typeDef!);
                addFields(subInterpreter, node!, typeDef!);
                return BrsInvalid.Instance;
            }, currentEnv);

            interpreter.inSubEnv((subInterpreter: Interpreter) => {
                subInterpreter.environment.hostNode = node;

                mPointer.set(new BrsString("top"), node!);
                mPointer.set(new BrsString("global"), sgRoot.mGlobal);
                subInterpreter.environment.setM(mPointer);
                subInterpreter.environment.setRootM(mPointer);
                node!.m = mPointer;
                return BrsInvalid.Instance;
            }, currentEnv);

            typeDef = typeDefStack.pop();
        }
        loadTaskData(interpreter, node, taskData);
        return node;
    } else {
        BrsDevice.stderr.write(
            `warning,BRIGHTSCRIPT: ERROR: roSGNode: Failed to initialize Task with type ${type}: ${interpreter.formatLocation()}`
        );
        return BrsInvalid.Instance;
    }
}

/**
 * Restores task fields and context from serialized task data.
 * Sets up the task's m pointer, global state, and scene reference.
 * Restores field observers and message port connections.
 * @param interpreter Interpreter instance for the task thread
 * @param node Task node to restore data into
 * @param taskData Serialized task data with field values and state
 */
function loadTaskData(interpreter: Interpreter, node: Node, taskData: TaskData) {
    if (node instanceof Task) {
        sgRoot.setThread(0, false, taskData.render);
        node.threadId = taskData.id;
        node.thread = true;
        sgRoot.addTask(node, taskData.id, true);
        interpreter.environment.hostNode = node;
    }
    let port: RoMessagePort | undefined;
    if (taskData.m) {
        for (let [key, value] of Object.entries(taskData.m)) {
            if (key === "global" || key === "top") {
                // Ignore special fields to be set later
                continue;
            }
            const brsValue = brsValueOf(value);
            if (!port && brsValue instanceof RoMessagePort) {
                port = brsValue;
            }
            node.m.set(new BrsString(key), brsValue);
        }
    }
    if (taskData.m?.global) {
        restoreNode(interpreter, taskData.m.global, sgRoot.mGlobal, port);
    }
    if (taskData.m?.top) {
        restoreNode(interpreter, taskData.m.top, node, port);
    }
    if (taskData.scene?.["_node_"]) {
        const nodeType = taskData.scene["_node_"].split(":");
        const scene = toSGNode(taskData.scene, nodeType[0], nodeType[1]);
        if (scene instanceof Scene) {
            sgRoot.setScene(scene);
        }
    }
}

/**
 * Updates the component hierarchy map and builds an inheritance stack.
 * Traverses the component's extends chain and populates subtypeHierarchy.
 * @param typeDef Component definition to process
 * @returns Stack of component definitions ordered from most derived to base
 */
export function updateTypeDefHierarchy(typeDef: ComponentDefinition | undefined) {
    let typeDefStack: ComponentDefinition[] = [];
    if (!typeDef) {
        return typeDefStack;
    }
    //use typeDef object to tack on all the bells & whistles of a custom node
    // Adding all component extensions to the stack to call init methods
    // in the correct order.
    typeDefStack.push(typeDef);
    while (typeDef) {
        const typeKey = typeDef.name!.toLowerCase();
        if (!subtypeHierarchy.has(typeKey)) {
            // Add the current typedef to the subtypeHierarchy
            subtypeHierarchy.set(typeKey, typeDef.extends || SGNodeType.Node);
        }
        typeDef = sgRoot.nodeDefMap.get(typeDef.extends.toLowerCase());
        if (typeDef) typeDefStack.push(typeDef);
    }
    return typeDefStack;
}

/**
 * Restores node fields from a serialized object.
 * Sets field values and reattaches field observers with message ports.
 * @param interpreter Interpreter instance for observer setup
 * @param source Serialized source object containing field values
 * @param node Node to restore fields into
 * @param port Optional message port for field observers
 */
function restoreNode(interpreter: Interpreter, source: any, node: Node, port?: RoMessagePort) {
    const observed = source["_observed_"];
    node.owner = source["_owner_"] ?? sgRoot.threadId;
    for (let [key, value] of Object.entries(source)) {
        if (key.startsWith("_") && key.endsWith("_") && key.length > 2) {
            // Ignore transfer metadata fields
            continue;
        }
        node.setValueSilent(key, brsValueOf(value));
        if (port && observed?.includes(key)) {
            node.addObserver(interpreter, "unscoped", new BrsString(key), port);
        }
    }
}

/**
 * Adds fields to a node based on its component definition.
 * Handles field aliases, default values, and onChange callbacks.
 * Validates that aliased fields and duplicate fields are handled correctly.
 * @param interpreter Interpreter instance for callback registration
 * @param node Node to add fields to
 * @param typeDef Component definition containing field specifications
 */
function addFields(interpreter: Interpreter, node: Node, typeDef: ComponentDefinition) {
    let fields = typeDef.fields;
    for (let [fieldName, fieldValue] of Object.entries(fields)) {
        if (fieldValue instanceof Object) {
            if (fieldValue.alias?.includes(".")) {
                const childName = fieldValue.alias.split(".")[0];
                const childField = fieldValue.alias.split(".")[1];
                const childNode = node.findNodeById(node, childName);
                if (childNode instanceof Node) {
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
                    node.setValueSilent(fieldName, getBrsValueFromFieldType(fieldValue.type, fieldValue.value));
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

/**
 * Adds child nodes to a parent node based on its component definition.
 * Creates child nodes, sets their fields, and handles role-based assignment.
 * Recursively adds children's own children from the definition tree.
 * @param interpreter Interpreter instance for child node creation
 * @param node Parent node to add children to
 * @param typeDef Component definition or component node containing children specifications
 */
function addChildren(interpreter: Interpreter, node: Node, typeDef: ComponentDefinition | ComponentNode) {
    const children = typeDef.children;
    const appendChild = node.getMethod("appendchild");

    for (let child of children) {
        const newChild = createNodeByType(child.name, interpreter);
        if (newChild instanceof Node) {
            newChild.location = interpreter.formatLocation();
            const nodeFields = newChild.getNodeFields();
            for (let [key, value] of Object.entries(child.fields)) {
                const field = nodeFields.get(key.toLowerCase());
                if (field) {
                    newChild.setValue(key, getBrsValueFromFieldType(field.getType(), value));
                }
            }
            if (child.fields?.role) {
                const targetField = child.fields.role;
                if (node.getNodeFields().get(targetField)) {
                    if (child.children.length > 0) {
                        // we need to add the child's own children
                        addChildren(interpreter, newChild, child);
                    }
                    node.setValue(targetField, newChild, false);
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

/**
 * Gets the base SGNodeType for a given subtype or custom component.
 * Walks the inheritance hierarchy to find the built-in node type.
 * @param subType Node subtype or custom component name
 * @returns Base SGNodeType or Node if not found
 */
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

/**
 * Converts the data type of a field to the appropriate value kind.
 * @param type data type of field
 */
export function getValueKindFromFieldType(type: string) {
    switch (type.toLowerCase()) {
        case "bool":
        case "boolean":
            return ValueKind.Boolean;
        case "color":
        case "int":
        case "integer":
            return ValueKind.Int32;
        case "longinteger":
            return ValueKind.Int64;
        case "float":
            return ValueKind.Float;
        case "time":
        case "double":
            return ValueKind.Double;
        case "uri":
        case "str":
        case "string":
            return ValueKind.String;
        case "function":
            return ValueKind.Callable;
        case "node":
        case "font":
        case "roarray":
        case "array":
        case "roassociativearray":
        case "assocarray":
        case "rect2d":
        case "vector2d":
        case "floatarray":
        case "intarray":
        case "boolarray":
        case "stringarray":
        case "vector2darray":
        case "rect2darray":
        case "colorarray":
        case "timearray":
        case "nodearray":
            return ValueKind.Object;
        default:
            return ValueKind.Invalid;
    }
}

/**
 *  Converts a specified BrightScript type in string into BrsType representation, with actual value
 *  Note: only supports native types so far.  Objects such as array/AA aren't handled at the moment.
 *  @param {string} type data type of field
 *  @param {string} value optional value specified as string
 *  @returns {BrsType} BrsType value representation of the type
 */
export function getBrsValueFromFieldType(type: string, value?: string): BrsType {
    let returnValue: BrsType;

    switch (type.toLowerCase()) {
        case "bool":
        case "boolean":
            returnValue = value ? BrsBoolean.from(value.toLowerCase() === "true") : BrsBoolean.False;
            break;
        case "int":
        case "integer":
            returnValue = value ? new Int32(Number.parseInt(value)) : new Int32(0);
            break;
        case "longinteger":
            returnValue = value ? new Int64(Long.fromString(value)) : new Int64(0);
            break;
        case "float":
            returnValue = value ? new Float(Number.parseFloat(value)) : new Float(0);
            break;
        case "time":
        case "double":
            returnValue = value ? new Double(Number.parseFloat(value)) : new Double(0);
            break;
        case "node":
            returnValue = new RoInvalid();
            break;
        case "font":
            returnValue = new Font();
            if (
                returnValue instanceof Font &&
                value?.startsWith("font:") &&
                !returnValue.setSystemFont(value.slice(5).toLowerCase())
            ) {
                returnValue = BrsInvalid.Instance;
            }
            break;
        case "roarray":
        case "array":
        case "vector2d":
        case "rect2d":
        case "boolarray":
        case "floatarray":
        case "intarray":
        case "stringarray":
        case "timearray":
        case "vector2darray":
        case "rect2darray":
        case "nodearray":
            returnValue = parseArray(value ?? "");
            break;
        case "colorarray":
            returnValue = parseColorArray(value ?? "");
            break;
        case "roassociativearray":
        case "assocarray":
            returnValue = value?.trim() === "{}" ? new RoAssociativeArray([]) : BrsInvalid.Instance;
            break;
        case "object":
            returnValue = BrsInvalid.Instance;
            break;
        case "uri":
        case "str":
        case "string":
            returnValue = new BrsString(value ?? "");
            break;
        case "color":
            returnValue = new Int32(-1);
            if (value?.length) {
                returnValue = new Int32(convertHexColor(value));
            }
            break;
        default:
            returnValue = Uninitialized.Instance;
            break;
    }

    return returnValue;
}

/**
 * Parses a string representation of an array into a RoArray.
 * Supports JSON format including nested arrays.
 * @param value String representation of the array (JSON format)
 * @returns RoArray with parsed values or empty array if parsing fails
 */
function parseArray(value: string): RoArray {
    const trimmed = value?.trim();
    if (!trimmed?.startsWith("[") || !trimmed.endsWith("]")) {
        return new RoArray([]);
    }
    try {
        // Use JSON.parse to handle nested arrays
        const parsed = JSON.parse(trimmed);
        if (!Array.isArray(parsed)) {
            return new RoArray([]);
        }
        return new RoArray(
            parsed.map((v) => {
                return brsValueOf(v);
            })
        );
    } catch {
        return new RoArray([]);
    }
}

/**
 * Parses a string representation of a color array into a RoArray of Int32 color values.
 * Converts each hex color string to an integer using convertHexColor.
 * Handles BrightScript hex formats: 0xRRGGBBAA, &hRRGGBBAA, #RRGGBBAA
 * @param value String representation of the color array (e.g., "[ 0xFF10EBFF, 0x10101FFF ]")
 * @returns RoArray with Int32 color values or empty array if parsing fails
 */
function parseColorArray(value: string): RoArray {
    const trimmed = value?.trim();
    if (!trimmed?.startsWith("[") || !trimmed.endsWith("]")) {
        return new RoArray([]);
    }
    const content = trimmed.slice(1, -1).trim();
    if (!content) {
        return new RoArray([]);
    }
    const colorStrings = content.split(",");
    const colors: Int32[] = [];

    for (const colorStr of colorStrings) {
        if (colorStr.trim() !== "") {
            colors.push(new Int32(convertHexColor(colorStr)));
        }
    }
    return new RoArray(colors);
}
