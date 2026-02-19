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
    OverhangPanelSetScene,
    PanelSet,
    Panel,
    ListPanel,
    GridPanel,
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
    StandardKeyboardDialog,
    StandardProgressDialog,
    StdDlgContentArea,
    StdDlgProgressItem,
    StdDlgTitleArea,
    Task,
    TextEditBox,
    VoiceTextEditBox,
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
import type { Field } from "../nodes/Field";
import { ComponentDefinition, ComponentNode } from "../parser/ComponentDefinition";
import { brsValueOf } from "./Serializer";
import { sgRoot } from "../SGRoot";
import { convertHexColor, convertLong, convertNumber } from "../SGUtil";
import { FieldAliasTarget, FieldKind, ObservedField } from "../SGTypes";

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
     * @param types Array of pairs of [nodeTypeName, construction function], such that when a given nodeType is requested,
     * the construction function is called and returns one of those components
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
            case SGNodeType.VoiceTextEditBox.toLowerCase():
                return new VoiceTextEditBox([], name);
            case SGNodeType.Overhang.toLowerCase():
                return new Overhang([], name);
            case SGNodeType.OverhangPanelSetScene.toLowerCase():
                return new OverhangPanelSetScene([], name);
            case SGNodeType.PanelSet.toLowerCase():
                return new PanelSet([], name);
            case SGNodeType.Panel.toLowerCase():
                return new Panel([], name);
            case SGNodeType.GridPanel.toLowerCase():
                return new GridPanel([], name);
            case SGNodeType.ListPanel.toLowerCase():
                return new ListPanel([], name);
            case SGNodeType.StandardDialog.toLowerCase():
                return new StandardDialog([], name);
            case SGNodeType.StandardKeyboardDialog.toLowerCase():
                return new StandardKeyboardDialog([], name);
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
                        `warning,Warning: The roSGNode with type "${nodeType}" is not implemented yet, created as regular "Node".`
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
 * Creates a node by its type name as defined in XML component files and initializes it.
 * Handles both built-in node types and custom component definitions.
 * @param type Type name of the node to create
 * @param interpreter Optional interpreter instance for component initialization
 * @returns Created node instance or BrsInvalid if creation fails
 */
