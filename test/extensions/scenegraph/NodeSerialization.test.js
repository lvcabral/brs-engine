const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Node, fromSGNode, toSGNode, updateSGNode, jsValueOf, fromAssociativeArray } = scenegraph;
const { ComponentDefinition, sgRoot, createFlatNode, SGNodeFactory } = scenegraph;
const { BrsInvalid, isInvalid, BrsString, BrsBoolean, RoAssociativeArray, RoArray } = core;

/** Simulates the structured/JSON round-trip a node undergoes when sent to a Task thread. */
function transfer(serialized) {
    return JSON.parse(JSON.stringify(serialized));
}

describe("SceneGraph node serialization", () => {
    test("preserves a field holding invalid, with its declared type, across the transfer", () => {
        // Mirrors `node.addField("error", "assocarray", false)`: a typed field whose value is invalid.
        const source = new Node([], "Node");
        source.setValueSilent("error", BrsInvalid.Instance, undefined, "assocarray");

        const serialized = fromSGNode(source, true);
        // The invalid value serializes to null, and the declared type is captured alongside it.
        expect(serialized.error).toBeNull();
        expect(serialized._fieldtypes_.error).toBe("assocarray");

        const target = toSGNode(transfer(serialized), "Node", "Node");
        const fields = target.getNodeFields();
        expect(fields.has("error")).toBe(true);
        expect(fields.get("error").getType()).toBe("assocarray");
        // The reconstructed field still holds invalid (boxed as RoInvalid by the typed field).
        expect(isInvalid(fields.get("error").getValue(false))).toBe(true);
    });

    test("updateSGNode clears a stale proxy flag once a full payload arrives", () => {
        // A node rebuilt earlier as an address-only proxy (its field list incomplete, e.g. via a
        // `_circular_` stub or a shallow `_proxy_` reference) must stop forcing rendezvous reads
        // once a later payload fully populates it — otherwise it stays flagged incomplete forever.
        const target = createFlatNode("Node", "Node");
        target.setRemoteProxy(true);

        const source = new Node([], "Node");
        source.setAddress(target.getAddress());
        source.setValueSilent("title", new core.BrsString("hello"));
        const fullPayload = transfer(fromSGNode(source, true));

        updateSGNode(fullPayload, target);
        expect(target.isRemoteProxy()).toBe(false);
    });

    test("does not capture types for fields with concrete (inferable) values", () => {
        const source = new Node([], "Node");
        source.setValueSilent("title", new core.BrsString("hello"));

        const serialized = fromSGNode(source, true);
        expect(serialized.title).toBe("hello");
        // No type metadata needed when the value implies the type.
        expect(serialized._fieldtypes_?.title).toBeUndefined();
    });

    describe("circular container references (task `m` serialization)", () => {
        // Mirrors the Youbora-style pattern that overflowed the stack: sub-objects built by
        // constructor functions store a back-reference to the owning `m` (this._plugin = m),
        // so the task's `m` AA transitively contains itself.
        function set(aa, key, value) {
            aa.set(new BrsString(key), value, true);
        }

        test("an AA that contains itself serializes without overflowing", () => {
            const m = new RoAssociativeArray([]);
            const sub = new RoAssociativeArray([]);
            set(sub, "plugin", m); // back-reference: m.sub.plugin -> m
            set(m, "sub", sub);
            set(m, "name", new BrsString("task-m"));

            const result = fromAssociativeArray(m, true);
            expect(result.name).toBe("task-m");
            // The cyclic back-reference is dropped (serialized as null), everything else survives.
            expect(result.sub.plugin).toBeNull();
            // The whole result must be JSON/structured-clone transferable.
            expect(() => JSON.stringify(result)).not.toThrow();
        });

        test("mutually-referencing AAs serialize without overflowing", () => {
            const a = new RoAssociativeArray([]);
            const b = new RoAssociativeArray([]);
            set(a, "b", b);
            set(b, "a", a);
            set(b, "tag", new BrsString("inner"));

            const result = fromAssociativeArray(a, true);
            expect(result.b.tag).toBe("inner");
            expect(result.b.a).toBeNull();
            expect(() => JSON.stringify(result)).not.toThrow();
        });

        test("an array cycle through an AA serializes without overflowing", () => {
            const m = new RoAssociativeArray([]);
            const arr = new RoArray([m]); // m.list[0] -> m
            set(m, "list", arr);

            const result = fromAssociativeArray(m, true);
            expect(result.list[0]).toBeNull();
            expect(() => JSON.stringify(result)).not.toThrow();
        });

        test("a container referenced twice (no cycle) still serializes both times", () => {
            const shared = new RoAssociativeArray([]);
            set(shared, "value", new BrsString("shared"));
            const m = new RoAssociativeArray([]);
            set(m, "first", shared);
            set(m, "second", shared);

            const result = jsValueOf(m, true);
            // Diamond references are legitimate — both paths get the full content.
            expect(result.first.value).toBe("shared");
            expect(result.second.value).toBe("shared");
        });

        test("a node field holding a cyclic AA serializes without overflowing", () => {
            const m = new RoAssociativeArray([]);
            const sub = new RoAssociativeArray([]);
            set(sub, "plugin", m);
            set(m, "helper", sub);
            const node = new Node([], "Node");
            node.setValueSilent("payload", m);

            const serialized = fromSGNode(node, true);
            expect(serialized.payload.helper.plugin).toBeNull();
            expect(() => JSON.stringify(serialized)).not.toThrow();
        });
    });

    describe("custom component script-scope m", () => {
        // Mirrors the device contract: a node created on a Task thread runs init() there
        // (populating its script-scope `m`), and a later callFunc on the receiving thread must
        // still see that state — init() is never re-run on the other side.
        //
        // `m` only travels on the ownership-transfer path, so these serialize with scriptScope on.
        const withScope = (node, deep = true) => fromSGNode(node, deep, undefined, undefined, { scriptScope: true });
        beforeEach(() => {
            const def = new ComponentDefinition("pkg:/components/CustomHelper.xml");
            def.name = "CustomHelper";
            def.xmlNode = { attr: { name: "CustomHelper", extends: "Node" } };
            sgRoot.setNodeDefMap(new Map([["customhelper", def]]));
        });

        afterEach(() => {
            sgRoot.setNodeDefMap(new Map());
        });

        function makeInitializedNode() {
            // Simulates initializeNode(): m holds top/global plus init()-set variables
            // (BrightScript m writes preserve key case).
            const node = new Node([], "CustomHelper");
            node.m.set(new BrsString("top"), node, true);
            node.m.set(new BrsString("setupCalled"), BrsBoolean.False, true);
            node.m.set(new BrsString("label"), new BrsString("ready"), true);
            return node;
        }

        function mValue(node, key) {
            return jsValueOf(node.m.get(new BrsString(key)));
        }

        test("serializes init()-set m entries, excluding top and global", () => {
            const serialized = withScope(makeInitializedNode());
            expect(serialized._m_).toEqual({ setupCalled: false, label: "ready" });
        });

        test("restores m on the receiving thread so callFunc-visible state survives", () => {
            const serialized = withScope(makeInitializedNode());
            const target = toSGNode(transfer(serialized), "Node", "CustomHelper");
            expect(mValue(target, "setupCalled")).toBe(false);
            expect(mValue(target, "label")).toBe("ready");
            // The locally built m.top still points at the restored node itself.
            expect(target.m.get(new BrsString("top"))).toBe(target);
        });

        test("does not mark m values as visited for the enclosing serialization", () => {
            // A task's `m` serializes `m.top` (which emits `_m_`) before its sibling entries. If the
            // `_m_` pass left those values marked as visited, the sibling would degrade to a
            // `_circular_` stub that the receiver rebuilds as `invalid` (it restores each entry with
            // its own node map), silently losing the task's own state.
            const taskNode = new Node([], "CustomHelper");
            const content = new Node([], "ContentNode");
            content.setValueSilent("title", new BrsString("hello"));
            const m = taskNode.m;
            m.set(new BrsString("top"), taskNode, true);
            m.set(new BrsString("mynode"), content, true);

            const serialized = fromAssociativeArray(m, true, taskNode);
            expect(serialized.mynode._circular_).toBeUndefined();
            expect(serialized.mynode.title).toBe("hello");

            // Same guarantee on the transfer path, where `_m_` is actually emitted.
            const withM = fromSGNode(taskNode, true, taskNode, undefined, { scriptScope: true });
            expect(withM._m_.mynode._mref_).toBe(content.getAddress());
        });

        test("a built-in node never emits _m_", () => {
            const node = new Node([], "Node");
            node.m.set(new BrsString("stuff"), new BrsString("internal"));
            expect(withScope(node)._m_).toBeUndefined();
        });

        test("emits _m_ only for an ownership transfer, not for an ordinary serialization", () => {
            // A node keeping its owner is read back through a rendezvous to that owner, so its `m`
            // never travels — shipping it would only bloat every field write and callFunc arg.
            expect(fromSGNode(makeInitializedNode(), true)._m_).toBeUndefined();
        });

        test("stores a node in m as a live reference, not a copy of its subtree", () => {
            const scene = SGNodeFactory.createNode("Scene");
            const shared = new Node([], "ContentNode");
            shared.setValue("id", new BrsString("SharedContent"), false);
            shared.setValueSilent("title", new BrsString("set-in-task"));
            scene.appendChildToParent(shared);
            sgRoot.setScene(scene);

            const node = makeInitializedNode();
            node.m.set(new BrsString("stashed"), shared, true);

            // Device-confirmed: `m` holds a live reference. It crosses as an address, not a subtree.
            const serialized = withScope(node);
            expect(serialized._m_.stashed).toEqual({ _mref_: shared.getAddress() });

            // On the receiving side it resolves back to this thread's own instance, so a later
            // mutation of that node is visible through `m` — a copy would have frozen the value.
            const target = toSGNode(transfer(serialized), "Node", "CustomHelper");
            const restored = target.m.get(new BrsString("stashed"));
            expect(restored).toBe(shared);
            shared.setValueSilent("title", new BrsString("changed-on-render"));
            expect(jsValueOf(restored.getValue("title"))).toBe("changed-on-render");
        });

        test("drops a script-scope reference whose node has not crossed", () => {
            sgRoot.setScene(SGNodeFactory.createNode("Scene"));
            const node = makeInitializedNode();
            const orphan = new Node([], "ContentNode");
            node.m.set(new BrsString("stashed"), orphan, true);

            const serialized = transfer(withScope(node));
            // `withScope` (fromSGNode) registers `node`'s own address as cross-thread as a side
            // effect of serializing it — give the rebuild a fresh address so it genuinely simulates
            // a thread that has never seen this node, rather than resolving back to `node` itself.
            serialized._address_ = "FEEDFACE00001";
            // Force an address this thread cannot resolve to any live instance.
            serialized._m_.stashed._mref_ = "DEADBEEF000000";
            const target = toSGNode(serialized, "Node", "CustomHelper");
            expect(isInvalid(target.m.get(new BrsString("stashed")))).toBe(true);
            // The rest of `m` still restores.
            expect(mValue(target, "label")).toBe("ready");
        });

        test("a shallow serialization (deep = false) skips m", () => {
            expect(withScope(makeInitializedNode(), false)._m_).toBeUndefined();
        });

        test("updateSGNode populates m on a flat node but never clobbers local state", () => {
            const serialized = transfer(withScope(makeInitializedNode()));

            const flat = createFlatNode("Node", "CustomHelper");
            updateSGNode(serialized, flat);
            expect(mValue(flat, "setupCalled")).toBe(false);
            expect(mValue(flat, "label")).toBe("ready");

            const local = createFlatNode("Node", "CustomHelper");
            local.m.set(new BrsString("setupCalled"), BrsBoolean.True);
            updateSGNode(serialized, local);
            // Locally mutated m is authoritative; the stale serialized copy must not overwrite it.
            expect(mValue(local, "setupCalled")).toBe(true);
            expect(isInvalid(local.m.get(new BrsString("label")))).toBe(true);
        });
    });
});
