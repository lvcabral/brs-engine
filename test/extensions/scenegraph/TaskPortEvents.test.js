const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Node, RoSGNodeEvent, collectPortNodeEvents, replayPortNodeEvents, brsValueOf, jsValueOf } = scenegraph;
const { dropPortNodeEvents } = scenegraph;
const { BrsString, RoAssociativeArray, RoMessagePort } = core;

/** Simulates the structured/JSON round-trip TaskData undergoes when posted to the task thread. */
function transfer(serialized) {
    return JSON.parse(JSON.stringify(serialized));
}

/**
 * A Task component typically observes a field with a port in init() and blocks on wait() in the
 * task function — with the field set BEFORE `control = "RUN"` (e.g. GetData-style tasks). On a
 * device the copied `m` references the same native port, so the queued event is delivered to the
 * task thread. These tests cover the simulator's explicit carry-over of those queued events.
 */
describe("pre-launch task port events", () => {
    function makeM(node, portKey = "messagePort") {
        const port = new RoMessagePort();
        const m = new RoAssociativeArray([]);
        m.set(new BrsString(portKey), port, true);
        return { m, port };
    }

    test("collects queued roSGNodeEvents from ports in m, draining them", () => {
        const node = new Node([], "Node");
        const { m, port } = makeM(node);
        port.pushMessage(new RoSGNodeEvent(node, new BrsString("params"), brsValueOf({ request: "geo" })));

        const collected = collectPortNodeEvents(m, node);
        expect(collected.messagePort).toHaveLength(1);
        expect(collected.messagePort[0].node).toBe(node.getAddress());
        expect(collected.messagePort[0].field).toBe("params");
        expect(collected.messagePort[0].value).toEqual({ request: "geo" });
        expect(() => JSON.stringify(collected)).not.toThrow();

        // The queue was drained — a second collection has nothing to report.
        expect(collectPortNodeEvents(m, node)).toBeUndefined();
    });

    test("returns undefined when no ports or no queued events exist", () => {
        const node = new Node([], "Node");
        const m = new RoAssociativeArray([]);
        expect(collectPortNodeEvents(m, node)).toBeUndefined();

        const withPort = makeM(node);
        expect(collectPortNodeEvents(withPort.m, node)).toBeUndefined();
    });

    test("replays events into the restored port, re-targeting the task node", () => {
        const renderNode = new Node([], "Node");
        const renderSide = makeM(renderNode);
        renderSide.port.pushMessage(
            new RoSGNodeEvent(renderNode, new BrsString("params"), brsValueOf({ request: "geo", noParams: true }))
        );
        const portEvents = transfer(collectPortNodeEvents(renderSide.m, renderNode));

        // Task-thread side: a rebuilt node with the same address and a freshly created port.
        const taskNode = new Node([], "Node");
        taskNode.setAddress(renderNode.getAddress());
        const globalNode = new Node([], "Node");
        const taskSide = makeM(taskNode);
        replayPortNodeEvents(portEvents, taskSide.m, taskNode, globalNode);

        const delivered = taskSide.port.drainMessages(() => true);
        expect(delivered).toHaveLength(1);
        expect(delivered[0].fieldName.getValue()).toBe("params");
        expect(delivered[0].node).toBe(taskNode);
        expect(jsValueOf(delivered[0].fieldValue)).toEqual({ request: "geo", noParams: true });
    });

    test("dropping the backlog leaves nothing to replay on a restart", () => {
        // While a task runs, events reach it live and the render-side port copy just accumulates.
        // A stop/run cycle must not replay that whole backlog as pre-launch events.
        const node = new Node([], "Node");
        const { m, port } = makeM(node);
        port.pushMessage(new RoSGNodeEvent(node, new BrsString("params"), brsValueOf({ request: "a" })));
        port.pushMessage(new RoSGNodeEvent(node, new BrsString("params"), brsValueOf({ request: "b" })));

        dropPortNodeEvents(m);
        expect(collectPortNodeEvents(m, node)).toBeUndefined();
    });

    test("drops events whose source node is unavailable on the task thread", () => {
        const renderNode = new Node([], "Node");
        const stranger = new Node([], "Node");
        const renderSide = makeM(renderNode);
        renderSide.port.pushMessage(new RoSGNodeEvent(stranger, new BrsString("someField"), new BrsString("x")));
        const portEvents = transfer(collectPortNodeEvents(renderSide.m, renderNode));

        const taskNode = new Node([], "Node");
        taskNode.setAddress(renderNode.getAddress());
        const taskSide = makeM(taskNode);
        replayPortNodeEvents(portEvents, taskSide.m, taskNode, new Node([], "Node"));

        expect(taskSide.port.drainMessages(() => true)).toHaveLength(0);
    });
});
