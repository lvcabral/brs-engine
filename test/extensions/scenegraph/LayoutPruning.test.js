const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Float, RoArray, Interpreter } = core;

/**
 * Pruned layout refreshes (docs/scenegraph-layout-passes.md): a full-tree bounding-rect refresh
 * skips subtrees nothing has written to since their last pass (subtreeStale false) under an
 * unchanged origin/angle/opacity context. Sound only because layout passes are pure (PR #1118).
 * The two hard-won invariants from the abandoned attempt: a skipped child still hands its cached
 * rect up to the parent union, and the stale mark is cleared BEFORE a pass so writes made inside
 * it (init(), observers) survive to the next refresh.
 */
describe("pruned layout refresh", () => {
    let interpreter;

    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    const vector = (vals) => new RoArray(vals.map((v) => new Float(v)));

    function makeRect(width, height) {
        const rect = SGNodeFactory.createNode("Rectangle");
        rect.setValue("width", new Float(width));
        rect.setValue("height", new Float(height));
        return rect;
    }

    /** Scene > Group(left: Group > Rect) + Group(right: Group > Rect) — two independent subtrees. */
    function buildTwoSubtrees() {
        const scene = SGNodeFactory.createNode("Scene");
        const left = SGNodeFactory.createNode("Group");
        const leftInner = SGNodeFactory.createNode("Group");
        leftInner.appendChildToParent(makeRect(100, 50));
        left.appendChildToParent(leftInner);
        const right = SGNodeFactory.createNode("Group");
        right.setValue("translation", vector([500, 0]));
        const rightInner = SGNodeFactory.createNode("Group");
        rightInner.appendChildToParent(makeRect(80, 40));
        right.appendChildToParent(rightInner);
        scene.appendChildToParent(left);
        scene.appendChildToParent(right);
        return { scene, left, leftInner, right, rightInner };
    }

    test("an unwritten subtree is skipped on the second refresh", () => {
        const { scene, left, leftInner, right, rightInner } = buildTwoSubtrees();

        // First refresh lays out everything.
        left.getBoundingRect("toParent", interpreter);
        const leftPasses = leftInner.layoutPassCount;
        const rightPasses = rightInner.layoutPassCount;

        // Write only into the LEFT subtree, refresh again: right subtree must be skipped.
        leftInner.getNodeChildren()[0].setValue("width", new Float(120));
        left.getBoundingRect("toParent", interpreter);

        expect(leftInner.layoutPassCount).toBeGreaterThan(leftPasses);
        expect(rightInner.layoutPassCount).toBe(rightPasses);
        // The refreshed left rect reflects the write.
        expect(leftInner.rectToParent.width).toBe(120);
    });

    test("a skipped child still unions its cached rect into the parent", () => {
        // Wrap both subtrees in a container so the union is observable (Scene's own rect is the
        // fixed screen size, not a child union).
        const scene = SGNodeFactory.createNode("Scene");
        const container = SGNodeFactory.createNode("Group");
        const left = SGNodeFactory.createNode("Group");
        left.appendChildToParent(makeRect(100, 50));
        const right = SGNodeFactory.createNode("Group");
        right.setValue("translation", vector([500, 0]));
        right.appendChildToParent(makeRect(80, 40));
        container.appendChildToParent(left);
        container.appendChildToParent(right);
        scene.appendChildToParent(container);

        container.getBoundingRect("toParent", interpreter);
        expect(container.rectToParent.width).toBe(580); // right at x=500 + width 80

        // Dirty only the left; the skipped right subtree must still contribute its 80px at x=500.
        left.getNodeChildren()[0].setValue("height", new Float(60));
        container.getBoundingRect("toParent", interpreter);
        expect(container.rectToParent.width).toBe(580);
        expect(right.rectToParent).toEqual({ x: 500, y: 0, width: 80, height: 40 });
    });

    test("a write made during the pass survives to the next refresh (clear-before-pass)", () => {
        const { scene, left, leftInner } = buildTwoSubtrees();
        scene.getBoundingRect("toParent", interpreter);

        // Simulate an observer writing into the subtree WHILE its pass runs: hook renderNode.
        const inner = leftInner;
        const original = inner.renderNode.bind(inner);
        let wroteOnce = false;
        inner.renderNode = (...args) => {
            const result = original(...args);
            if (!wroteOnce) {
                wroteOnce = true;
                inner.getNodeChildren()[0].setValue("width", new Float(300));
            }
            return result;
        };
        inner.getNodeChildren()[0].setValue("width", new Float(200)); // make it stale
        scene.getBoundingRect("toParent", interpreter);
        inner.renderNode = original;

        // The mid-pass write set the stale mark AFTER the clear, so the subtree is stale and the
        // NEXT refresh re-lays it out at the new width.
        expect(inner.subtreeStale).toBe(true);
        scene.getBoundingRect("toParent", interpreter);
        expect(inner.rectToParent.width).toBe(300);
    });

    test("an ancestor translation change invalidates settled children via the context check", () => {
        const { scene, right, rightInner } = buildTwoSubtrees();
        scene.getBoundingRect("toParent", interpreter);
        const passes = rightInner.layoutPassCount;

        // Move the right container: its children are NOT stale, but their incoming origin
        // changed, so the context check forces them to re-lay-out at the new position.
        right.setValue("translation", vector([600, 20]));
        scene.getBoundingRect("toParent", interpreter);

        expect(rightInner.layoutPassCount).toBeGreaterThan(passes);
        expect(rightInner.rectToScene.x).toBe(600);
        expect(rightInner.rectToScene.y).toBe(20);
    });

    test("content mutation reaches the consuming grid through the field boundary", () => {
        // A ContentNode tree hangs off a FIELD, not the render tree — writing into it must
        // still stale-mark the consuming node (and its ancestors) so a pruned refresh
        // re-descends. (In practice grids re-mark themselves during their own pass via item
        // focus writes and thus never skip, but the field-boundary hop must hold regardless —
        // it is what protects any settled consumer of a content tree.)
        const scene = SGNodeFactory.createNode("Scene");
        const grid = SGNodeFactory.createNode("MarkupGrid");
        grid.setValue("itemSize", vector([100, 50]));
        grid.setValue("numRows", new Float(4));
        grid.setValue("numColumns", new Float(1));
        scene.appendChildToParent(grid);
        const content = SGNodeFactory.createNode("ContentNode");
        for (let i = 0; i < 2; i++) {
            const item = SGNodeFactory.createNode("ContentNode");
            item.setValue("title", new BrsString(`item ${i}`));
            content.appendChildToParent(item);
        }
        grid.setValue("content", content);
        scene.getBoundingRect("toParent", interpreter);

        // Force the settled state (a real grid keeps re-marking itself; the hop matters for
        // the refreshes where it does not).
        grid.subtreeStale = false;
        scene.subtreeStale = false;

        // Mutate the content tree only — nothing in the RENDER tree is written.
        const extra = SGNodeFactory.createNode("ContentNode");
        extra.setValue("title", new BrsString("late item"));
        content.appendChildToParent(extra);

        expect(grid.subtreeStale).toBe(true);
        expect(scene.subtreeStale).toBe(true);
    });

    test("convergence repositioning does not pollute ancestor unions (real-app regression)", () => {
        // Found by the (since removed) BRS_PRUNE_VERIFY harness in real apps: a vert LayoutGroup
        // with vertAlignment=center holding a derived-size child. Settle at one height, grow the
        // child, refresh: pass 1 positions with the cached old height, the child renders taller,
        // synchronizeChildMetrics re-dirties, pass 2 re-centers — and each inner pass unioned
        // into the PARENT, whose rects reset only once per its own pass. The first refresh after
        // the change (the one needing two passes) reported the union of both positions (a 55-tall
        // child spanning y -27.5..55, height 82.5). Parent rects are restored between passes.
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

        expect(comp.getBoundingRect("toParent", interpreter)).toEqual({
            x: 0,
            y: -27.5,
            width: 0.0001,
            height: 55,
        });
        expect(button.rectToParent).toEqual({ x: 0, y: -27.5, width: 0.0001, height: 55 });
    });

    test("a zero-width subtree re-measured at [0,0] keeps its in-tree scene rects (real-app regression)", () => {
        // Found by the (since removed) BRS_PRUNE_VERIFY harness in real apps: scoped measurements
        // (measureUnsizedChildren) render a subtree at origin [0,0], clobbering every descendant's
        // rectToScene. Zero-width children (empty labels/badges) are re-measured on EVERY dirty
        // layout (the rectKnown check requires width > 0), and the pruned refresh then skipped
        // the settled subtree, handing up scene rects with x=0 instead of the true in-tree x.
        // The scoped measurement deep-stales the subtree so the refresh re-descends.
        const scene = SGNodeFactory.createNode("Scene");
        const offsetGroup = SGNodeFactory.createNode("Group");
        offsetGroup.setValue("translation", vector([223, 0]));
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
        scene.getBoundingRect("toParent", interpreter);

        expect(child.rectToScene.x).toBe(223);
        expect(inner.rectToScene.x).toBe(223);
    });

    test("pruned and unpruned refreshes produce identical rects (grid item creation included)", () => {
        function buildScene() {
            const scene = SGNodeFactory.createNode("Scene");
            const layout = SGNodeFactory.createNode("LayoutGroup");
            layout.setValue("layoutDirection", new BrsString("vert"));
            layout.setValue("itemSpacings", vector([6]));
            layout.appendChildToParent(makeRect(200, 40));
            layout.appendChildToParent(makeRect(150, 70));
            const grid = SGNodeFactory.createNode("MarkupGrid");
            grid.setValue("itemSize", vector([100, 50]));
            grid.setValue("numRows", new Float(3));
            grid.setValue("numColumns", new Float(1));
            const content = SGNodeFactory.createNode("ContentNode");
            for (let i = 0; i < 3; i++) {
                content.appendChildToParent(SGNodeFactory.createNode("ContentNode"));
            }
            grid.setValue("content", content);
            layout.appendChildToParent(grid);
            scene.appendChildToParent(layout);
            return { scene, layout };
        }

        function snapshotTree(node, out = []) {
            out.push({ ...node.rectLocal }, { ...node.rectToParent }, { ...node.rectToScene });
            for (const child of node.getNodeChildren()) {
                if (child.rectLocal) snapshotTree(child, out);
            }
            return out;
        }

        const pruned = buildScene();
        pruned.layout.getBoundingRect("toParent", interpreter); // create items
        pruned.layout.getBoundingRect("toParent", interpreter); // pruned steady-state refresh
        const prunedRects = snapshotTree(pruned.scene);

        const unpruned = buildScene();
        sgRoot.pruneDisabled = true;
        try {
            unpruned.layout.getBoundingRect("toParent", interpreter);
            unpruned.layout.getBoundingRect("toParent", interpreter);
        } finally {
            sgRoot.pruneDisabled = false;
        }
        expect(prunedRects).toEqual(snapshotTree(unpruned.scene));
    });
});
