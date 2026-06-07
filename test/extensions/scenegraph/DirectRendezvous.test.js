const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Task } = scenegraph;
const { SharedObject } = core;

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
