const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");

const { RenderThreadQueue, sgRoot } = scenegraph;

describe("roRenderThreadQueue", () => {
    test("constructs as a RenderThreadQueue node", () => {
        const queue = new RenderThreadQueue();
        expect(queue.nodeSubtype).toBe("RenderThreadQueue");
        expect(queue.getAddress()).toBeTruthy();
    });

    test("enqueue then drain reports pending work and clears the queue", () => {
        const queue = new RenderThreadQueue();
        queue.enqueue("evt", { foo: "bar" });

        // No handler registered for "evt": drain reports it had pending work but invokes nothing,
        // so the interpreter argument is never touched.
        expect(queue.drain({})).toBe(true);
        // Pending was cleared, so a second drain has nothing to do.
        expect(queue.drain({})).toBe(false);
    });

    test("sgRoot routes a posted message to the matching queue by address", () => {
        const queue = new RenderThreadQueue();
        sgRoot.registerRenderQueue(queue);

        sgRoot.enqueueRenderQueueMessage(queue.getAddress(), "evt", { a: 1 });
        expect(queue.drain({})).toBe(true);
        expect(queue.drain({})).toBe(false);

        // An unknown address is a no-op (no queue registered for it).
        sgRoot.enqueueRenderQueueMessage("DEADBEEF", "evt", { a: 1 });
        expect(queue.drain({})).toBe(false);
    });
});
