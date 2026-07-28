const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Node, sgRoot, SGNodeFactory } = scenegraph;
const { Interpreter, BrsString, BrsInvalid, isInvalid } = core;

/**
 * Device-confirmed: `m.global.getParent()` returns the Scene, so the global node's nearest
 * component ancestor is the Scene and the ordinary ifSGNodeDict search reaches the scene tree.
 * Apps rely on this to find a screen from a still-detached component (e.g. a module whose setup
 * runs before it is inserted).
 */
describe("m.global is parented to the Scene", () => {
    test("getParent() reports the current Scene, and follows a Scene swap", () => {
        const scene = SGNodeFactory.createNode("Scene");
        sgRoot.setScene(scene);

        const interpreter = new Interpreter();
        const getParent = sgRoot.mGlobal.getMethod("getparent");
        expect(interpreter.call(getParent, [], sgRoot.mGlobal.m, interpreter.location)).toBe(scene);

        // Resolved on demand, so swapping the Scene never leaves a stale parent pointer.
        const nextScene = SGNodeFactory.createNode("Scene");
        sgRoot.setScene(nextScene);
        expect(interpreter.call(getParent, [], sgRoot.mGlobal.m, interpreter.location)).toBe(nextScene);
    });

    test("the global node stays out of the Scene's children", () => {
        const scene = SGNodeFactory.createNode("Scene");
        sgRoot.setScene(scene);
        // A device never renders or traverses into m.global from the Scene.
        expect(scene.getNodeChildren()).not.toContain(sgRoot.mGlobal);
    });

    test("finds a scene node by id from the global node", () => {
        const scene = SGNodeFactory.createNode("Scene");
        const screen = new Node([], "Group");
        screen.setValue("id", new BrsString("HomeScreen"), false);
        scene.appendChildToParent(screen);
        sgRoot.setScene(scene);

        const interpreter = new Interpreter();
        const findNode = sgRoot.mGlobal.getMethod("findnode");
        const found = interpreter.call(findNode, [new BrsString("HomeScreen")], sgRoot.mGlobal.m, interpreter.location);
        expect(found).toBe(screen);
    });

    test("still returns invalid when the id exists nowhere", () => {
        const scene = SGNodeFactory.createNode("Scene");
        sgRoot.setScene(scene);

        const interpreter = new Interpreter();
        const findNode = sgRoot.mGlobal.getMethod("findnode");
        const found = interpreter.call(findNode, [new BrsString("nowhere")], sgRoot.mGlobal.m, interpreter.location);
        expect(isInvalid(found)).toBe(true);
    });

    // Scoping check, not a fidelity claim: the fallback applies to the global node only.
    //
    // A device resolves findNode against the *creating component's* scope, so a detached plain
    // node built inside a component's script does reach that component's tree — which this engine
    // does not model (it has no creation-context link). Keeping the fallback narrow avoids
    // guessing at that scope; broadening it is tracked separately.
    test("the scene fallback applies to the global node only, not any detached node", () => {
        const scene = SGNodeFactory.createNode("Scene");
        const screen = new Node([], "Group");
        screen.setValue("id", new BrsString("HomeScreen"), false);
        scene.appendChildToParent(screen);
        sgRoot.setScene(scene);

        const interpreter = new Interpreter();
        const detached = new Node([], "Group");
        const findNode = detached.getMethod("findnode");
        const found = interpreter.call(findNode, [new BrsString("HomeScreen")], detached.m, interpreter.location);
        expect(isInvalid(found)).toBe(true);
        expect(found).toBe(BrsInvalid.Instance);
    });
});
