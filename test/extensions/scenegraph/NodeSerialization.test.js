const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Node, fromSGNode, toSGNode } = scenegraph;
const { BrsInvalid, isInvalid } = core;

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
});
