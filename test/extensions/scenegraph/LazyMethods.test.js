const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory } = scenegraph;
const { Callable } = core;

/**
 * Lazy method construction: a node's ~70 `roSGNode` method Callables are the dominant per-instance
 * memory cost on large content trees. They are now built on demand — BrsComponent invokes the node's
 * `buildMethods()` the first time a method or interface is looked up, so a data-only node never
 * allocates them. These tests assert dispatch, interface reflection, and subclass overrides still
 * resolve correctly through the lazy path.
 */
describe("SceneGraph lazy method construction", () => {
    test("getMethod resolves base roSGNode methods on a fresh node", () => {
        const node = SGNodeFactory.createNode("Node");
        // First method lookup triggers buildMethods() under the hood.
        expect(node.getMethod("getfield")).toBeInstanceOf(Callable);
        expect(node.getMethod("observefield")).toBeInstanceOf(Callable);
        expect(node.getMethod("appendchild")).toBeInstanceOf(Callable);
        // An unknown method is still undefined.
        expect(node.getMethod("nosuchmethod")).toBeUndefined();
    });

    test("hasInterface triggers the lazy build and reports the node interfaces", () => {
        const node = SGNodeFactory.createNode("Node");
        expect(node.hasInterface("ifSGNodeField")).toBe(true);
        expect(node.hasInterface("ifSGNodeChildren")).toBe(true);
        expect(node.hasInterface("ifHttpAgent")).toBe(true);
        expect(node.hasInterface("ifNotAThing")).toBe(false);
    });

    test("ContentNode's overridden AA methods resolve through the lazy path", () => {
        const node = SGNodeFactory.createNode("ContentNode");
        // count/keys/items/hasField are overridden by ContentNode in its buildMethods() after super's.
        for (const name of ["count", "keys", "items", "hasfield"]) {
            const method = node.getMethod(name);
            expect(method).toBeInstanceOf(Callable);
            expect(method.name.toLowerCase()).toBe(name);
        }
    });

    test("repeated getMethod returns a stable (cached) Callable instance", () => {
        const node = SGNodeFactory.createNode("Node");
        const first = node.getMethod("getfield");
        const second = node.getMethod("getfield");
        // Built once and cached in the component method map — same object both times.
        expect(second).toBe(first);
    });
});
