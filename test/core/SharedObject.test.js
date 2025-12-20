const { SharedObject } = require("../../packages/node/bin/brs.node");

function bufferToArray(bufferLike) {
    if (!bufferLike) {
        return [];
    }
    return Array.from(new Uint8Array(bufferLike));
}

async function advanceTimers(ms) {
    if (typeof jest.advanceTimersByTimeAsync === "function") {
        await jest.advanceTimersByTimeAsync(ms);
    } else {
        jest.advanceTimersByTime(ms);
        await Promise.resolve();
    }
}

describe("SharedObject", () => {
    describe("binary data helpers", () => {
        test("storeData and loadData round-trip raw bytes", () => {
            const shared = new SharedObject(64);
            const payload = new Uint8Array([0, 255, 34, 128, 16, 42]);

            shared.storeData(payload.buffer);

            const resultBuffer = shared.loadData();
            expect(bufferToArray(resultBuffer)).toEqual(bufferToArray(payload.buffer));
            expect(shared.getVersion()).toBe(1);
        });

        test("loadData optionally resets the version counter", () => {
            const shared = new SharedObject(64);
            shared.storeData(new Uint8Array([1]).buffer);
            expect(shared.getVersion()).toBe(1);

            shared.loadData(true);
            expect(shared.getVersion()).toBe(0);
        });

        test("loadData returns undefined when buffer is empty", () => {
            const shared = new SharedObject(64);
            expect(shared.loadData()).toBeUndefined();
        });
    });

    describe("JSON serialization", () => {
        test("store and load preserve object data and support reset", () => {
            const shared = new SharedObject(128);
            const payload = { foo: "bar", count: 7 };

            shared.store(payload);

            expect(shared.load()).toEqual(payload);
            expect(shared.getVersion()).toBe(1);

            expect(shared.load(true)).toEqual(payload);
            expect(shared.getVersion()).toBe(0);
        });

        test("load returns empty object when buffer is empty", () => {
            const shared = new SharedObject(64);
            expect(shared.load()).toEqual({});
        });
    });

    describe("buffer management", () => {
        test("storeData grows the buffer when payload exceeds current size", () => {
            const shared = new SharedObject(32, 1024);
            const bigPayload = new Uint8Array(512);

            shared.storeData(bigPayload.buffer);

            expect(shared.getBuffer().byteLength).toBeGreaterThanOrEqual(512 + 8);
        });

        test("setBuffer replaces the underlying buffer", () => {
            const shared = new SharedObject(32);
            const replacement = new SharedArrayBuffer(256);

            shared.setBuffer(replacement);
            shared.store({ ping: "pong" });

            expect(shared.getBuffer()).toBe(replacement);
            expect(shared.load()).toEqual({ ping: "pong" });
        });
    });

    describe("waitStore coordination", () => {
        test("waitStore stores immediately when buffer version already changed", () => {
            const shared = new SharedObject(64);
            shared.store({ initial: true });
            const queued = { field: "immediate" };

            shared.waitStore(queued, shared.getVersion() - 1, 50);

            expect(shared.load()).toEqual(queued);
        });

        test("waitStore fallback processes queued writes when version changes", async () => {
            const shared = new SharedObject(64);
            shared.store({ initial: true });
            const queued = { field: "queued" };
            const originalWaitAsync = Atomics.waitAsync;

            jest.useFakeTimers();
            Atomics.waitAsync = undefined;

            try {
                shared.waitStore(queued, shared.getVersion(), 1000);

                setTimeout(() => {
                    shared.store({ release: true });
                }, 5);

                await advanceTimers(50);
            } finally {
                Atomics.waitAsync = originalWaitAsync;
                jest.useRealTimers();
            }

            expect(shared.load()).toEqual(queued);
        });
    });
});
