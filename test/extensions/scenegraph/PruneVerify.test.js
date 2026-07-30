const fs = require("fs");
const path = require("path");
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

    beforeAll(() => {
        // Regression scenarios include nodes with font-typed fields; mount the common: volume.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

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

    test("convergence repositioning does not pollute ancestor unions (real-app regression)", () => {
        // Found by the verifier in real apps: a vert LayoutGroup with vertAlignment=center holding
        // a derived-size child. Settle at one height, grow the child, refresh: pass 1 positions
        // with the cached old height, the child renders taller, synchronizeChildMetrics re-dirties,
        // pass 2 re-centers — and each inner pass unioned into the PARENT, whose rects reset only
        // once per its own pass. The pruned refresh (first to need two passes after the change)
        // reported the union of both positions (a 55-tall child spanning y -27.5..55, height 82.5).
        // Parent rects are now restored between convergence passes.
        const comp = SGNodeFactory.createNode("Group");
        const button = SGNodeFactory.createNode("Group");
        const lg = SGNodeFactory.createNode("LayoutGroup");
        lg.setValue("layoutDirection", new BrsString("vert"));
        lg.setValue("vertAlignment", new BrsString("center"));
        const child = SGNodeFactory.createNode("Group");
        const rect = SGNodeFactory.createNode("Rectangle");
        rect.setValue("width", new Float(0.0001));
        rect.setValue("height", new Float(30));
        child.appendChildToParent(rect);
        lg.appendChildToParent(child);
        button.appendChildToParent(lg);
        comp.appendChildToParent(button);

        comp.getBoundingRect("toParent", interpreter); // settle at h=30
        rect.setValue("height", new Float(55)); // grow: next refresh must re-center

        const divergences = runPruneVerify(comp, interpreter);

        expect(divergences).toBe(0);
        expect(comp.rectToParent).toEqual({ x: 0, y: -27.5, width: 0.0001, height: 55 });
    });

    test("a zero-width subtree re-measured at [0,0] keeps its in-tree scene rects (real-app regression)", () => {
        // Found by the verifier in real apps: scoped measurements (measureUnsizedChildren) render
        // a subtree at origin [0,0], clobbering every descendant's rectToScene. Zero-width
        // children (empty labels/badges) are re-measured on EVERY dirty layout (the rectKnown
        // check requires width > 0), and the pruned refresh then skipped the settled subtree,
        // handing up scene rects with x=0 instead of the true in-tree x. The scoped measurement
        // now deep-stales the subtree so the refresh re-descends.
        const scene = SGNodeFactory.createNode("Scene");
        const offsetGroup = SGNodeFactory.createNode("Group");
        offsetGroup.setValue("translation", new RoArray([new Float(223), new Float(0)]));
        const lg = SGNodeFactory.createNode("LayoutGroup");
        lg.setValue("layoutDirection", new BrsString("vert"));
        const child = SGNodeFactory.createNode("Group");
        const inner = SGNodeFactory.createNode("Rectangle");
        inner.setValue("width", new Float(0));
        inner.setValue("height", new Float(56));
        child.appendChildToParent(inner);
        lg.appendChildToParent(child);
        offsetGroup.appendChildToParent(lg);
        scene.appendChildToParent(offsetGroup);

        scene.getBoundingRect("toParent", interpreter); // settle
        // Dirty the LayoutGroup WITHOUT touching the child: measureUnsizedChildren re-measures
        // the zero-width child at [0,0]; the refresh must then re-descend, not skip.
        lg.setValue("horizAlignment", new BrsString("left"));

        const divergences = runPruneVerify(scene, interpreter);

        expect(divergences).toBe(0);
        expect(child.rectToScene.x).toBe(223);
        expect(inner.rectToScene.x).toBe(223);
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
