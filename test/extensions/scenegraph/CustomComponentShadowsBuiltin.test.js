const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { sgRoot, createNode, getComponentDefinitionMap, setupInterpreterWithSubEnvs, SGNodeFactory } = scenegraph;
const { BrsDevice, Interpreter } = core;

/**
 * A channel may ship a component whose name is also a built-in SceneGraph node type. Measured
 * 2026-11-20 against a shipping channel that does exactly this: `components/ButtonGroup.xml`
 * declaring `extends="LayoutGroup"`. `createNode()` used to ask the built-in factory first, so
 * `<ButtonGroup>` produced the BUILT-IN ButtonGroup class: the custom component's `init()` never
 * ran (no children, no observers), its script scope had no `m.top`, and the first remote key it
 * received crashed with `'Dot' Operator attempted with invalid BrightScript Component or interface
 * reference` on `m.top.layoutDirection`. On a device the channel's own definition shadows the
 * built-in and the same screen works, so the engine has to resolve the definition first.
 *
 * The component below has no scripts beyond `init`, and it sets its own declared field from
 * `init`, so `customOnly === "inited"` proves both the shadowing and the script scope.
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
end sub

function onKeyEvent(key as String, press as Boolean) as Boolean
    return m.top.layoutDirection <> ""
end function`;

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

        expect(node).toBeDefined();
        expect(node.getValueJS("customOnly")).toBe("inited");
        // The custom component extends LayoutGroup, so the built-in field is still there and the
        // key handler that reads it no longer sees an empty `m`.
        expect(node.getValueJS("layoutDirection")).toBe("vert");
    });

    test("the component's script scope is bound, so onKeyEvent reads a live m.top", () => {
        const interpreter = registerComponent();
        const node = createNode("ButtonGroup", interpreter);

        // This is the exact read that crashed before the fix: an empty `m` (count 0) with no `top`,
        // reached from a key handler the engine had dispatched into a script it never initialised.
        expect(node.m).toBeDefined();
        expect(node.m.get(new core.BrsString("top"))).toBe(node);
        expect(node.componentDef).toBeDefined();
    });

    test("without a definition of that name the built-in node is still what you get", () => {
        const interpreter = new Interpreter();
        const builtIn = createNode("ButtonGroup", interpreter);

        expect(builtIn).toBeDefined();
        expect(builtIn.getValueJS("customOnly")).toBeUndefined();
        expect(SGNodeFactory.createNode("ButtonGroup")).toBeDefined();
    });
});
