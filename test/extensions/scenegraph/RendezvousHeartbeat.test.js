const { Worker } = require("node:worker_threads");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Task, rendezvousDeadline } = scenegraph;
const { BrsDevice, DataType, DataBufferIndex, SharedObject } = core;

/**
 * A rendezvous is only served when the render thread reaches its message loop, so app code that runs
 * for a long time inside a single callback (a screen building hundreds of components) leaves a
 * waiting Task with no answer for as long as that code runs. Timing out on wall time turned that into
 * a crash; the wait is measured against the render thread's heartbeat instead, so it only fails when
 * the render thread stops executing BrightScript altogether — the deadlock the timeout is for.
 */
describe("rendezvous render-thread heartbeat", () => {
    let sharedArray;
    let previousArray;
    let previousThread;
    let previousPost;

    beforeEach(() => {
        previousArray = BrsDevice.sharedArray;
        previousThread = BrsDevice.threadId;
        previousPost = global.postMessage;
        const buffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * (DataBufferIndex + 16));
        sharedArray = new Int32Array(buffer);
        sharedArray.fill(-1);
        BrsDevice.setSharedArray(sharedArray);
        global.postMessage = vi.fn();
    });

    afterEach(() => {
        global.postMessage = previousPost;
        BrsDevice.threadId = previousThread;
        if (previousArray) {
            BrsDevice.setSharedArray(previousArray);
        }
    });

    /** Builds a Task as it exists inside its own worker: the side that blocks on a rendezvous. */
    function taskSideTask() {
        const task = new Task([], "MyTask");
        task.threadId = 1;
        task.active = true;
        task.inThread = true;
        task.setTaskBuffer(new SharedObject().getBuffer());
        // Responses land on the dedicated buffer, so the wait never reads back its own request.
        task.setDirectBuffer(new SharedObject().getBuffer());
        BrsDevice.threadId = 1;
        return task;
    }

    test("the countdown expires while the render thread is silent", () => {
        const countdown = rendezvousDeadline(50, () => "get node.foo");
        expect(countdown.remaining()).toBeGreaterThan(0);
        const started = Date.now();
        while (Date.now() - started < 60) {
            // Busy-wait: no heartbeat is published, so nothing extends the deadline.
        }
        expect(countdown.remaining()).toBeLessThanOrEqual(0);
    });

    test("the countdown restarts every time the render thread's heartbeat advances", () => {
        const countdown = rendezvousDeadline(50, () => "get node.foo");
        const started = Date.now();
        while (Date.now() - started < 60) {
            // Same elapsed time as above, but the render thread is executing statements.
            Atomics.add(sharedArray, DataType.RHB, 1);
        }
        expect(countdown.remaining()).toBeGreaterThan(0);
    });

    test("a task thread never publishes the heartbeat", () => {
        // The waiter's own execution must not keep its wait alive; only thread 0 writes the slot.
        BrsDevice.threadId = 1;
        Atomics.store(sharedArray, DataType.RHB, 7);
        BrsDevice.checkBreakCommand(false);
        expect(Atomics.load(sharedArray, DataType.RHB)).toBe(7);

        BrsDevice.threadId = 0;
        BrsDevice.checkBreakCommand(false);
        expect(Atomics.load(sharedArray, DataType.RHB)).not.toBe(7);
    });

    test("a blocking read times out when the render thread publishes nothing", () => {
        const task = taskSideTask();
        const started = Date.now();
        expect(() => task.requestFieldValue("node", "ADDR0001", "foo", 150)).toThrow(/Rendezvous timeout/);
        expect(Date.now() - started).toBeGreaterThanOrEqual(140);
    });

    test("a blocking read outlives its timeout while the render thread keeps running", async () => {
        const task = taskSideTask();
        // The wait blocks this thread, so the heartbeat has to come from a real second thread —
        // exactly the arrangement it models: a render thread busy in app code for far longer than
        // the rendezvous timeout.
        const beater = new Worker(
            `const { workerData } = require("node:worker_threads");
             const array = new Int32Array(workerData.buffer);
             const until = Date.now() + workerData.runMs;
             while (Date.now() < until) {
                 Atomics.add(array, workerData.slot, 1);
                 Atomics.wait(array, workerData.idle, -1, 10); // sleep 10ms: the slot holds -1
             }`,
            {
                eval: true,
                workerData: { buffer: sharedArray.buffer, slot: DataType.RHB, idle: DataType.DBT, runMs: 700 },
            }
        );
        try {
            const started = Date.now();
            expect(() => task.requestFieldValue("node", "ADDR0001", "foo", 150)).toThrow(/Rendezvous timeout/);
            // Failed only after the heartbeat stopped, not 150ms in.
            expect(Date.now() - started).toBeGreaterThan(600);
        } finally {
            await beater.terminate();
        }
    });
});
