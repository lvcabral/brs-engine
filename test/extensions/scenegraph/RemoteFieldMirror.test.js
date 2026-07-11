const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Node } = scenegraph;
const { Interpreter } = core;
const { BrsString, BrsBoolean, RoAssociativeArray, RoArray, Int32 } = core;

describe("remote field management mirrors on the local node copy", () => {
    let interpreter;
    beforeEach(() => {
        interpreter = new Interpreter();
    });

    /** Makes the node behave as a remote (render-owned) node: every field-management call
     * rendezvouses. The stub returns the remote result; the local mirror is what's under test. */
    function remoteNode() {
        const node = new Node([], "Node");
        node.rendezvousCall = () => BrsBoolean.True;
        return node;
    }

    test("addField adds the field locally when served via rendezvous", () => {
        const node = remoteNode();

        const addField = node.getMethod("addField");
        addField.call(interpreter, new BrsString("translationAA"), new BrsString("assocarray"), BrsBoolean.False);

        // Without the mirror, hasNodeField is false here — a subsequent local set fails with
        // "Tried to set nonexistent field" and a read returns invalid, even though the
        // authoritative copy on the owning thread has the field.
        expect(node.hasNodeField("translationaa")).toBe(true);
    });

    test("addFields adds the fields locally when served via rendezvous", () => {
        const node = remoteNode();

        const addFields = node.getMethod("addFields");
        addFields.call(interpreter, new RoAssociativeArray([{ name: new BrsString("counter"), value: new Int32(1) }]));

        expect(node.hasNodeField("counter")).toBe(true);
    });

    test("removeField/removeFields remove the fields locally when served via rendezvous", () => {
        const node = remoteNode();
        node.addNodeField("first", "string", false, true);
        node.addNodeField("second", "string", false, true);

        node.getMethod("removeField").call(interpreter, new BrsString("first"));
        node.getMethod("removeFields").call(interpreter, new RoArray([new BrsString("second")]));

        expect(node.hasNodeField("first")).toBe(false);
        expect(node.hasNodeField("second")).toBe(false);
    });
});
