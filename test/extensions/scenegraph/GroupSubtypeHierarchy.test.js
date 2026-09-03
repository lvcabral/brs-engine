const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot, ComponentDefinition, isSubtypeCheck, updateTypeDefHierarchy, subtypeHierarchy } =
    scenegraph;
const { Interpreter, BrsString } = core;

/**
 * Regression for the built-in SceneGraph class hierarchy collapsing to "Node" for every node type
 * beyond a direct Group child (RowList.isSubtype("ArrayGrid") etc. incorrectly returned false),
 * and for a custom XML component whose `extends` is a multi-level built-in type getting its
 * hierarchy entry silently clobbered during construction. See `setExtendsType`'s doc comment in
 * src/extensions/scenegraph/nodes/Node.ts for the full root-cause explanation and fix.
 */
describe("Built-in SceneGraph class hierarchy (subtypeHierarchy)", () => {
    beforeAll(() => {
        // Some node types (Label-based, dialogs, keyboards) resolve a default Font on construction.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        core.BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setNodeDefMap(new Map());
    });

    describe("immediate-parent registration (setExtendsType overwrite)", () => {
        test.each([
            ["Rectangle", "Group"],
            ["Poster", "Group"],
            ["RowList", "ArrayGrid"],
            ["ZoomRowList", "ArrayGrid"],
            ["MarkupGrid", "ArrayGrid"],
            ["LabelList", "ArrayGrid"],
            ["CheckList", "LabelList"],
            ["RadioButtonList", "LabelList"],
            ["ButtonGroup", "LayoutGroup"],
            ["StdDlgButtonArea", "ButtonGroup"],
            ["MonospaceLabel", "Label"],
            ["ScrollingLabel", "Label"],
            ["VoiceTextEditBox", "TextEditBox"],
            ["TargetList", "TargetGroup"],
            ["OverhangPanelSetScene", "Scene"],
            ["ParentalControlPinPad", "PinPad"],
            ["StdDlgButton", "Button"],
            ["GridPanel", "Panel"],
            ["ListPanel", "Panel"],
            ["KeyboardDialog", "Dialog"],
            ["PinDialog", "Dialog"],
            ["ProgressDialog", "Dialog"],
            ["StandardPinPadDialog", "StandardDialog"],
            ["StandardKeyboardDialog", "StandardDialog"],
            ["DynamicKeyboard", "DynamicKeyboardBase"],
            ["DynamicPinPad", "DynamicKeyboardBase"],
        ])("%s's registered immediate parent is %s, not Node", (type, expectedParent) => {
            SGNodeFactory.createNode(type);
            expect(subtypeHierarchy.get(type.toLowerCase())).toBe(expectedParent);
        });
    });

    describe("isSubtype walks the full chain deterministically (no incidental construction needed)", () => {
        test("a freshly-constructed RowList resolves all the way to Group and Node", () => {
            SGNodeFactory.createNode("RowList");
            expect(isSubtypeCheck("RowList", "ArrayGrid")).toBe(true);
            expect(isSubtypeCheck("RowList", "Group")).toBe(true);
            expect(isSubtypeCheck("RowList", "Node")).toBe(true);
        });

        test("a freshly-constructed CheckList resolves through LabelList and ArrayGrid to Group", () => {
            SGNodeFactory.createNode("CheckList");
            expect(isSubtypeCheck("CheckList", "LabelList")).toBe(true);
            expect(isSubtypeCheck("CheckList", "ArrayGrid")).toBe(true);
            expect(isSubtypeCheck("CheckList", "Group")).toBe(true);
            expect(isSubtypeCheck("CheckList", "Node")).toBe(true);
        });

        test("a freshly-constructed StdDlgButtonArea resolves through ButtonGroup and LayoutGroup to Group", () => {
            SGNodeFactory.createNode("StdDlgButtonArea");
            expect(isSubtypeCheck("StdDlgButtonArea", "ButtonGroup")).toBe(true);
            expect(isSubtypeCheck("StdDlgButtonArea", "LayoutGroup")).toBe(true);
            expect(isSubtypeCheck("StdDlgButtonArea", "Group")).toBe(true);
        });

        /**
         * ListPanel is the one built-in class that extends another hub (GridPanel) purely for
         * implementation reuse but never calls setExtendsType itself - Roku documents it as
         * extending Panel directly. It must still resolve correctly even though nothing else in
         * its own file registers a hierarchy entry.
         */
        test("a freshly-constructed ListPanel resolves to Panel (not GridPanel) and on to Group/Node", () => {
            SGNodeFactory.createNode("ListPanel");
            expect(isSubtypeCheck("ListPanel", "Panel")).toBe(true);
            expect(isSubtypeCheck("ListPanel", "Group")).toBe(true);
            expect(isSubtypeCheck("ListPanel", "Node")).toBe(true);
            expect(isSubtypeCheck("ListPanel", "GridPanel")).toBe(false);
        });

        test("unrelated built-in branches are still NOT subtypes of each other", () => {
            SGNodeFactory.createNode("Rectangle");
            SGNodeFactory.createNode("RowList");
            expect(isSubtypeCheck("Rectangle", "ArrayGrid")).toBe(false);
            expect(isSubtypeCheck("RowList", "Rectangle")).toBe(false);
            expect(isSubtypeCheck("RowList", "LabelList")).toBe(false);
        });

        test("m.top.isSubtype('ArrayGrid') is true for an actual RowList node (BrightScript surface)", () => {
            const node = SGNodeFactory.createNode("RowList");
            const interpreter = new Interpreter();
            const isSubtype = node.getMethod("isSubtype");
            const result = interpreter.call(isSubtype, [new BrsString("ArrayGrid")], node.m, interpreter.location);
            expect(result.value).toBe(true);
        });

        test("m.top.parentSubtype() reports the immediate parent, not the flattened root", () => {
            const node = SGNodeFactory.createNode("RowList");
            const interpreter = new Interpreter();
            const parentSubtype = node.getMethod("parentSubtype");
            const result = interpreter.call(parentSubtype, [new BrsString("RowList")], node.m, interpreter.location);
            expect(result.value).toBe("ArrayGrid");
        });
    });

    describe("a custom XML component extending a multi-level built-in type", () => {
        test("registration alone (updateTypeDefHierarchy) resolves through the full built-in chain", () => {
            const def = new ComponentDefinition("pkg:/components/MyRowList.xml");
            def.name = "MyRowList";
            def.xmlNode = { attr: { name: "MyRowList", extends: "RowList" } };
            sgRoot.setNodeDefMap(new Map([["myrowlist", def]]));
            updateTypeDefHierarchy(def);

            expect(isSubtypeCheck("MyRowList", "RowList")).toBe(true);
            expect(isSubtypeCheck("MyRowList", "ArrayGrid")).toBe(true);
            expect(isSubtypeCheck("MyRowList", "Group")).toBe(true);
            expect(isSubtypeCheck("MyRowList", "Node")).toBe(true);
            expect(isSubtypeCheck("MyRowList", "LabelList")).toBe(false);
        });

        /**
         * Regression: `initializeNode()` calls `updateTypeDefHierarchy(typeDef)` (registering
         * "mycomponent" -> "RowList", the declared `extends`) and THEN constructs the underlying
         * built-in instance via `SGNodeFactory.createNode("RowList", "MyComponent2Level")` - which
         * threads "MyComponent2Level" through RowList's own constructor chain. Before
         * setExtendsType was switched to register each class's OWN canonical type instead of the
         * threaded `name`, that construction step silently overwrote the correct
         * "mycomponent2level" -> "RowList" entry with "mycomponent2level" -> "ArrayGrid" (RowList's
         * own, unrelated fact) - so `isSubtype("RowList")` incorrectly returned false even though
         * `isSubtype("ArrayGrid")`/`isSubtype("Group")` were (accidentally) still true. Caught by a
         * device-diffing probe (test/simulator/probes/group-subtype-hierarchy-probe), not by the
         * registration-only test above, because that test never constructs the underlying node.
         */
        test("construction AFTER registration (the real initializeNode order) does not clobber the immediate parent", () => {
            const def = new ComponentDefinition("pkg:/components/MyComponent2Level.xml");
            def.name = "MyComponent2Level";
            def.xmlNode = { attr: { name: "MyComponent2Level", extends: "RowList" } };
            sgRoot.setNodeDefMap(new Map([["mycomponent2level", def]]));

            // Mirrors initializeNode()'s exact order: updateTypeDefHierarchy() first, then
            // SGNodeFactory.createNode(typeDef.extends, componentName).
            updateTypeDefHierarchy(def);
            SGNodeFactory.createNode("RowList", "MyComponent2Level");

            expect(subtypeHierarchy.get("mycomponent2level")).toBe("RowList");
            expect(isSubtypeCheck("MyComponent2Level", "RowList")).toBe(true);
            expect(isSubtypeCheck("MyComponent2Level", "ArrayGrid")).toBe(true);
            expect(isSubtypeCheck("MyComponent2Level", "Group")).toBe(true);
            expect(isSubtypeCheck("MyComponent2Level", "Node")).toBe(true);
        });
    });
});
