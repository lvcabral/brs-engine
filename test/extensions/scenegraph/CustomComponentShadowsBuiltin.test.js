const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { sgRoot, createNode, getComponentDefinitionMap, setupInterpreterWithSubEnvs, ButtonGroup, LayoutGroup } =
    scenegraph;
const { BrsDevice, Interpreter } = core;

/**
 * A channel component whose name is also a built-in node type replaces the built-in
 * (device trace: test/simulator/probes/shadow-builtin-probe). `customOnly === "inited"` proves
 * both the shadowing and the script scope.
 */
const COMPONENT_XML = `<?xml version="1.0" encoding="utf-8" ?>
<component name="ButtonGroup" extends="LayoutGroup">
    <interface>
        <field id="customOnly" type="string" value="" />
    </interface>
    <script type="text/brightscript" uri="pkg:/components/ButtonGroup.brs" />
</component>`;

const COMPONENT_BRS = `sub init()
    m.top.customOnly = "inited"
end sub`;

function registerComponent() {
    const componentDir = "pkg:/components";
    if (!BrsDevice.fileSystem.existsSync(componentDir)) {
        BrsDevice.fileSystem.mkdirSync(componentDir);
    }
    BrsDevice.fileSystem.writeFileSync(`${componentDir}/ButtonGroup.xml`, COMPONENT_XML);
    BrsDevice.fileSystem.writeFileSync(`${componentDir}/ButtonGroup.brs`, COMPONENT_BRS);
    const defs = getComponentDefinitionMap(BrsDevice.fileSystem);
    const interpreter = new Interpreter();
    setupInterpreterWithSubEnvs(interpreter, defs, new Map());
    sgRoot.setNodeDefMap(defs);
    return interpreter;
}

describe("a custom component shadows a built-in node type of the same name", () => {
    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setNodeDefMap(new Map());
    });

    test("createNode() builds the channel's component, so its init() runs", () => {
        const interpreter = registerComponent();
        const node = createNode("ButtonGroup", interpreter);

        expect(node).toBeInstanceOf(LayoutGroup);
        expect(node).not.toBeInstanceOf(ButtonGroup);
        expect(node.nodeType).toBe("LayoutGroup");
        expect(node.getValueJS("customOnly")).toBe("inited");
        // Inherited from LayoutGroup, the component's `extends`.
        expect(node.getValueJS("layoutDirection")).toBe("vert");
    });

    test("the component's script scope is bound to the node", () => {
        const interpreter = registerComponent();
        const node = createNode("ButtonGroup", interpreter);

        expect(node.m.get(new core.BrsString("top"))).toBe(node);
        expect(node.componentDef).toBeDefined();
    });

    test("without a definition of that name the built-in node is still what you get", () => {
        const interpreter = new Interpreter();
        const builtIn = createNode("ButtonGroup", interpreter);

        expect(builtIn).toBeInstanceOf(ButtonGroup);
        expect(builtIn.getValueJS("customOnly")).toBeUndefined();
    });
});
