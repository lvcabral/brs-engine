const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Task, Node, sgRoot } = scenegraph;
const { Interpreter, SharedObject, BrsString, RoMessagePort, Int32, BrsBoolean, BrsInvalid, Callable } = core;

/**
 * `callFunc` from the render thread onto a Task must rendezvous to the Task's own worker thread —
 * a Task's callable interface functions always run there, regardless of which thread's copy of the
 * node's *fields* is authoritative (`owner`). See `.claude/docs/threading-and-rendezvous.md` and
 * `Node.callFuncThread`/`Node.rendezvousCallFunc`/`Task.requestTaskMethodCall`.
 */
describe("callFuncThread", () => {
    test("an inactive/unscheduled task returns undefined", () => {
        const task = new Task([], "MyTask");
        expect(task.callFuncThread()).toBeUndefined();
    });

    test("an active, scheduled task returns its own thread id", () => {
        const task = new Task([], "MyTask");
        task.active = true;
        task.threadId = 3;
        expect(task.callFuncThread()).toBe(3);
    });

    test("a plain Node with the default (render) owner has no callFunc thread", () => {
        const node = new Node([], "Group");
        expect(node.callFuncThread()).toBeUndefined();
    });

    test("a plain Node owned by an active, registered task thread routes to that thread", () => {
        const node = new Node([], "Group");
        node.setOwner(2);
        const task = new Task([], "OwningTask");
        task.active = true;
        task.threadId = 2;

        const originalGetThreadTask = sgRoot.getThreadTask;
        sgRoot.getThreadTask = vi.fn((id) => (id === 2 ? task : undefined));
        try {
            expect(node.callFuncThread()).toBe(2);
            expect(sgRoot.getThreadTask).toHaveBeenCalledWith(2);
        } finally {
            sgRoot.getThreadTask = originalGetThreadTask;
        }
    });

    test("a plain Node whose owner thread has no registered/active task falls back to undefined", () => {
        const node = new Node([], "Group");
        node.setOwner(5); // no task registered for thread 5

        const originalGetThreadTask = sgRoot.getThreadTask;
        sgRoot.getThreadTask = vi.fn(() => undefined);
        try {
            expect(node.callFuncThread()).toBeUndefined();
        } finally {
            sgRoot.getThreadTask = originalGetThreadTask;
        }
    });
});

