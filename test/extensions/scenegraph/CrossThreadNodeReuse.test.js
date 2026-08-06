const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Node, fromSGNode, toSGNode, brsValueOf, sgRoot, SGNodeFactory } = scenegraph;
const { BrsString } = core;

/** Simulates the structured/JSON round-trip a node undergoes when sent to another thread. */
function transfer(serialized) {
    return JSON.parse(JSON.stringify(serialized));
}

/** Reads a field back as a plain JS value, mirroring the other suites in this directory. */
function fieldValue(node, key) {
    return scenegraph.jsValueOf(node.getValue(key));
}

describe("toSGNode reuses a live cross-thread node instead of minting a duplicate", () => {
    beforeEach(() => {
        sgRoot.setScene(SGNodeFactory.createNode("Scene"));
    });

    test("re-deserializing a node already live in the scene tree returns the SAME instance", () => {
        const moviesRow = new Node([], "ContentNode");
        moviesRow.setValue("id", new BrsString("movies"));
        sgRoot.scene.appendChildToParent(moviesRow);

        // Simulates the FIRST AppendChildren call crossing it out to a Task thread.
        fromSGNode(moviesRow, true);

        // A later call re-sends the same (still-live) node — e.g. an app re-passing an
        // accumulating array that already includes it.
        const resend = transfer(fromSGNode(moviesRow, true));
        const rebuilt = toSGNode(resend, "ContentNode", "ContentNode", true);

        expect(rebuilt).toBe(moviesRow); // reference equality, not just a matching address
    });

    test("appending a re-resolved node a second time does not duplicate it (AppendChildren repro)", () => {
        // Mirrors RootHandler.brs: `rootChildren.Push(rowNode); content.AppendChildren(rootChildren)`
        // called again later with the SAME accumulating array, now also holding a new row.
        const content = new Node([], "ContentNode");
        const moviesRow = new Node([], "ContentNode");
        moviesRow.setValue("id", new BrsString("movies"));
        content.appendChildToParent(moviesRow);
        sgRoot.scene.appendChildToParent(content);

        fromSGNode(moviesRow, true); // call 1 crossed moviesRow out already

        const seriesRow = new Node([], "ContentNode");
        seriesRow.setValue("id", new BrsString("series"));

        // Mirrors handleMethodCallRequest deserializing AppendChildren([moviesRow, seriesRow])'s args.
        const args = brsValueOf(transfer([fromSGNode(moviesRow, true), fromSGNode(seriesRow, true)]));
        for (const el of args.getElements()) {
            content.appendChildToParent(el);
        }

        const ids = content.getNodeChildren().map((child) => fieldValue(child, "id"));
        expect(ids).toEqual(["movies", "series"]); // moved to the end, not duplicated
        expect(content.getNodeChildren()).toHaveLength(2);
    });

    test("a payload whose address was never registered on this thread is still built fresh", () => {
        // Simulates a node crossing for the FIRST time: its address has no entry anywhere in this
        // thread's cross-thread registry (`sgRoot.resolveLiveNode` must miss and fall through to
        // `buildFlatNode`, not match an unrelated node).
        // A unique address not reused anywhere else in this suite — the cross-thread registry is a
        // module-level singleton shared across test files, so a reused literal risks a false
        // "already live" hit left behind by an unrelated test.
        const address = "C0FFEE00A11CE";
        const payload = { _node_: "ContentNode:ContentNode", _address_: address, id: "fresh" };

        expect(sgRoot.resolveLiveNode(address)).toBeUndefined();
        const rebuilt = toSGNode(payload, "ContentNode", "ContentNode", true);

        expect(rebuilt.getAddress()).toBe(address);
        expect(fieldValue(rebuilt, "id")).toBe("fresh");
        // The build itself registers it, so a later reference to the same address resolves here.
        expect(sgRoot.resolveLiveNode(address)).toBe(rebuilt);
    });
});
