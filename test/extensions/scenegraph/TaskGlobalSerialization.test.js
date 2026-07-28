const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Node, sgRoot, SGNodeFactory, serializeTaskM, toSGNode, fromAssociativeArray } = scenegraph;
const { BrsString, RoAssociativeArray } = core;

/**
 * A Task's launch payload carries a copy of `m`, including `m.global`. Apps keep most of their
 * state as node-valued global fields (managers, config, caches), so deep-copying them made every
 * task payload carry the whole global tree. Those fields rendezvous on read from a task anyway,
 * which materializes the real value on first access, so the payload only needs the reference.
 */
describe("Task launch serialization of m.global", () => {
    function globalWithManagers() {
        sgRoot.setScene(SGNodeFactory.createNode("Scene"));
        const globalNode = sgRoot.mGlobal;
        for (const name of ["AuthManager", "ContentManager"]) {
            const manager = new Node([], "Node");
            manager.setValue("id", new BrsString(name), false);
            for (let i = 0; i < 20; i++) {
                const item = new Node([], "ContentNode");
                item.setValueSilent("title", new BrsString(`${name} entry ${i}`));
                manager.appendChildToParent(item);
            }
            globalNode.setValueSilent(name, manager);
        }
        return globalNode;
    }

    function taskM(globalNode) {
        const task = new Node([], "Task");
        const m = new RoAssociativeArray([]);
        m.set(new BrsString("top"), task, true);
        m.set(new BrsString("global"), globalNode, true);
        m.set(new BrsString("requestCount"), new BrsString("0"), true);
        return { m, task };
    }

    test("emits m.global's node fields as proxy references, not subtrees", () => {
        const globalNode = globalWithManagers();
        const { m, task } = taskM(globalNode);

        const serialized = serializeTaskM(m, task);
        const ref = serialized.global.authmanager;
        expect(ref._proxy_).toBe(true);
        expect(ref._address_).toBe(globalNode.getValue("AuthManager").getAddress());
        // The reference carries no subtree and no fields of its own.
        expect(ref._children_).toBeUndefined();
        expect(ref.id).toBeUndefined();
    });

    test("shrinks the launch payload by an order of magnitude", () => {
        const globalNode = globalWithManagers();
        const { m, task } = taskM(globalNode);

        const deep = JSON.stringify(fromAssociativeArray(m, true, task)).length;
        const shallow = JSON.stringify(serializeTaskM(m, task)).length;
        expect(shallow).toBeLessThan(deep / 10);
    });

    test("keeps every entry other than global deep — the task owns those", () => {
        const globalNode = globalWithManagers();
        const { m, task } = taskM(globalNode);

        const serialized = serializeTaskM(m, task);
        expect(serialized.requestCount).toBe("0");
        // m.top is the task's own node: it is read locally, never through a rendezvous.
        expect(serialized.top._node_).toBe("Task:Task");
        expect(serialized.top._proxy_).toBeUndefined();
    });

    test("a restored proxy knows its field list is incomplete", () => {
        const globalNode = globalWithManagers();
        const { m, task } = taskM(globalNode);
        const serialized = JSON.parse(JSON.stringify(serializeTaskM(m, task)));

        const ref = serialized.global.authmanager;
        const restored = toSGNode(ref, "Node", "Node");
        // Marked so a read of an unmirrored field rendezvouses to the owner instead of answering
        // invalid locally — the reference carries none of the owner's fields.
        expect(restored.isRemoteProxy()).toBe(true);
        expect(restored.getAddress()).toBe(ref._address_);

        // An ordinary deep serialization is complete, so it is never flagged.
        const plain = toSGNode(JSON.parse(JSON.stringify(serialized.top)), "Node", "Task");
        expect(plain.isRemoteProxy()).toBe(false);
    });
});