describe("rendezvousCallFunc routing", () => {
    beforeEach(() => {
        sgRoot.setCurrentThread(0);
    });
    afterEach(() => {
        sgRoot.setCurrentThread(0);
    });

    function makeInterpreter() {
        return new Interpreter();
    }

    test("a non-Task target falls back to the existing owner-based rendezvousCall", () => {
        const node = new Node([], "Group");
        const interpreter = makeInterpreter();
        const functionName = new BrsString("doThing");
        node.rendezvousCall = vi.fn(() => new BrsString("stubbed"));

        const result = node.rendezvousCallFunc(interpreter, functionName, []);

        // `false`: a callFunc argument must never be silently re-owned to the callee (see
        // buildMethodCallPayload's comment) -- unlike rendezvousCall's ~69 other, non-callFunc
        // call sites, which omit this argument and keep the default `true`.
        expect(node.rendezvousCall).toHaveBeenCalledWith(interpreter, "callFunc", [functionName], false);
        expect(result.toString()).toBe("stubbed");
    });

    test("an inactive Task target falls back to running locally", () => {
        const task = new Task([], "MyTask");
        task.threadId = 1; // scheduled, but not active
        const interpreter = makeInterpreter();
        task.requestTaskMethodCall = vi.fn();

        const result = task.rendezvousCallFunc(interpreter, new BrsString("doThing"), []);

        expect(result).toBeUndefined();
        expect(task.requestTaskMethodCall).not.toHaveBeenCalled();
    });

    test("calling from the thread a Task's functions already run on returns undefined (runs locally, no self-rendezvous)", () => {
        const task = new Task([], "MyTask");
        task.active = true;
        task.threadId = 0; // matches sgRoot's current thread for this check
        const interpreter = makeInterpreter();
        task.requestTaskMethodCall = vi.fn();
        task.rendezvousCall = vi.fn();

        const result = task.rendezvousCallFunc(interpreter, new BrsString("doThing"), []);

        expect(result).toBeUndefined();
        expect(task.requestTaskMethodCall).not.toHaveBeenCalled();
        // Must not fall back to the owner-based path either — that would be a spurious second
        // rendezvous from the task back out to itself (handleMethodCallRequest's re-dispatch hazard).
        expect(task.rendezvousCall).not.toHaveBeenCalled();
    });

    test("calling a different, active task thread requests a task method call on it", () => {
        const task = new Task([], "MyTask");
        task.active = true;
        task.threadId = 1;
        const interpreter = makeInterpreter();
        task.requestTaskMethodCall = vi.fn(() => new BrsString("remote-result"));

        const originalGetThreadTask = sgRoot.getThreadTask;
        sgRoot.getThreadTask = vi.fn((id) => (id === 1 ? task : undefined));
        try {
            const result = task.rendezvousCallFunc(interpreter, new BrsString("doThing"), []);

            expect(sgRoot.getThreadTask).toHaveBeenCalledWith(1);
            expect(task.requestTaskMethodCall).toHaveBeenCalledTimes(1);
            const [type, address, method, payload] = task.requestTaskMethodCall.mock.calls[0];
            expect(type).toBe(task.syncType);
            expect(address).toBe(task.address);
            expect(method).toBe("callFunc");
            expect(payload.args?.[0]).toBe("doThing");
            expect(result.toString()).toBe("remote-result");
        } finally {
            sgRoot.getThreadTask = originalGetThreadTask;
        }
    });

    test("a Node argument keeps its own ownership when calling INTO a Task -- is not reassigned to the callee thread", () => {
        const task = new Task([], "MyTask");
        task.active = true;
        task.threadId = 1;
        const interpreter = makeInterpreter();
        task.requestTaskMethodCall = vi.fn(() => BrsInvalid.Instance);

        const argNode = new Node([], "Group"); // owner defaults to render (0)
        expect(argNode.getOwner()).toBe(0);

        const originalGetThreadTask = sgRoot.getThreadTask;
        sgRoot.getThreadTask = vi.fn((id) => (id === 1 ? task : undefined));
        try {
            task.rendezvousCallFunc(interpreter, new BrsString("doThing"), [argNode]);
            expect(argNode.getOwner()).toBe(0); // unchanged -- caller keeps its own local node
        } finally {
            sgRoot.getThreadTask = originalGetThreadTask;
        }
    });

    test("a Node argument keeps its own ownership when a Task calls a render-owned target -- fallback path", () => {
        // Symmetric case to the test above, via rendezvousCallFunc's fallback branch.
        sgRoot.setCurrentThread(1);
        const renderOwnedTarget = new Node([], "Group"); // owner defaults to render (0)
        const interpreter = makeInterpreter();

        const currentTask = new Task([], "CallingTask");
        currentTask.active = true;
        currentTask.requestMethodCall = vi.fn(() => BrsInvalid.Instance);
        const originalGetCurrentThreadTask = sgRoot.getCurrentThreadTask;
        sgRoot.getCurrentThreadTask = vi.fn(() => currentTask);

        const argNode = new Node([], "Group");
        argNode.setOwner(1); // built by the calling task, on the calling task's own thread
        try {
            renderOwnedTarget.rendezvousCallFunc(interpreter, new BrsString("doThing"), [argNode]);
            expect(argNode.getOwner()).toBe(1); // unchanged -- calling task keeps its own local node
        } finally {
            sgRoot.getCurrentThreadTask = originalGetCurrentThreadTask;
        }
    });
});

