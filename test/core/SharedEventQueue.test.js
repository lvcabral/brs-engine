const { SharedEventQueue } = require("../../packages/node/bin/brs.node");

describe("SharedEventQueue", () => {
    it("drains nothing from a fresh queue", () => {
        const queue = new SharedEventQueue();
        expect(queue.drain()).toEqual([]);
    });

    it("preserves push order across multiple frames drained in one call", () => {
        const queue = new SharedEventQueue();
        queue.push({ type: "text", text: "one" });
        queue.push({ type: "text", text: "two" });
        queue.push({ type: "text", text: "three" });
        expect(queue.drain()).toEqual([
            { type: "text", text: "one" },
            { type: "text", text: "two" },
            { type: "text", text: "three" },
        ]);
    });

    it("empties after a drain, so a second drain returns nothing new", () => {
        const queue = new SharedEventQueue();
        queue.push({ type: "text", text: "one" });
        queue.drain();
        expect(queue.drain()).toEqual([]);
    });

    it("supports interleaved push/drain cycles", () => {
        const queue = new SharedEventQueue();
        queue.push({ type: "a" });
        expect(queue.drain()).toEqual([{ type: "a" }]);
        queue.push({ type: "b" });
        queue.push({ type: "c" });
        expect(queue.drain()).toEqual([{ type: "b" }, { type: "c" }]);
    });

    it("grows the backing buffer to hold a payload larger than the initial size", () => {
        const queue = new SharedEventQueue(64, 1024 * 1024);
        const bigText = "x".repeat(2000);
        queue.push({ type: "text", text: bigText });
        expect(queue.drain()).toEqual([{ type: "text", text: bigText }]);
    });

    it("drops a push that would exceed the configured max size, without throwing", () => {
        const errors = [];
        const queue = new SharedEventQueue(64, 256);
        queue.onError = (message) => errors.push(message);
        expect(() => queue.push({ type: "text", text: "x".repeat(1000) })).not.toThrow();
        expect(queue.drain()).toEqual([]);
        expect(errors.length).toBeGreaterThan(0);
    });

    it("crosses a real thread boundary via SharedArrayBuffer (fromBuffer)", async () => {
        const producer = new SharedEventQueue();
        const consumer = SharedEventQueue.fromBuffer(producer.getBuffer());

        const { Worker } = require("worker_threads");
        // Push from a genuinely separate thread to prove this isn't just same-object aliasing —
        // the whole point of SharedEventQueue is cross-thread delivery via Atomics, not JS
        // reference sharing within one thread.
        const worker = new Worker(
            `
            const { parentPort, workerData } = require("worker_threads");
            const view = new Int32Array(workerData.buffer);
            const lockIdx = 1, writeOffsetIdx = 0, headerBytes = 8;
            function withLock(fn) {
                while (Atomics.compareExchange(view, lockIdx, 0, 1) !== 0) {}
                try { fn(); } finally { Atomics.store(view, lockIdx, 0); }
            }
            const bytes = Buffer.from(JSON.stringify({ type: "fromWorker" }));
            withLock(() => {
                const writeOffset = Atomics.load(view, writeOffsetIdx);
                const dv = new DataView(workerData.buffer);
                dv.setUint32(headerBytes + writeOffset, bytes.length, true);
                new Uint8Array(workerData.buffer).set(bytes, headerBytes + writeOffset + 4);
                Atomics.store(view, writeOffsetIdx, writeOffset + 4 + bytes.length);
            });
            parentPort.postMessage("done");
            `,
            { eval: true, workerData: { buffer: producer.getBuffer() } }
        );
        await new Promise((resolve) => worker.once("message", resolve));
        await worker.terminate();

        expect(consumer.drain()).toEqual([{ type: "fromWorker" }]);
    });
});
