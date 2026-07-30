const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot, runPruneVerify } = scenegraph;
const { BrsDevice, BrsString, Float, RoArray, Interpreter } = core;

/**
 * BRS_PRUNE_VERIFY tooling (docs/scenegraph-layout-passes.md): runs a layout refresh pruned then
 * unpruned and diffs every rect, printing path-addressed `[prune-verify]` lines for divergences.
 * Silence == the pruned pass is sound for that refresh.
 */
describe("prune verifier", () => {
    let interpreter;
    let stderrLines;
    let originalWrite;

    beforeEach(() => {
        interpreter = new Interpreter();
        stderrLines = [];
        originalWrite = BrsDevice.stderr.write.bind(BrsDevice.stderr);
        BrsDevice.stderr.write = (line) => stderrLines.push(String(line));
    });

    afterEach(() => {
        BrsDevice.stderr.write = originalWrite;
        sgRoot.setFocused();
    });

    const vector = (vals) => new RoArray(vals.map((v) => new Float(v)));

    function buildScene() {
        const scene = SGNodeFactory.createNode("Scene");
        const group = SGNodeFactory.createNode("Group");
        group.setValue("id", new BrsString("container"));
        const rect = SGNodeFactory.createNode("Rectangle");
        rect.setValue("width", new Float(200));
        rect.setValue("height", new Float(90));
        group.appendChildToParent(rect);
        scene.appendChildToParent(group);
        return { scene, group, rect };
    }

    test("silent on a consistent tree", () => {
        const { scene, rect } = buildScene();
        scene.getBoundingRect("toParent", interpreter); // settle once (pruned refresh)
        rect.setValue("width", new Float(220)); // then a normal write

        const divergences = runPruneVerify(scene, interpreter);

        expect(divergences).toBe(0);
        expect(stderrLines.filter((l) => l.includes("[prune-verify]"))).toHaveLength(0);
    });

    test("reports a path-addressed line when a skipped subtree lies about its rect", () => {
        const { scene, group, rect } = buildScene();
        // Settle through the pruned refresh (getBoundingRect): only that pass clears stale
        // marks and records skip contexts — a direct layoutNode call is a scoped measurement.
        scene.getBoundingRect("toParent", interpreter);

        // Corrupt the settled subtree's cached rect WITHOUT marking it stale — the pruned pass
        // skips it and hands the lie up; the full pass recomputes the truth. The verifier must
        // name the diverging node.
        rect.rectToParent = { x: 0, y: 0, width: 999, height: 90 };
        rect.rectLocal = { x: 0, y: 0, width: 999, height: 90 };
        rect.rectToScene = { x: 0, y: 0, width: 999, height: 90 };

        const divergences = runPruneVerify(scene, interpreter);

        expect(divergences).toBeGreaterThan(0);
        const lines = stderrLines.filter((l) => l.includes("[prune-verify]"));
        expect(lines.length).toBeGreaterThan(0);
        expect(lines.some((l) => l.includes("Rectangle") && l.includes("pruned=") && l.includes("full="))).toBe(true);
    });
});
