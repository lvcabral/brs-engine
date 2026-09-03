const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot, ComponentDefinition, isSubtypeCheck, updateTypeDefHierarchy, getNodeType } = scenegraph;
const { Interpreter, BrsString } = core;

/**
 * RenderableNode is a real Roku SceneGraph alias for Group — Roku's own ECP node dumps report a
 * plain Group's tag as "RenderableNode" (see external/dev-doc's external-control-api.md sample:
 * `<RenderableNode ... name="posterGroup" .../>`), and `extends="RenderableNode"` is accepted in
 * place of `extends="Group"` in a component's XML. `CreateObject("roSGNode", "RenderableNode")`
 * must behave exactly like `CreateObject("roSGNode", "Group")`.
 */
describe("RenderableNode (Group alias)", () => {
    beforeAll(() => {
        // subtypeHierarchy is populated lazily, as a side effect of each node class's constructor
        // (setExtendsType), not from a static table — so "group" -> "Node" only exists once some
        // Group has been instantiated. Seed it once so the isSubtype/getNodeType chains below (which
        // walk all the way up to "Node") don't depend on incidental ordering against other tests.
        SGNodeFactory.createNode("Group");
    });

    afterEach(() => {
        sgRoot.setNodeDefMap(new Map());
    });

    describe("factory wiring", () => {
        test("CreateObject('roSGNode', 'RenderableNode') resolves to a Group instance", () => {
            const node = SGNodeFactory.createNode("RenderableNode");
            expect(node).toBeDefined();
            expect(node.constructor.name).toBe("Group");
        });

        /**
         * Regression: the Group-rename check used `name === SGNodeType.RenderableNode`, a
         * case-SENSITIVE comparison, while the switch that dispatches here already lowercases
         * (`nodeType.toLowerCase()`). Since `name` defaults to the caller's original-case
         * `nodeType` (nodeName is undefined for a direct CreateObject call), any non-canonical
         * casing reached this branch but failed the rename check, leaving nodeSubtype as the
         * caller's literal string ("renderablenode", "RENDERABLENODE", ...) instead of "Group" -
         * splitting one canonical type into several distinct-looking ones by casing alone.
         */
        test.each(["renderablenode", "RENDERABLENODE", "RenderableNode", "ReNderaBLenode"])(
            "is case-insensitive, like every other node type name (%s)",
            (typeName) => {
                const node = SGNodeFactory.createNode(typeName);
                expect(node.constructor.name).toBe("Group");
                expect(node.nodeSubtype).toBe("Group");
            }
        );

        test("reports its own subtype as 'Group' when created directly (no explicit id)", () => {
            const node = SGNodeFactory.createNode("RenderableNode");
            expect(node.nodeSubtype).toBe("Group");
        });

        test("an explicit node name is preserved (the path used by a custom component's extends chain)", () => {
            // Mirrors how initializeNode()/createNodeByTypeDef() call the factory: nodeType is the
            // `extends` value, nodeName is the custom component's own name. Uses a name unique to
            // this test so it doesn't pollute the shared subtypeHierarchy map used by the tests below.
            const node = SGNodeFactory.createNode("RenderableNode", "CustomNamedRenderable");
            expect(node.constructor.name).toBe("Group");
            expect(node.nodeSubtype).toBe("CustomNamedRenderable");
        });

        test("canResolveNodeType('RenderableNode') is true", () => {
            expect(SGNodeFactory.canResolveNodeType("RenderableNode")).toBe(true);
            expect(SGNodeFactory.canResolveNodeType("renderablenode")).toBe(true);
        });

        test("behaves like a plain Group: accepts children and exposes Group's fields", () => {
            const node = SGNodeFactory.createNode("RenderableNode");
            const child = SGNodeFactory.createNode("Group");
            node.appendChildToParent(child);

            expect(node.getNodeChildren()).toEqual([child]);
            expect(node.getValueJS("visible")).toBe(true);
            expect(node.getValueJS("opacity")).toBe(1);
        });
    });

    describe("isSubtype hierarchy", () => {
        test("RenderableNode and Group are mutually recognized as the same type", () => {
            expect(isSubtypeCheck("Group", "RenderableNode")).toBe(true);
            expect(isSubtypeCheck("RenderableNode", "Group")).toBe(true);
            expect(isSubtypeCheck("renderablenode", "group")).toBe(true);
        });

        test("m.top.isSubtype('RenderableNode') returns true for a plain Group node (BrightScript surface)", () => {
            const node = SGNodeFactory.createNode("Group");
            const interpreter = new Interpreter();
            const isSubtype = node.getMethod("isSubtype");
            const result = interpreter.call(isSubtype, [new BrsString("RenderableNode")], node.m, interpreter.location);
            expect(result.value).toBe(true);
        });

        /**
         * Regression: isSubtypeCheck only normalized its `checkType` argument ("RenderableNode" ->
         * "group"), not `currentNodeType`. A custom component that extends "RenderableNode" directly
         * registers that literal string as its parent in subtypeHierarchy, so the recursive walk's
         * `currentNodeType` becomes "renderablenode" mid-chain — which was never in the hierarchy
         * map (only custom component names are), dead-ending the walk and reporting the component as
         * NOT a subtype of Group or Node. Fixed by normalizing both sides on every recursive call.
         */
        test('a custom component with extends="RenderableNode" is recognized as a Group/Node subtype', () => {
            const def = new ComponentDefinition("pkg:/components/MyRenderable.xml");
            def.name = "MyRenderable";
            def.xmlNode = { attr: { name: "MyRenderable", extends: "RenderableNode" } };
            sgRoot.setNodeDefMap(new Map([["myrenderable", def]]));
            updateTypeDefHierarchy(def);

            expect(isSubtypeCheck("MyRenderable", "RenderableNode")).toBe(true);
            expect(isSubtypeCheck("MyRenderable", "Group")).toBe(true);
            expect(isSubtypeCheck("MyRenderable", "Node")).toBe(true);
            expect(isSubtypeCheck("MyRenderable", "Rectangle")).toBe(false);
        });

        test("a two-level custom chain through RenderableNode still resolves to Group/Node", () => {
            const base = new ComponentDefinition("pkg:/components/MyRenderable.xml");
            base.name = "MyRenderable";
            base.xmlNode = { attr: { name: "MyRenderable", extends: "RenderableNode" } };
            const derived = new ComponentDefinition("pkg:/components/MyRenderableChild.xml");
            derived.name = "MyRenderableChild";
            derived.xmlNode = { attr: { name: "MyRenderableChild", extends: "MyRenderable" } };
            sgRoot.setNodeDefMap(
                new Map([
                    ["myrenderable", base],
                    ["myrenderablechild", derived],
                ])
            );
            updateTypeDefHierarchy(derived);

            expect(isSubtypeCheck("MyRenderableChild", "MyRenderable")).toBe(true);
            expect(isSubtypeCheck("MyRenderableChild", "RenderableNode")).toBe(true);
            expect(isSubtypeCheck("MyRenderableChild", "Group")).toBe(true);
            expect(isSubtypeCheck("MyRenderableChild", "Node")).toBe(true);
        });
    });

    describe("getNodeType", () => {
        test("a plain RenderableNode-created node resolves its base type as Group", () => {
            expect(getNodeType("Group")).toBe("Group");
        });

        test("a custom component extending RenderableNode resolves its base type through the alias", () => {
            const def = new ComponentDefinition("pkg:/components/MyRenderable.xml");
            def.name = "MyRenderable";
            def.xmlNode = { attr: { name: "MyRenderable", extends: "RenderableNode" } };
            sgRoot.setNodeDefMap(new Map([["myrenderable", def]]));
            updateTypeDefHierarchy(def);

            expect(getNodeType("MyRenderable")).toBe("RenderableNode");
        });
    });
});
