const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Node, sgRoot, SGNodeFactory } = scenegraph;
const { Interpreter, BrsString, BrsInvalid, isInvalid } = core;

/**
 * Device-confirmed: `m.global.getParent()` returns the Scene, so the global node's nearest
 * component ancestor is the Scene and the ordinary ifSGNodeDict search reaches the scene tree.
 * Apps rely on this to find a screen from a still-detached component (e.g. a module whose setup
 * runs before it is inserted). The global singleton is parentless here, so findNode searches the
 * scene explicitly to reach the same result.
 */
describe("m.global.findNode scene fallback", () => {
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