describe("callFunc reply routing (Task.sendThreadUpdate)", () => {
    let originalPostMessage;
    beforeEach(() => {
        originalPostMessage = global.postMessage;
        global.postMessage = vi.fn();
    });
    afterEach(() => {
        global.postMessage = originalPostMessage;
    });

    function taskSideTask() {
        const task = new Task([], "MyTask");
        task.threadId = 1;
        task.active = true;
        task.inThread = true; // simulate running on the task worker
        return task;
    }

    test("a direct-flagged reply is written to the callBack buffer, bypassing the broker", () => {
        const task = taskSideTask();
        const backing = new SharedObject();
        task.setCallBackBuffer(backing.getBuffer());

        const reply = {
            id: 0,
            action: "resp",
            type: "task",
            address: task.address,
            key: "callFunc",
            value: 42,
            requestId: 5,
            direct: true,
        };
        task.sendThreadUpdate(reply);

        expect(global.postMessage).not.toHaveBeenCalled();
        expect(backing.getVersion()).toBe(1);
        const got = backing.load(true);
        expect(got.direct).toBe(true);
        expect(got.value).toBe(42);
    });

    test("a direct-flagged request (not a reply) is not diverted -- still goes through the broker", () => {
        const task = taskSideTask();
        const backing = new SharedObject();
        task.setCallBackBuffer(backing.getBuffer());

        const request = {
            id: 0,
            action: "call",
            type: "task",
            address: task.address,
            key: "callFunc",
            value: null,
            requestId: 5,
            direct: true,
        };
        task.sendThreadUpdate(request);

        expect(global.postMessage).toHaveBeenCalledTimes(1);
        expect(backing.getVersion()).toBe(0);
    });

    test("a non-direct reply still goes through the broker (existing behavior unchanged)", () => {
        const task = taskSideTask();
        const backing = new SharedObject();
        task.setCallBackBuffer(backing.getBuffer());

        const reply = { id: 0, action: "resp", type: "node", address: "ABC123", key: "count", value: 3, requestId: 5 };
        task.sendThreadUpdate(reply);

        expect(global.postMessage).toHaveBeenCalledTimes(1);
        expect(backing.getVersion()).toBe(0);
    });
});

describe("requestTaskMethodCall", () => {
    test("resolves with the deserialized value when a reply is waiting on the callBack buffer", () => {
        const task = new Task([], "MyTask");
        task.active = true;
        task.threadId = 1;
        task.fanoutBuffer = new SharedObject(); // render-side write handle (TS-private; runtime-accessible)
        const backing = new SharedObject();
        task.setCallBackBuffer(backing.getBuffer());
        task.syncRequestId = 9; // pin the id the call will use, so the pre-stored reply matches it

        backing.store({
            id: 1,
            action: "resp",
            type: task.syncType,
            address: task.address,
            key: "callFunc",
            value: 42,
            requestId: 9,
            direct: true,
        });

        const result = task.requestTaskMethodCall(task.syncType, task.address, "callFunc", { args: [] });

        expect(result.getValue()).toBe(42);
        // The request itself must travel via the fan-out queue, not the broker/directBuffer.
        expect(task.fanoutQueue).toHaveLength(1);
        expect(task.fanoutQueue[0]).toMatchObject({ action: "call", key: "callFunc", direct: true, requestId: 9 });
    });

    test("throws a rendezvous timeout error when nothing replies", () => {
        const task = new Task([], "MyTask");
        task.active = true;
        task.threadId = 1;
        task.fanoutBuffer = new SharedObject();
        task.setCallBackBuffer(new SharedObject().getBuffer());

        expect(() => task.requestTaskMethodCall(task.syncType, task.address, "callFunc", { args: [] }, 50)).toThrow(
            /Rendezvous timeout/
        );
    });

    test("returns undefined when the buffers required for the direct path are missing", () => {
        const task = new Task([], "MyTask");
        task.active = true;
        task.threadId = 1;
        // No fanoutBuffer/callBackBuffer set up.
        expect(task.requestTaskMethodCall(task.syncType, task.address, "callFunc", { args: [] })).toBeUndefined();
    });
});

/**
 * A render-initiated callFunc dispatch onto a Task runs against a snapshot of that Task's `m`,
 * frozen once right after init() completes — see .claude/docs/threading-and-rendezvous.md.
 */
