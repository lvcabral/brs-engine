const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Node, sgRoot, fromSGNode, toSGNode } = scenegraph;
const { BrsString, RoMessagePort, Interpreter } = core;

/**
 * Cross-thread fan-out has to answer one question exactly: *which* task thread is waiting on this
 * field through a port? A port cannot cross a thread boundary — `observeField(field, port)` from a
 * task rendezvouses to the owner where the port is rebuilt empty, and an observer registered in a
 * Task's `init()` runs on the render thread and never rendezvouses at all. Getting the answer wrong
 * in either direction is destructive: too narrow and the waiting task never wakes; too broad and
 * every update is broadcast to every active task, swamping the single-slot fan-out buffers.
 */
describe("task port observer attribution", () => {
    /**
     * Registers an unscoped port observer on `target.fieldName`, attributed to `host` the way
     * `observeField` does (the callback records `interpreter.environment.hostNode`).
     */
    function observeWithPort(target, fieldName, host) {
        const interpreter = new Interpreter();
        interpreter.environment.hostNode = host;
        const port = new RoMessagePort();
        target.addObserver(interpreter, "unscoped", new BrsString(fieldName), port);
        return port;
    }

    describe("isPortObserved", () => {
        test("attributes an unscoped port observer to the node that registered it", () => {
            const target = new Node([], "Node");
            target.setValue("payload", new BrsString(""), false);
            const watcher = new Node([], "WatcherTask");
            const bystander = new Node([], "OtherTask");

            observeWithPort(target, "payload", watcher);
            const field = target.resolveField("payload");

            expect(field.isPortObserved(watcher)).toBe(true);
            // Answering true here is what broadcast every update to every task.
            expect(field.isPortObserved(bystander)).toBe(false);
        });

        test("reports no port observation for a field observed by name only", () => {
            const target = new Node([], "Node");
            target.setValue("payload", new BrsString(""), false);
            const host = new Node([], "WatcherTask");
            const interpreter = new Interpreter();
            interpreter.environment.hostNode = host;

            target.addObserver(interpreter, "unscoped", new BrsString("payload"), new BrsString("onPayload"));

            expect(target.resolveField("payload").isPortObserved(host)).toBe(false);
        });
    });

    describe("remote port observers", () => {
        test("records and clears the thread waiting on a field", () => {
            const target = new Node([], "Node");
            target.setValue("isDone", new BrsString(""), false);
            const field = target.resolveField("isdone");

            expect(field.hasRemotePortObserver(7)).toBe(false);

            field.addRemotePortObserver(7);
            expect(field.hasRemotePortObserver(7)).toBe(true);
            expect(field.hasRemotePortObserver(8)).toBe(false);

            field.removeRemotePortObserver(7);
            expect(field.hasRemotePortObserver(7)).toBe(false);
        });

        test("un-hides a field so a hidden default can still be waited on", () => {
            const target = new Node([], "Node");
            target.setValue("isDone", new BrsString(""), false);
            const field = target.resolveField("isdone");
            field.setHidden(true);

            field.addRemotePortObserver(3);

            expect(field.isHidden()).toBe(false);
        });
    });

    describe("carrying observations across a thread boundary", () => {
        test("serializes only the host's own port-observed fields as _observed_", () => {
            const target = new Node([], "ApiResultNode");
            target.setValue("isDone", new BrsString(""), false);
            target.setValue("other", new BrsString(""), false);
            const owner = new Node([], "LoadItemsTask");

            observeWithPort(target, "isDone", owner);

            // Serialized field names are lowercased, which is why `applyRemotePortObservers`
            // lowercases before resolving them on the receiving side.
            const observedNames = (fromSGNode(target, true, owner)["_observed_"] ?? []).map((entry) => entry.name);
            expect(observedNames).toContain("isdone");
            expect(observedNames).not.toContain("other");

            // A different host registered nothing here, so nothing is flagged for it.
            const bystander = new Node([], "OtherTask");
            expect(fromSGNode(target, true, bystander)["_observed_"]).toBeUndefined();
        });

        test("rebuilding a node attributes its _observed_ fields to the sending thread", () => {
            const target = new Node([], "ApiResultNode");
            target.setValue("isDone", new BrsString(""), false);
            const owner = new Node([], "LoadItemsTask");
            observeWithPort(target, "isDone", owner);
            const serialized = JSON.parse(JSON.stringify(fromSGNode(target, true, owner)));

            // A node built inside a task and handed over (appendChild) is the only signal the render
            // thread gets that a port on that thread is waiting on it.
            const prior = sgRoot.deserializingThread;
            sgRoot.deserializingThread = 12;
            let rebuilt;
            try {
                rebuilt = toSGNode(serialized, "Node", "ApiResultNode", true);
            } finally {
                sgRoot.deserializingThread = prior;
            }

            expect(rebuilt.resolveField("isdone").hasRemotePortObserver(12)).toBe(true);
            expect(rebuilt.resolveField("isdone").hasRemotePortObserver(13)).toBe(false);
        });

        test("records nothing when the rebuild is not attributed to a thread", () => {
            const target = new Node([], "ApiResultNode");
            target.setValue("isDone", new BrsString(""), false);
            const owner = new Node([], "LoadItemsTask");
            observeWithPort(target, "isDone", owner);
            const serialized = JSON.parse(JSON.stringify(fromSGNode(target, true, owner)));

            const prior = sgRoot.deserializingThread;
            sgRoot.deserializingThread = -1;
            let rebuilt;
            try {
                rebuilt = toSGNode(serialized, "Node", "ApiResultNode", true);
            } finally {
                sgRoot.deserializingThread = prior;
            }

            expect(rebuilt.resolveField("isdone").hasRemotePortObserver(0)).toBe(false);
        });
    });
});
