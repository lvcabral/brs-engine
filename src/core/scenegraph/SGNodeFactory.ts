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
    ZoomRowList,
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
    sgRoot,
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
    ChannelStore,
    isInvalid,
} from "../brsTypes";
import { TaskData } from "../common";

export enum SGNodeType {
    Node = "Node",
    ContentNode = "ContentNode",
    Group = "Group",
    LayoutGroup = "LayoutGroup",
    MaskGroup = "MaskGroup",
    TargetGroup = "TargetGroup",
    TargetList = "TargetList",
    TargetSet = "TargetSet",
    ButtonGroup = "ButtonGroup",
    Button = "Button",
    Panel = "Panel",
    PanelSet = "PanelSet",
    ListPanel = "ListPanel",
    GridPanel = "GridPanel",
    OverhangPanelSetScene = "OverhangPanelSetScene",
    Dialog = "Dialog",
    KeyboardDialog = "KeyboardDialog",
    PinPad = "PinPad",
    PinDialog = "PinDialog",
    ParentalControlPinPad = "ParentalControlPinPad",
    StandardDialog = "StandardDialog",
    StandardKeyboardDialog = "StandardKeyboardDialog",
    StandardMessageDialog = "StandardMessageDialog",
    StandardPinPadDialog = "StandardPinPadDialog",
    StandardProgressDialog = "StandardProgressDialog",
    ProgressDialog = "ProgressDialog",
    StdDlgActionCardItem = "StdDlgActionCardItem",
    StdDlgAreaBase = "StdDlgAreaBase",
    StdDlgBulletTextItem = "StdDlgBulletTextItem",
    StdDlgButton = "StdDlgButton",
    StdDlgButtonArea = "StdDlgButtonArea",
    StdDlgContentArea = "StdDlgContentArea",
    StdDlgCustomItem = "StdDlgCustomItem",
    StdDlgDeterminateProgressItem = "StdDlgDeterminateProgressItem",
    StdDlgGraphicItem = "StdDlgGraphicItem",
    StdDlgItemBase = "StdDlgItemBase",
    StdDlgItemGroup = "StdDlgItemGroup",
    StdDlgKeyboardItem = "StdDlgKeyboardItem",
    StdDlgMultiStyleTextItem = "StdDlgMultiStyleTextItem",
    StdDlgProgressItem = "StdDlgProgressItem",
    StdDlgSideCardArea = "StdDlgSideCardArea",
    StdDlgTextItem = "StdDlgTextItem",
    StdDlgTitleArea = "StdDlgTitleArea",
    Rectangle = "Rectangle",
    Poster = "Poster",
    Label = "Label",
    LabelBase = "LabelBase",
    SimpleLabel = "SimpleLabel",
    MultiStyleLabel = "MultiStyleLabel",
    MonospaceLabel = "MonospaceLabel",
    ScrollingLabel = "ScrollingLabel",
    ScrollableText = "ScrollableText",
    Font = "Font",
    ArrayGrid = "ArrayGrid",
    PosterGrid = "PosterGrid",
    LabelList = "LabelList",
    CheckList = "CheckList",
    RowList = "RowList",
    RadioButtonList = "RadioButtonList",
    MarkupList = "MarkupList",
    ZoomRowList = "ZoomRowList",
    MarkupGrid = "MarkupGrid",
    TimeGrid = "TimeGrid",
    Task = "Task",
    Timer = "Timer",
    Scene = "Scene",
    Keyboard = "Keyboard",
    MiniKeyboard = "MiniKeyboard",
    DynamicKeyboard = "DynamicKeyboard",
    DynamicKeyboardBase = "DynamicKeyboardBase",
    DynamicMiniKeyboard = "DynamicMiniKeyboard",
    DynamicCustomKeyboard = "DynamicCustomKeyboard",
    DynamicPinPad = "DynamicPinPad",
    DynamicKeyGrid = "DynamicKeyGrid",
    TextEditBox = "TextEditBox",
    VoiceTextEditBox = "VoiceTextEditBox",
    Overhang = "Overhang",
    RSGPalette = "RSGPalette",
    Video = "Video",
    Audio = "Audio",
    SoundEffect = "SoundEffect",
    Animation = "Animation",
    AnimationBase = "AnimationBase",
    SequentialAnimation = "SequentialAnimation",
    ParallelAnimation = "ParallelAnimation",
    FloatFieldInterpolator = "FloatFieldInterpolator",
    Vector2DFieldInterpolator = "Vector2DFieldInterpolator",
    ColorFieldInterpolator = "ColorFieldInterpolator",
    BusySpinner = "BusySpinner",
    ChannelStore = "ChannelStore",
    ComponentLibrary = "ComponentLibrary",
    InfoPane = "InfoPane",
}

