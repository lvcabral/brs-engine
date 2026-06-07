const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Task } = scenegraph;
const { SharedObject, BrsString } = core;

/**
 * Builds a render-side Task (inThread = false) that is active on a thread id, the role that serves
 * rendezvous and sends responses back to the requesting Task thread.
 */
function renderSideTask() {
    const task = new Task([], "MyTask");
    task.threadId = 1;
    task.active = true;
    task.inThread = false;
    return task;
}

describe("Phase 3a direct rendezvous responses", () => {
    let originalPostMessage;
    beforeEach(() => {
        originalPostMessage = global.postMessage;
        global.postMessage = jest.fn();
    });
    afterEach(() => {
        global.postMessage = originalPostMessage;
    });

    test("a response (has requestId) is written to the direct buffer, not the broker", () => {
        const task = renderSideTask();
        const backing = new SharedObject();
        task.setDirectBuffer(backing.getBuffer());

        const response = { id: 1, action: "set", type: "node", address: "ABC123", key: "foo", value: 42, requestId: 7 };
        task.sendThreadUpdate(response);

        // Delivered directly over the dedicated buffer; the broker (postMessage) is bypassed.
        expect(global.postMessage).not.toHaveBeenCalled();
        expect(backing.getVersion()).toBe(1);
        const got = backing.load(true);
        expect(got.requestId).toBe(7);
        expect(got.key).toBe("foo");
        expect(got.value).toBe(42);
    });

    test("a fan-out set (no requestId) still goes through the broker", () => {
        const task = renderSideTask();
        const backing = new SharedObject();
        task.setDirectBuffer(backing.getBuffer());

        const fanout = { id: 1, action: "set", type: "node", address: "ABC123", key: "bar", value: 1 };
        task.sendThreadUpdate(fanout);

        expect(global.postMessage).toHaveBeenCalledTimes(1);
        expect(backing.getVersion()).toBe(0); // direct buffer untouched
    });

    test("without a direct buffer (flag off), responses fall back to the broker", () => {
        const task = renderSideTask(); // no setDirectBuffer

        const response = { id: 1, action: "resp", type: "node", address: "ABC123", key: "m", value: 0, requestId: 9 };
        task.sendThreadUpdate(response);

        expect(global.postMessage).toHaveBeenCalledTimes(1);
    });
});

describe("Phase 3b direct fan-out", () => {
    let originalPostMessage;
    beforeEach(() => {
        originalPostMessage = global.postMessage;
        global.postMessage = jest.fn();
    });
    afterEach(() => {
        global.postMessage = originalPostMessage;
    });

    /** Attaches a render-side fan-out buffer to a task and returns a reader over the same SAB. */
    function attachFanout(task) {
        const writer = new SharedObject();
        task.fanoutBuffer = writer; // render-side write handle (TS-private; runtime-accessible)
        const reader = new SharedObject();
        reader.setBuffer(writer.getBuffer());
        return reader;
    }

    test("render-side fan-out is queued (not posted) and flushed into the fan-out buffer", () => {
        const task = renderSideTask();
        const reader = attachFanout(task);

        task.syncRemoteField("foo", new BrsString("bar"), "node", "ABC123");
        // Queued for the next render pass, not relayed through the broker.
        expect(global.postMessage).not.toHaveBeenCalled();
        expect(reader.getVersion()).toBe(0);

        task.flushFanout();
        expect(reader.getVersion()).toBe(1);
        const got = reader.load(true);
        expect(got.action).toBe("set");
        expect(got.key).toBe("foo");
        expect(got.value).toBe("bar");
    });

    test("flush respects the single slot: drains one, leaves the rest until the reader consumes", () => {
        const task = renderSideTask();
        const reader = attachFanout(task);

        task.syncRemoteField("a", new BrsString("1"), "node", "ABC123");
        task.syncRemoteField("b", new BrsString("2"), "node", "ABC123");

        task.flushFanout();
        expect(reader.getVersion()).toBe(1);
        expect(reader.load(true).key).toBe("a"); // resets version to 0

        task.flushFanout();
        expect(reader.load(true).key).toBe("b");
    });

    test("without a fan-out buffer (flag off), fan-out falls back to the broker", () => {
        const task = renderSideTask(); // no fanoutBuffer
        task.syncRemoteField("foo", new BrsString("bar"), "node", "ABC123");
        expect(global.postMessage).toHaveBeenCalledTimes(1);
    });
});