export function createNode(type: string, interpreter?: Interpreter): Node | BrsInvalid {
    // If this is a built-in node component, then return it.
    let node = SGNodeFactory.createNode(type) ?? BrsInvalid.Instance;
    if (node instanceof BrsInvalid) {
        let typeDef = sgRoot.nodeDefMap.get(type.toLowerCase());
        if (typeDef && interpreter instanceof Interpreter) {
            node = initializeNode(interpreter, type, typeDef);
        } else if (typeDef && sgRoot.inTaskThread() && sgRoot.interpreter) {
            node = initializeNode(sgRoot.interpreter, type, typeDef);
        } else if (typeDef) {
            node = createNodeByTypeDef(typeDef, type);
            if (node instanceof BrsInvalid) {
                node = new Node([], type);
            }
        } else {
            BrsDevice.stderr.write(
                `warning,Warning: Failed to create roSGNode with type ${type}: ${interpreter?.formatLocation() ?? ""}`
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
 * Creates a SceneGraph node based on the specified type and subtype.
 * Focused on serialization, custom XML nodes are created flat, without children and not initialized.
 * @param type Type name of the node to create
 * @param subtype Subtype name of the node to create
 * @returns Created node instance or BrsInvalid if creation fails
 */
export function createFlatNode(type: string, subtype: string): Node | BrsInvalid {
    let node: Node | BrsInvalid = BrsInvalid.Instance;
    const typeDef = sgRoot.nodeDefMap.get(subtype.toLowerCase());
    if (typeDef) {
        node = createNodeByTypeDef(typeDef, subtype);
    }
    if (node instanceof BrsInvalid) {
        node = SGNodeFactory.createNode(type, subtype) ?? BrsInvalid.Instance;
    }
    if (node instanceof BrsInvalid) {
        BrsDevice.stderr.write(
            `warning,Warning: Failed to create roSGNode with type ${type}:${subtype}: ${
                sgRoot.interpreter?.formatLocation() ?? ""
            }`
        );
    }
    return node;
}

/**
 * Creates a SceneGraph node based on a component definition (simplified without children).
 * @param typeDef Definition of the component to create a node from
 * @param subtype Subtype name of the node to create
 * @returns Created node instance or BrsInvalid if creation fails
 */
function createNodeByTypeDef(typeDef: ComponentDefinition, subtype: string): Node | BrsInvalid {
    let node: Node | BrsInvalid = BrsInvalid.Instance;
    const typeDefStack = updateTypeDefHierarchy(typeDef);
    const nodeDef = typeDefStack.pop();
    if (nodeDef) {
        node = SGNodeFactory.createNode(nodeDef.extends as SGNodeType, subtype) ?? BrsInvalid.Instance;
        if (node instanceof Node) {
            const fields = nodeDef.fields;
            for (const [fieldName, fieldValue] of Object.entries(fields)) {
                if (!(fieldValue instanceof Object)) {
                    continue;
                }
                node.addNodeField(fieldName, fieldValue.type, fieldValue.alwaysNotify === "true", false);
            }
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
export function createScene(interpreter: Interpreter, type: string): Node | BrsInvalid {
    const sceneName = type.toLowerCase();
    if (sceneName === SGNodeType.Scene.toLowerCase()) {
        return new Scene([], SGNodeType.Scene);
    } else if (sceneName === SGNodeType.OverhangPanelSetScene.toLowerCase()) {
        return new OverhangPanelSetScene([], SGNodeType.OverhangPanelSetScene);
    }
    const typeDef = sgRoot.nodeDefMap.get(sceneName);
    if (typeDef) {
        updateTypeDefHierarchy(typeDef);
        if (isSubtypeCheck(sceneName, SGNodeType.Scene)) {
            return new Scene([], type);
        } else if (isSubtypeCheck(sceneName, SGNodeType.OverhangPanelSetScene)) {
            return new OverhangPanelSetScene([], type);
        }
    }
    BrsDevice.stderr.write(
        `warning,Warning: roSGNode: Failed to create a Scene with type ${type}: ${interpreter.formatLocation()}`
    );
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
        if (currentEnv) {
            currentEnv.setM(new RoAssociativeArray([]));
            currentEnv.hostNode = node;
        }
        // Add children, fields and call each init method starting from the
        // "basemost" component of the tree.
        while (typeDef) {
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

            const init = interpreter.inSubEnv((subInterpreter: Interpreter) => {
                return subInterpreter.getCallableFunction("init");
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
            `warning,Warning: Failed to initialize roSGNode with type ${type}: ${interpreter.formatLocation()}`
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
    sgRoot.setCurrentThread(taskData.id);
    const type = taskData.name;
    let typeDef = sgRoot.nodeDefMap.get(type.toLowerCase());
    if (typeDef) {
        //use typeDef object to tack on all the bells & whistles of a custom node
        const typeDefStack = updateTypeDefHierarchy(typeDef);
        const currentEnv = typeDef.environment?.createSubEnvironment();

        // Start from the "basemost" component of the tree.
        typeDef = typeDefStack.pop();
        if (typeDef?.extends !== SGNodeType.Task) {
            BrsDevice.stderr.write(
                `error,ERROR: Task node type mismatch: expected 'Task' but got '${
                    typeDef?.extends ?? "undefined"
                }' in node "${type}"!`
            );
            return BrsInvalid.Instance;
        }
        // Create the Task node.
        const node = new Task([], type);
        const mPointer = new RoAssociativeArray([]);
        if (currentEnv) {
            currentEnv.setM(new RoAssociativeArray([]));
            currentEnv.hostNode = node;
        }

        // Configure Threads
        sgRoot.setThread(0, taskData.render);
        node.threadId = taskData.id;
        node.inThread = true;
        sgRoot.addTask(node, taskData.id);
        interpreter.environment.hostNode = node;

        // Add children and fields starting from the "basemost" component of the tree.
        while (typeDef) {
            interpreter.inSubEnv((subInterpreter: Interpreter) => {
                addChildren(subInterpreter, node, typeDef!);
                addFields(subInterpreter, node, typeDef!);
                return BrsInvalid.Instance;
            }, currentEnv);

            interpreter.inSubEnv((subInterpreter: Interpreter) => {
                subInterpreter.environment.hostNode = node;

                mPointer.set(new BrsString("top"), node);
                mPointer.set(new BrsString("global"), sgRoot.mGlobal);
                subInterpreter.environment.setM(mPointer);
                subInterpreter.environment.setRootM(mPointer);
                node.m = mPointer;
                return BrsInvalid.Instance;
            }, currentEnv);

            typeDef = typeDefStack.pop();
        }
        loadTaskData(interpreter, node, taskData);
        return node;
    } else {
        BrsDevice.stderr.write(
            `warning,Warning: Failed to initialize Task with type ${type}: ${interpreter.formatLocation()}`
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
    const observedFields = source["_observed_"];
    node.setOwner(source["_owner_"] ?? sgRoot.threadId);
    node.setAddress(source["_address_"] ?? node.getAddress());
    for (let [key, value] of Object.entries(source)) {
        if (key.startsWith("_") && key.endsWith("_") && key.length > 2) {
            // Ignore serialization metadata fields
            continue;
        }
        const brsValue = brsValueOf(value);
        if (brsValue instanceof Node) {
            postMessage(`debug,[thread:${sgRoot.threadId}] Restoring Node ${node.nodeSubtype} field "${key}"`);
        }
        node.setValueSilent(key, brsValue);
        if (port && Array.isArray(observedFields)) {
            const observed = observedFields.find((field: ObservedField) => field.name === key);
            if (observed) {
                const infoFields = observed.info ? brsValueOf(observed.info) : undefined;
                node.addObserver(interpreter, "unscoped", new BrsString(key), port, infoFields);
            }
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
    const fields = typeDef.fields;
    for (const [fieldName, fieldValue] of Object.entries(fields)) {
        if (!(fieldValue instanceof Object)) {
            continue;
        }
        if (fieldValue.alias?.includes(".")) {
            if (!addAliases(fieldName, fieldValue.alias, node, typeDef)) {
                return;
            }
        } else {
            const field = node.getNodeFields().get(fieldName.toLowerCase());
            if (node instanceof ContentNode && field?.isHidden()) {
                const defaultValue = fieldValue.value
                    ? getBrsValueFromFieldType(fieldValue.type, fieldValue.value)
                    : undefined;
                node.replaceField(fieldName, fieldValue.type, defaultValue, fieldValue.alwaysNotify === "true");
            } else if (field) {
                let msg = `warning,Error creating XML component ${node.nodeSubtype}\n`;
                msg += `-- Attempt to add duplicate field "${fieldName}" to RokuML component "${node.nodeSubtype}"\n`;
                msg += `---- Extends node type "${typeDef.extends}" already has a field named ${fieldName}\n`;
                msg += `-- Error found ${typeDef.xmlPath}`;
                BrsDevice.stderr.write(msg);
                return;
            }
            node.addNodeField(fieldName, fieldValue.type, fieldValue.alwaysNotify === "true", false);
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

/**
 * Add aliases for a field to a node based on the component definition.
 * @param fieldName The name of the field to alias.
 * @param fieldAlias The alias string specifying target nodes and fields.
 * @param node The node to which aliases are added.
 * @param typeDef The component definition containing field specifications.
 * @returns True if aliases were successfully added, false otherwise.
 */
function addAliases(fieldName: string, fieldAlias: string, node: Node, typeDef: ComponentDefinition): boolean {
    // Parse comma-separated alias list (e.g., "child1.field1,child2.field2")
    const aliasParts = fieldAlias.split(",").map((s: string) => s.trim());
    const targets: FieldAliasTarget[] = [];
    let sharedField: Field | undefined;
    let fieldType: FieldKind | undefined;
    for (const aliasPart of aliasParts) {
        const [childName, childField] = aliasPart.split(/\.(.*)/s, 2);
        const childNode = node.findNodeById(node, childName, true);
        if (childNode instanceof Node && childField) {
            const field = childNode.getNodeFields().get(childField.toLowerCase());
            if (field) {
                if (targets.length === 0) {
                    // Get first child field and type
                    sharedField = field;
                    fieldType = field.getType();
                } else if (sharedField && field.getType() === fieldType) {
                    // Set siblings with the shared field
                    childNode.getNodeFields().set(childField.toLowerCase(), sharedField);
                } else {
                    // Invalid field type, stop processing aliases
                    break;
                }
                targets.push({ nodeId: childName, fieldName: childField });
            } else {
                let msg = `warning,Error creating XML component ${node.nodeSubtype}\n`;
                msg += `-- Interface field alias failed: Node "${childName}" has no field named "${childField}"\n`;
                msg += `-- Error found ${typeDef.xmlPath}`;
                BrsDevice.stderr.write(msg);
                if (sharedField) {
                    break;
                }
                return false;
            }
        } else {
            let msg = `warning,Error creating XML component ${node.nodeSubtype}\n`;
            msg += `-- Interface field alias failed: No node named ${childName}\n`;
            msg += `-- Error found ${typeDef.xmlPath}`;
            BrsDevice.stderr.write(msg);
            if (sharedField) {
                break;
            }
            return false;
        }
    }
    if (targets.length > 0 && sharedField) {
        node.addNodeFieldAlias(fieldName, targets, sharedField);
        return true;
    }
    return false;
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
        const newChild = createNode(child.name, interpreter);
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
                if (node.getNodeFields().get(targetField.toLowerCase())) {
                    node.setValue(targetField, newChild, false);
                } else {
                    BrsDevice.stderr.write(
                        `warning,WARNING: Role/Field ${targetField} does not exist in ${node.getId()} node: ${interpreter.formatLocation()}`
                    );
                }
            }
            appendChild?.call(interpreter, newChild);
            if (child.children.length > 0) {
                // we need to add the child's own children
                addChildren(interpreter, newChild, child);
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
 *  @param {BrsType} defaultValue optional default value to return if no value is provided
 *  @returns {BrsType} BrsType value representation of the type
 */
export function getBrsValueFromFieldType(type: string, value?: string, defaultValue?: BrsType): BrsType {
    let returnValue: BrsType;

    switch (type.toLowerCase()) {
        case "bool":
        case "boolean": {
            const fallback = defaultValue ?? BrsBoolean.False;
            returnValue = value ? BrsBoolean.from(value.toLowerCase() === "true") : fallback;
            break;
        }
        case "int":
        case "integer": {
            const fallback = defaultValue ?? new Int32(0);
            const parsedValue = convertNumber(value ?? "");
            returnValue = Number.isNaN(parsedValue) ? fallback : new Int32(parsedValue);
            break;
        }
        case "longinteger": {
            const fallback = defaultValue ?? new Int64(0);
            const parsedValue = convertLong(value ?? "");
            returnValue = parsedValue ? new Int64(parsedValue) : fallback;
            break;
        }
        case "float": {
            const fallback = defaultValue ?? new Float(0);
            const parsedValue = convertNumber(value ?? "");
            returnValue = Number.isNaN(parsedValue) ? fallback : new Float(parsedValue);
            break;
        }
        case "time":
        case "double": {
            const fallback = defaultValue ?? new Double(0);
            const parsedValue = convertNumber(value ?? "");
            returnValue = Number.isNaN(parsedValue) ? fallback : new Double(parsedValue);
            break;
        }
        case "node":
            returnValue = defaultValue ?? new RoInvalid();
            break;
        case "font":
            returnValue = parseFont(value ?? "", defaultValue);
            break;
        case "roarray":
        case "array":
        case "vector2d":
        case "rect2d":
        case "boolarray":
        case "floatarray":
        case "intarray":
        case "timearray":
        case "vector2darray":
        case "rect2darray":
        case "nodearray":
            returnValue = parseArray(value ?? "", defaultValue);
            break;
        case "stringarray":
            if (value && !value.trim().startsWith("[") && !value.trim().endsWith("]")) {
                returnValue = new BrsString(value);
            } else {
                returnValue = parseArray(value ?? "", defaultValue);
            }
            break;
        case "colorarray":
            returnValue = parseColorArray(value ?? "", defaultValue);
            break;
        case "roassociativearray":
        case "assocarray": {
            returnValue = parseAA(value ?? "", defaultValue);
            break;
        }
        case "object":
            returnValue = defaultValue ?? BrsInvalid.Instance;
            break;
        case "uri":
        case "str":
        case "string":
            returnValue = new BrsString(value ?? "");
            break;
        case "color": {
            returnValue = defaultValue ?? new Int32(-1);
            if (value?.length) {
                const colorValue = convertHexColor(value);
                returnValue = colorValue === -1 ? returnValue : new Int32(colorValue);
            }
            break;
        }
        default:
            returnValue = defaultValue ?? Uninitialized.Instance;
            break;
    }

    return returnValue;
}

/**
 * Parses a string representation of a font into a Font object.
 * Supports system fonts prefixed with "font:".
 * @param value String representation of the font
 * @param defaultValue Optional default value to return if parsing fails
 * @returns Font object or BrsInvalid if parsing fails
 */
function parseFont(value: string, defaultValue?: BrsType): BrsType {
    let returnValue: BrsType = new Font();
    if (
        returnValue instanceof Font &&
        value?.startsWith("font:") &&
        !returnValue.setSystemFont(value.slice(5).toLowerCase())
    ) {
        returnValue = defaultValue ?? BrsInvalid.Instance;
    }
    return returnValue;
}

/**
 * Parses a string representation of an associative array into a RoAssociativeArray.
 * Roku only supports empty associative arrays: "{}"
 * @param value String representation of the associative array
 * @param defaultValue Optional default value to return if parsing fails
 * @returns RoAssociativeArray or BrsInvalid if parsing fails
 */
function parseAA(value: string, defaultValue?: BrsType): BrsType {
    const fallback = defaultValue instanceof RoAssociativeArray ? defaultValue : BrsInvalid.Instance;
    let returnValue: BrsType;
    const valueTrimmed = value?.trim() ?? "";
    if (valueTrimmed.startsWith("{") && valueTrimmed.endsWith("}")) {
        const inner = valueTrimmed.slice(1, -1).trim();
        returnValue = inner === "" ? new RoAssociativeArray([]) : fallback;
    } else {
        returnValue = fallback;
    }
    return returnValue;
}

/**
 * Parses a string representation of an array into a RoArray.
 * Supports JSON format including nested arrays.
 * @param value String representation of the array (JSON format)
 * @param defaultValue Optional default value to return if parsing fails
 * @returns RoArray with parsed values or empty array if parsing fails
 */
function parseArray(value: string, defaultValue?: BrsType): RoArray {
    const fallback = defaultValue instanceof RoArray ? defaultValue : new RoArray([]);
    const trimmed = value?.trim();
    if (!trimmed?.startsWith("[") || !trimmed.endsWith("]")) {
        return fallback;
    }
    try {
        // Use JSON.parse to handle nested arrays
        const parsed = JSON.parse(trimmed);
        if (!Array.isArray(parsed)) {
            return fallback;
        }
        return new RoArray(
            parsed.map((v) => {
                return brsValueOf(v);
            })
        );
    } catch {
        return fallback;
    }
}

/**
 * Parses a string representation of a color array into a RoArray of Int32 color values.
 * Converts each hex color string to an integer using convertHexColor.
 * Handles BrightScript hex formats: 0xRRGGBBAA, &hRRGGBBAA, #RRGGBBAA
 * @param value String representation of the color array (e.g., "[ 0xFF10EBFF, 0x10101FFF ]")
 * @param defaultValue Optional default value to return if parsing fails
 * @returns RoArray with Int32 color values or empty array if parsing fails
 */
function parseColorArray(value: string, defaultValue?: BrsType): RoArray {
    const fallback = defaultValue instanceof RoArray ? defaultValue : new RoArray([]);
    const trimmed = value?.trim();
    if (!trimmed?.startsWith("[") || !trimmed.endsWith("]")) {
        return fallback;
    }
    const content = trimmed.slice(1, -1).trim();
    if (!content) {
        return fallback;
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
