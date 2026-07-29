const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Node, sgRoot, SGNodeFactory, ComponentDefinition } = scenegraph;
const { Interpreter, BrsString, isInvalid } = core;

/**
 * Device-confirmed: findNode resolves against the component scope a node belongs to, not its
 * parent chain alone. A detached plain Group built inside a Scene's script finds that Scene's
 * children; a detached *custom component* root does not, because it is its own scope.
 *
 * The executing component is approximated by `environment.hostNode`, which the engine already
 * tracks for init()/callFunc.
 */
describe("findNode falls back to the executing component's scope", () => {
    function sceneWithScreen() {
        const scene = SGNodeFactory.createNode("Scene");
        const screen = new Node([], "Group");
        screen.setValue("id", new BrsString("HomeScreen"), false);
        scene.appendChildToParent(screen);
        sgRoot.setScene(scene);
        return { scene, screen };
    }

    function callFindNode(subject, id, hostNode) {
        const interpreter = new Interpreter();
        interpreter.environment.hostNode = hostNode;
        const findNode = subject.getMethod("findnode");
        return interpreter.call(findNode, [new BrsString(id)], subject.m, interpreter.location);
    }

    afterEach(() => {
        sgRoot.setNodeDefMap(new Map());
    });

    test("a detached plain node reaches the tree of the component running the call", () => {
        const { scene, screen } = sceneWithScreen();
        const detached = new Node([], "Group");
        expect(callFindNode(detached, "HomeScreen", scene)).toBe(screen);
    });

    test("a detached custom component root is its own scope and does not borrow the caller's", () => {
        const { scene } = sceneWithScreen();
        const def = new ComponentDefinition("pkg:/components/DetachedHelper.xml");
        def.name = "DetachedHelper";
        def.xmlNode = { attr: { name: "DetachedHelper", extends: "Group" } };
        sgRoot.setNodeDefMap(new Map([["detachedhelper", def]]));

        const helper = new Node([], "DetachedHelper");
        expect(isInvalid(callFindNode(helper, "HomeScreen", scene))).toBe(true);
    });

    test("an attached node keeps using its own tree, not the caller's", () => {
        const { scene } = sceneWithScreen();
        // A separate tree that does not contain HomeScreen; the node is attached, so the
        // component-scope fallback must not apply even though the caller could reach it.
        const otherRoot = new Node([], "Group");
        const attached = new Node([], "Group");
        otherRoot.appendChildToParent(attached);

        expect(isInvalid(callFindNode(attached, "HomeScreen", scene))).toBe(true);
    });

    test("a detached node does not search its own subtree", () => {
        const { scene } = sceneWithScreen();
        // Device-confirmed: a plain node built with CreateObject and never attached has no
        // component ancestor, so its own children are not a search space however many it has.
        const detachedRoot = new Node([], "Node");
        const child = new Node([], "ContentNode");
        child.setValue("id", new BrsString("Item7"), false);
        detachedRoot.appendChildToParent(child);

        expect(isInvalid(callFindNode(detachedRoot, "Item7", scene))).toBe(true);
    });

    test("an attached node still reaches its own subtree through its component ancestor", () => {
        const { scene } = sceneWithScreen();
        const group = new Node([], "Group");
        const child = new Node([], "ContentNode");
        child.setValue("id", new BrsString("Item7"), false);
        group.appendChildToParent(child);
        scene.appendChildToParent(group);

        expect(callFindNode(group, "Item7", scene)).toBe(child);
    });

    test("a detached custom component root searches its own subtree — it is its own scope", () => {
        const { scene } = sceneWithScreen();
        const def = new ComponentDefinition("pkg:/components/DetachedHelper.xml");
        def.name = "DetachedHelper";
        def.xmlNode = { attr: { name: "DetachedHelper", extends: "Group" } };
        sgRoot.setNodeDefMap(new Map([["detachedhelper", def]]));

        const helper = new Node([], "DetachedHelper");
        const child = new Node([], "ContentNode");
        child.setValue("id", new BrsString("Inner"), false);
        helper.appendChildToParent(child);

        expect(callFindNode(helper, "Inner", scene)).toBe(child);
    });

    test("without an executing component there is no scope to fall back to", () => {
        const { scene } = sceneWithScreen();
        const detached = new Node([], "Group");
        expect(isInvalid(callFindNode(detached, "HomeScreen", undefined))).toBe(true);
        // The subject itself never counts as its own scope.
        expect(isInvalid(callFindNode(detached, "HomeScreen", detached))).toBe(true);
        expect(scene).toBeDefined();
    });
});