export function isSGNodeType(value: string): value is SGNodeType {
    const lowerValue = value.toLowerCase();
    return Object.values(SGNodeType).some((enumVal) => enumVal.toLowerCase() === lowerValue);
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
        for (const [nodeType, ctor] of types) {
            this.additionalNodes.set(nodeType.toLowerCase(), ctor);
        }
    }

    public static createNode(nodeType: SGNodeType | string, nodeName?: string): RoSGNode | undefined {
        let name = nodeName || nodeType;
        const additionalCtor = this.additionalNodes.get(nodeType?.toLowerCase());
        if (additionalCtor) {
            return additionalCtor(name);
        }
        switch (nodeType.toLowerCase()) {
            case SGNodeType.Node.toLowerCase():
                return new RoSGNode([], name);
            case SGNodeType.Group.toLowerCase():
            case SGNodeType.MaskGroup.toLowerCase():
            case SGNodeType.TargetGroup.toLowerCase():
            case SGNodeType.ScrollableText.toLowerCase():
                return new Group([], name);
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
            case SGNodeType.ScrollingLabel.toLowerCase():
                return new ScrollingLabel([], name);
            case SGNodeType.Font.toLowerCase():
                return new Font([], name);
            case SGNodeType.Poster.toLowerCase():
                return new Poster([], name);
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
        return this.additionalNodes.has(nodeType?.toLowerCase()) || isSGNodeType(nodeType);
    }
}

/** Function to create a Node by its name defined on the XML file */
export function createNodeByType(type: BrsString, interpreter?: Interpreter): RoSGNode | BrsInvalid {
    // If this is a built-in node component, then return it.
    let node = SGNodeFactory.createNode(type.value) ?? BrsInvalid.Instance;
    if (node instanceof BrsInvalid) {
        let typeDef = sgRoot.nodeDefMap.get(type.value.toLowerCase());
        if (typeDef && !interpreter) {
            const typeDefStack = updateTypeDefHierarchy(typeDef);
            // Get the "basemost" component of the inheritance tree.
            typeDef = typeDefStack.pop();
            node = SGNodeFactory.createNode(typeDef!.extends as SGNodeType, type.value) ?? BrsInvalid.Instance;
            if (node instanceof BrsInvalid) {
                node = new RoSGNode([], type.value);
            }
        } else if (typeDef) {
            node = initializeNode(interpreter!, type, typeDef);
        } else {
            BrsDevice.stderr.write(
                `warning,BRIGHTSCRIPT: ERROR: roSGNode: Failed to create roSGNode with type ${
                    type.value
                }: ${interpreter?.formatLocation() ?? ""}`
            );
            return BrsInvalid.Instance;
        }
    }
    if (node instanceof Task) {
        // thread id = 0 is the Main worker thread
        node.id = sgRoot.tasks.length + 1;
        sgRoot.tasks.push(node);
    }
    if (node instanceof RoSGNode && sgRoot.tasks.length === 1) {
        const task = sgRoot.tasks[0];
        if (task.thread && isInvalid(node.getNodeParent())) {
            node.setNodeParent(task);
        }
    }
    return node;
}

/** Function to create a Scene by its name defined on the XML file */
export function createSceneByType(interpreter: Interpreter, type: BrsString): RoSGNode | BrsInvalid {
    let typeDef = sgRoot.nodeDefMap.get(type.value.toLowerCase());
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
    return sgRoot.nodeDefMap.has(node.value.toLowerCase());
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
                mPointer.set(new BrsString("global"), sgRoot.mGlobal);
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
    let typeDef = sgRoot.nodeDefMap.get(type.toLowerCase());
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

/** Function to restore the Task fields and context from the serialized object */
function loadTaskData(interpreter: Interpreter, node: RoSGNode, taskData: TaskData) {
    if (node instanceof Task) {
        node.id = taskData.id;
        node.thread = true;
        sgRoot.tasks.push(node);
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
                console.debug("[Task] A port object was found!");
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
        const nodeType = taskData.scene["_node_"].split(":")[1] ?? "Scene";
        sgRoot.setScene(new Scene([], nodeType));
        restoreNode(interpreter, taskData.scene, sgRoot.scene!);
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

        typeDef = sgRoot.nodeDefMap.get(typeDef.extends.toLowerCase());
        if (typeDef) typeDefStack.push(typeDef);
    }
    return typeDefStack;
}

/** Function to restore the node fields from the serialized object */
function restoreNode(interpreter: Interpreter, source: any, node: RoSGNode, port?: RoMessagePort) {
    const observed = source["_observed_"];
    for (let [key, value] of Object.entries(source)) {
        if (key.startsWith("_") && key.endsWith("_") && key.length > 2) {
            // Ignore transfer metadata fields
            continue;
        }
        node.setFieldValue(key, brsValueOf(value));
        if (port && observed?.includes(key)) {
            if (node instanceof Task) {
                console.debug(`[Task] Adding observer port for top.${key}`);
            } else {
                console.debug(`[Task] Adding observer port for global.${key}`);
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
        const newChild = createNodeByType(new BrsString(child.name), interpreter);
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
