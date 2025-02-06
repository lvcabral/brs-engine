import {
    RoSGNode,
    Group,
    LayoutGroup,
    Rectangle,
    Label,
    Font,
    Poster,
    ArrayGrid,
    MarkupGrid,
    ContentNode,
    Timer,
    Scene,
    MiniKeyboard,
    TextEditBox,
} from "../brsTypes";

export enum SGNodeType {
    Node = "Node",
    Group = "Group",
    LayoutGroup = "LayoutGroup",
    Rectangle = "Rectangle",
    Label = "Label",
    Font = "Font",
    Poster = "Poster",
    ArrayGrid = "ArrayGrid",
    MarkupGrid = "MarkupGrid",
    ContentNode = "ContentNode",
    Timer = "Timer",
    Scene = "Scene",
    MiniKeyboard = "MiniKeyboard",
    TextEditBox = "TextEditBox",
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

    public static createNode(
        nodeType: SGNodeType | string,
        nodeName?: string
    ): RoSGNode | undefined {
        let name = nodeName || nodeType;
        const additionalCtor = this.additionalNodes.get(nodeType?.toLowerCase());
        if (additionalCtor) {
            return additionalCtor(name);
        }
        switch (nodeType) {
            case SGNodeType.Group:
                return new Group([], name);
            case SGNodeType.LayoutGroup:
                return new LayoutGroup([], name);
            case SGNodeType.Node:
                return new RoSGNode([], name);
            case SGNodeType.Rectangle:
                return new Rectangle([], name);
            case SGNodeType.Label:
                return new Label([], name);
            case SGNodeType.Font:
                return new Font([], name);
            case SGNodeType.Poster:
                return new Poster([], name);
            case SGNodeType.ArrayGrid:
                return new ArrayGrid([], name);
            case SGNodeType.MarkupGrid:
                return new MarkupGrid([], name);
            case SGNodeType.ContentNode:
                return new ContentNode(name);
            case SGNodeType.Timer:
                return new Timer([], name);
            case SGNodeType.Scene:
                return new Scene([], name);
            case SGNodeType.MiniKeyboard:
                return new MiniKeyboard([], name);
            case SGNodeType.TextEditBox:
                return new TextEditBox([], name);
            default:
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
