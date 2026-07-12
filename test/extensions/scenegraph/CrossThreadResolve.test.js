const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");

const { Task, Node, sgRoot } = scenegraph;

/**
 * Builds a render-side Task (inThread = false, threadId = the task's own id) — the role that resolves
 * the target of a rendezvous update arriving from a task thread. The render thread is id 0.
 */
function renderSideTask() {
    const task = new Task([], "MyTask");
    task.threadId = 1;
    task.active = true;
    task.inThread = false;
    return task;
}

/** Makes a node at a fixed address, optionally attaching it as a child of the task (into the tree). */
function makeNode(address, owner = 0) {
    const node = new Node([], "ContentNode");
    node.setAddress(address);
    node.setOwner(owner);
    return node;
}

describe("Task.resolveNode — tree wins over a stale registry duplicate", () => {
    test("resolves the LIVE tree node, not a stale registry duplicate sharing the same address", () => {
        // Reproduces the DIVERGE: a repeated cross-thread serialization minted a second instance at the
        // same address and left it in the registry, while the authoritative copy is wired into the tree.
        const task = renderSideTask();
        const address = "6968C6000008";

        const staleDuplicate = makeNode(address);
        sgRoot.registerCrossThreadNode(staleDuplicate); // registry now points at the detached duplicate

        const liveNode = makeNode(address);
        liveNode.setNodeParent(task);
        task.children.push(liveNode); // authoritative copy, reachable from the tree

        const resolved = task.resolveNode(address, true);
        expect(resolved).toBe(liveNode);
        expect(resolved).not.toBe(staleDuplicate);
    });

    test("still resolves a true orphan (unreachable from any tree) via the registry fallback", () => {
        // Preserves #996: a per-request callback node the other thread holds is not in any local tree.
        const task = renderSideTask();
        const address = "F7873300024F";
        const orphan = makeNode(address);
        sgRoot.registerCrossThreadNode(orphan);

        expect(task.resolveNode(address, true)).toBe(orphan);
    });

    test("returns undefined when the address is neither in a tree nor the registry", () => {
        const task = renderSideTask();
        expect(task.resolveNode("DEADBEEF0000", true)).toBeUndefined();
    });
});
