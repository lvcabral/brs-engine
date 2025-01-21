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
} from "..";

export enum BrsNodeType {
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

// TODO: update with more components as they're implemented.
export class NodeFactory {
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

    public static createComponent(
        nodeType: BrsNodeType | string,
        nodeName?: string
    ): RoSGNode | undefined {
        let name = nodeName || nodeType;
        const additionalCtor = this.additionalNodes.get(nodeType?.toLowerCase());
        if (additionalCtor) {
            return additionalCtor(name);
        }
        switch (nodeType) {
            case BrsNodeType.Group:
                return new Group([], name);
            case BrsNodeType.LayoutGroup:
                return new LayoutGroup([], name);
            case BrsNodeType.Node:
                return new RoSGNode([], name);
            case BrsNodeType.Rectangle:
                return new Rectangle([], name);
            case BrsNodeType.Label:
                return new Label([], name);
            case BrsNodeType.Font:
                return new Font([], name);
            case BrsNodeType.Poster:
                return new Poster([], name);
            case BrsNodeType.ArrayGrid:
                return new ArrayGrid([], name);
            case BrsNodeType.MarkupGrid:
                return new MarkupGrid([], name);
            case BrsNodeType.ContentNode:
                return new ContentNode(name);
            case BrsNodeType.Timer:
                return new Timer([], name);
            case BrsNodeType.Scene:
                return new Scene([], name);
            case BrsNodeType.MiniKeyboard:
                return new MiniKeyboard([], name);
            case BrsNodeType.TextEditBox:
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
    public static canResolveComponentType(nodeType: BrsNodeType | string): boolean {
        return this.additionalNodes.has(nodeType?.toLowerCase()) || nodeType in BrsNodeType;
    }
}
