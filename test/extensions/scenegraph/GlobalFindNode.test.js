const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Node, sgRoot, SGNodeFactory } = scenegraph;
const { Interpreter, BrsString, BrsInvalid, isInvalid } = core;

/**
 * On a device the global node shares the render tree root with the scene, so
 * m.global.findNode() locates scene nodes. Apps rely on this to find a screen from a
 * still-detached component (e.g. a module whose setup runs before it is inserted).
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

    test("a regular detached node does not search the scene", () => {
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
