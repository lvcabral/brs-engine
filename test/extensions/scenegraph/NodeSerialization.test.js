const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Node, fromSGNode, toSGNode, jsValueOf, fromAssociativeArray } = scenegraph;
const { BrsInvalid, isInvalid, BrsString, RoAssociativeArray, RoArray } = core;

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
});
