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
    task.started = true; // launched: fan-out is only handed over once the task is running
    task.inThread = false;
    return task;
}

/**
 * Builds a task-thread Task whose incoming (fan-out) buffer shares a SAB with the returned writer,
 * standing in for the render thread's `fanoutBuffer`.
 */
function taskSideTask() {
    const task = new Task([], "MyTask");
    task.threadId = 1;
    task.inThread = true;
    const writer = new SharedObject();
    task.setTaskBuffer(writer.getBuffer());
    return { task, writer };
}

const setUpdate = (key, value = 0) => ({ id: 0, action: "set", type: "node", address: "ABC123", key, value });

describe("Phase 3a direct rendezvous responses", () => {
    let originalPostMessage;
    beforeEach(() => {
        originalPostMessage = global.postMessage;
        global.postMessage = vi.fn();
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
        global.postMessage = vi.fn();
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

    test("flush packs consecutive sets into one batch in the single slot (#1263)", () => {
        const task = renderSideTask();
        const reader = attachFanout(task);

        task.syncRemoteField("a", new BrsString("1"), "node", "ABC123");
        task.syncRemoteField("b", new BrsString("2"), "node", "ABC123");

        task.flushFanout();
        expect(reader.getVersion()).toBe(1);
        const payload = reader.load(true); // resets version to 0
        expect(payload.batch.map((update) => update.key)).toEqual(["a", "b"]);

        task.flushFanout(); // nothing left queued
        expect(reader.getVersion()).toBe(0);
    });

    test("flush respects the single slot: a non-set update travels alone and waits for the reader", () => {
        const task = renderSideTask();
        const reader = attachFanout(task);

        task.syncRemoteField("a", new BrsString("1"), "node", "ABC123");
        task.fanoutQueue.push({ id: 1, action: "call", type: "node", address: "ABC123", key: "fn", value: [] });
        task.syncRemoteField("b", new BrsString("2"), "node", "ABC123");

        task.flushFanout();
        expect(reader.getVersion()).toBe(1);
        task.flushFanout(); // slot still occupied: nothing more is written
        expect(task.fanoutQueue.length).toBe(2);
        expect(reader.load(true).key).toBe("a");

        task.flushFanout();
        expect(reader.load(true).action).toBe("call");

        task.flushFanout();
        expect(reader.load(true).key).toBe("b");
    });

    test("a task that hasn't launched keeps its fan-out queued for the launch replay to dedupe (#1264)", () => {
        const task = renderSideTask();
        task.started = false; // activated (control = "run") but not launched by checkTaskRun yet
        const reader = attachFanout(task);

        task.syncRemoteField("a", new BrsString("1"), "node", "ABC123");
        task.flushFanout();
        // Handing it over now would leave dropFanoutCoveredByReplay nothing to drop: delivered twice.
        expect(reader.getVersion()).toBe(0);
        expect(task.fanoutQueue.length).toBe(1);

        task.started = true;
        task.flushFanout();
        expect(reader.load(true).key).toBe("a");
    });

    test("an update that would push a batch over the byte cap waits for the next hand-off (#1264)", () => {
        const task = renderSideTask();
        const reader = attachFanout(task);

        task.syncRemoteField("small", new BrsString("x"), "node", "ABC123");
        task.syncRemoteField("big", new BrsString("y".repeat(400 * 1024)), "node", "ABC123"); // > 1MB as UTF-8 bound

        task.flushFanout();
        // Not packed with `big`: the batch stays under the cap, and `big` is still queued, not dropped.
        expect(reader.load(true).key).toBe("small");
        expect(task.fanoutQueue.length).toBe(1);

        task.flushFanout(); // too big for the cap on its own: travels alone, as before batching
        const big = reader.load(true);
        expect(big.key).toBe("big");
        expect(big.value.length).toBe(400 * 1024);
    });

    test("without a fan-out buffer (flag off), fan-out falls back to the broker", () => {
        const task = renderSideTask(); // no fanoutBuffer
        task.syncRemoteField("foo", new BrsString("bar"), "node", "ABC123");
        expect(global.postMessage).toHaveBeenCalledTimes(1);
    });

    test("render-side fan-out does not re-own the node (ownership stays render-authoritative)", () => {
        const task = renderSideTask();
        attachFanout(task);

        // A node owned by a task thread, held in a render-owned field being fanned out. Re-owning it to
        // thread 0 here would recurse into its children and corrupt the live tree (the rokanban bug).
        const node = new Task([], "Inner");
        node.setOwner(7);
        task.syncRemoteField("foo", node, "node", "ABC123");

        expect(node.getOwner()).toBe(7); // unchanged on the render side
    });

    test("a task-thread set on its OWN field DOES re-own the node to the render thread", () => {
        const task = renderSideTask();
        task.inThread = true; // simulate running on the task worker
        const node = new Task([], "Inner");
        node.setOwner(7);
        // address === task.address: setting the task's own interface field.
        task.syncRemoteField("foo", node, "node", task.address);

        expect(node.getOwner()).toBe(0); // crossed task -> render, now render-owned
    });

    test("a task-thread set on a FOREIGN node's field does NOT re-own the node", () => {
        const task = renderSideTask();
        task.inThread = true; // simulate running on the task worker
        const node = new Task([], "Inner");
        node.setOwner(7);
        // address !== task.address: setting a field on some OTHER render-owned node.
        task.syncRemoteField("foo", node, "node", "ABC123");

        expect(node.getOwner()).toBe(7); // unchanged — still owned by the task that built it
    });

    test("a non-serializable fan-out is dropped without throwing; the rest still flush", () => {
        const task = renderSideTask();
        const reader = attachFanout(task);

        // A payload with a cycle: JSON.stringify (used by store) throws on this. flushFanout runs on
        // the render loop, so it must swallow the error, drop the bad update, and keep draining.
        const cyclic = { id: 1, action: "set", type: "node", address: "ABC123", key: "bad", value: {} };
        cyclic.value.self = cyclic.value;
        task.fanoutQueue.push(cyclic);
        task.syncRemoteField("good", new BrsString("ok"), "node", "ABC123");

        expect(() => task.flushFanout()).not.toThrow();
        // Bad update dropped (version untouched by it), good update delivered into the single slot.
        expect(reader.getVersion()).toBe(1);
        expect(reader.load(true).key).toBe("good");
    });
});

describe("Task-side fan-out batch application", () => {
    test("a re-entrant tick neither applies the rest of the batch inside the running item nor loads the next batch (#1264)", () => {
        const { task, writer } = taskSideTask();
        const applied = [];
        const nestedResults = [];
        task.applyThreadUpdate = (update) => {
            applied.push(update.key);
            if (update.key === "a") {
                // Item `a` runs BrightScript on the task thread (an XML onChange) whose tick re-enters,
                // after render has already refilled the slot (loading reset it).
                writer.store({ batch: [setUpdate("d")] });
                nestedResults.push(task.processThreadUpdate());
            }
            return update;
        };
        writer.store({ batch: [setUpdate("a"), setUpdate("b"), setUpdate("c")] });

        task.processThreadUpdate();
        expect(nestedResults).toEqual([undefined]);
        expect(applied).toEqual(["a", "b", "c"]);

        task.processThreadUpdate(); // the refilled slot is picked up on the next call
        expect(applied).toEqual(["a", "b", "c", "d"]);
    });

    test("an item that throws doesn't take the rest of its batch with it (#1264)", () => {
        const { task, writer } = taskSideTask();
        const applied = [];
        task.applyThreadUpdate = (update) => {
            applied.push(update.key);
            if (update.key === "b") {
                throw new Error("onChange threw");
            }
            return update;
        };
        writer.store({ batch: [setUpdate("a"), setUpdate("b"), setUpdate("c"), setUpdate("d")] });

        expect(() => task.processThreadUpdate()).toThrow("onChange threw");
        expect(applied).toEqual(["a", "b"]);

        // The slot already reads idle; the remaining items are still applied, `b` is not re-applied.
        expect(writer.getVersion()).toBe(0);
        task.processThreadUpdate();
        expect(applied).toEqual(["a", "b", "c", "d"]);
    });
});
