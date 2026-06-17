const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");

const { RoRenderThreadQueue, getRenderThreadQueue, sgRoot } = scenegraph;

describe("roRenderThreadQueue", () => {
    test("constructs as a roRenderThreadQueue component", () => {
        const queue = new RoRenderThreadQueue();
        expect(queue.getComponentName()).toBe("roRenderThreadQueue");
    });

    test("getRenderThreadQueue returns the per-thread singleton", () => {
        expect(getRenderThreadQueue()).toBe(getRenderThreadQueue());
    });

    test("enqueue then drain reports pending work and clears the queue", () => {
        const queue = new RoRenderThreadQueue();
        queue.enqueue("evt", { foo: "bar" });

        // No handler registered for "evt": drain reports it had pending work but invokes nothing,
        // so the interpreter argument is never touched.
        expect(queue.drain({})).toBe(true);
        // Pending was cleared, so a second drain has nothing to do.
        expect(queue.drain({})).toBe(false);
    });

    test("sgRoot routes a posted message to the registered render-thread queue", () => {
        const queue = new RoRenderThreadQueue();
        sgRoot.registerRenderQueue(queue);

        sgRoot.enqueueRenderQueueMessage("evt", { a: 1 });
        expect(queue.drain({})).toBe(true);
        expect(queue.drain({})).toBe(false);
    });
});