describe("captureCallFuncSnapshot / callFuncM", () => {
    test("captures top/global, Nodes (live reference), and primitives as-is", () => {
        const task = new Task([], "MyTask");
        task.funcNames.add("dummy"); // captureCallFuncSnapshot no-ops for a Task with no callable functions
        const child = new Node([], "Group");
        task.m.set(new BrsString("top"), task, true);
        task.m.set(new BrsString("global"), task, true); // stand-in; identity is all that matters here
        task.m.set(new BrsString("childNode"), child, true);
        task.m.set(new BrsString("count"), new Int32(7), true);
        task.m.set(new BrsString("label"), new BrsString("hi"), true);
        task.m.set(new BrsString("flag"), BrsBoolean.True, true);

        task.captureCallFuncSnapshot();

        expect(task.callFuncM.get(new BrsString("top"))).toBe(task);
        expect(task.callFuncM.get(new BrsString("global"))).toBe(task);
        expect(task.callFuncM.get(new BrsString("childNode"))).toBe(child); // same live reference
        expect(task.callFuncM.get(new BrsString("count")).getValue()).toBe(7);
        expect(task.callFuncM.get(new BrsString("label")).getValue()).toBe("hi");
        expect(task.callFuncM.get(new BrsString("flag")).toBoolean()).toBe(true);
    });

    test("captures a live-handle value (roMessagePort) as invalid, not a fresh reconstruction", () => {
        const task = new Task([], "MyTask");
        task.funcNames.add("dummy"); // captureCallFuncSnapshot no-ops for a Task with no callable functions
        task.m.set(new BrsString("port"), new RoMessagePort(), true);

        task.captureCallFuncSnapshot();

        const captured = task.callFuncM.get(new BrsString("port"));
        expect(captured).toBeInstanceOf(BrsInvalid);
    });

    test("captures a function value as-is, matching PrimitiveKinds", () => {
        const task = new Task([], "MyTask");
        task.funcNames.add("dummy"); // captureCallFuncSnapshot no-ops for a Task with no callable functions
        const helper = new Callable("helper");
        task.m.set(new BrsString("helper"), helper, true);

        task.captureCallFuncSnapshot();

        expect(task.callFuncM.get(new BrsString("helper"))).toBe(helper);
    });

    test("a member added after the snapshot is never visible, not even as a key", () => {
        const task = new Task([], "MyTask");
        task.funcNames.add("dummy"); // captureCallFuncSnapshot no-ops for a Task with no callable functions
        task.m.set(new BrsString("beforeSnapshot"), new Int32(1), true);
        task.captureCallFuncSnapshot();
        task.m.set(new BrsString("afterSnapshot"), new Int32(2), true);

        expect(task.callFuncM.get(new BrsString("beforeSnapshot")).getValue()).toBe(1);
        expect(task.callFuncM.elements.has("aftersnapshot")).toBe(false);
    });

    test("mutating a captured Node through the live m is reflected in the snapshot too (same object)", () => {
        const task = new Task([], "MyTask");
        task.funcNames.add("dummy"); // captureCallFuncSnapshot no-ops for a Task with no callable functions
        const child = new Node([{ name: new BrsString("value"), value: new Int32(0) }], "Group");
        task.m.set(new BrsString("childNode"), child, true);
        task.captureCallFuncSnapshot();

        child.setValue("value", new Int32(1000), false); // task's own code, not via callFunc

        expect(task.callFuncM.get(new BrsString("childNode")).getValue("value").getValue()).toBe(1000);
    });
});

describe("consumeCallFuncMOverride", () => {
    test("returns undefined, and does nothing, when no snapshot dispatch is pending", () => {
        const task = new Task([], "MyTask");
        task.captureCallFuncSnapshot();
        expect(task.consumeCallFuncMOverride()).toBeUndefined();
    });

    test("is one-shot: returns callFuncM once, then undefined again", () => {
        const task = new Task([], "MyTask");
        task.funcNames.add("dummy"); // captureCallFuncSnapshot no-ops for a Task with no callable
        // functions -- populate it so callFuncM is a real snapshot, not undefined, below.
        task.captureCallFuncSnapshot();
        task.useCallFuncSnapshot = true;

        expect(task.callFuncM).toBeDefined();
        expect(task.consumeCallFuncMOverride()).toBe(task.callFuncM);
        expect(task.consumeCallFuncMOverride()).toBeUndefined();
    });

    test("a plain Node never has anything to override (always live m)", () => {
        const node = new Node([], "Group");
        expect(node.consumeCallFuncMOverride()).toBeUndefined();
    });
});
