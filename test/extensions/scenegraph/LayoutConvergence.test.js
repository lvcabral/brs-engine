const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, BrsBoolean, Float, RoArray, Interpreter } = core;

/**
 * LayoutGroup converges to a fixed point within a single layout pass
 * (docs/scenegraph-layout-passes.md, "Make container convergence explicit"): after one
 * layoutNode call, further calls must change NOTHING — exact equality, not epsilon. The former
 * hard cap of 2 inner passes could exit while the layout was still dirty, so rects kept creeping
 * asymptotically across refreshes (observed 659 → 631 → 629 in a real app).
 */
describe("LayoutGroup layout-pass convergence", () => {
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

    function snapshotTree(node, out = []) {
        out.push({ ...node.rectLocal }, { ...node.rectToParent }, { ...node.rectToScene });
        for (const child of node.getNodeChildren()) {
            snapshotTree(child, out);
        }
        return out;
    }

    /** 4-level LayoutGroup nest, each level with a sibling Rectangle, deepest holds a wrapped Label. */
    function buildDeepNest() {
        const scene = SGNodeFactory.createNode("Scene");
        let parent = scene;
        const groups = [];
        for (let d = 0; d < 4; d++) {
            const g = SGNodeFactory.createNode("LayoutGroup");
            g.setValue("layoutDirection", new BrsString("vert"));
            g.setValue("itemSpacings", vector([4]));
            const sib = SGNodeFactory.createNode("Rectangle");
            sib.setValue("width", new Float(100));
            sib.setValue("height", new Float(20));
            g.appendChildToParent(sib);
            parent.appendChildToParent(g);
            groups.push(g);
            parent = g;
        }
        const label = SGNodeFactory.createNode("Label");
        label.setValue("wrap", BrsBoolean.True);
        label.setValue("width", new Float(200));
        label.setValue("text", new BrsString("short"));
        parent.appendChildToParent(label);
        return { scene, groups, label };
    }

    test("a second and third layout pass are exact no-ops", () => {
        const { scene, label } = buildDeepNest();
        label.setValue(
            "text",
            new BrsString(
                "a much longer text that wraps to several lines when constrained to two hundred pixels of width"
            )
        );

        scene.layoutNode(interpreter, [0, 0], 0, 1);
        const first = snapshotTree(scene);

        scene.layoutNode(interpreter, [0, 0], 0, 1);
        expect(snapshotTree(scene)).toEqual(first);

        scene.layoutNode(interpreter, [0, 0], 0, 1);
        expect(snapshotTree(scene)).toEqual(first);
    });

    test("convergence does not hit the divergence backstop", () => {
        const { scene, groups, label } = buildDeepNest();
        label.setValue(
            "text",
            new BrsString("another wrapped text long enough to grow the innermost group by a few line heights")
        );

        scene.layoutNode(interpreter, [0, 0], 0, 1);

        for (const group of groups) {
            expect(group.lastPassCount).toBeGreaterThan(0);
            expect(group.lastPassCount).toBeLessThan(8);
        }
    });

    test("a deep perturbation settles every ancestor in one layout pass", () => {
        const { scene, groups, label } = buildDeepNest();
        for (let p = 0; p < 3; p++) {
            scene.layoutNode(interpreter, [0, 0], 0, 1);
        }
        const settled = groups.map((g) => g.rectToParent.height);

        label.setValue(
            "text",
            new BrsString(
                "now a much longer text that wraps to many lines when constrained to two hundred pixels wide, growing the innermost group by several line heights"
            )
        );
        scene.layoutNode(interpreter, [0, 0], 0, 1);
        const afterOne = groups.map((g) => g.rectToParent.height);
        // Every level grew (the innermost change propagated all the way up in ONE call)...
        for (let i = 0; i < groups.length; i++) {
            expect(afterOne[i]).toBeGreaterThan(settled[i]);
        }
        // ...and a second call confirms it was already the fixed point.
        scene.layoutNode(interpreter, [0, 0], 0, 1);
        expect(groups.map((g) => g.rectToParent.height)).toEqual(afterOne);
    });

    test("a paint pass keeps single-pass next-frame correction semantics", () => {
        const { scene, label } = buildDeepNest();
        label.setValue("text", new BrsString("wrapped text that is long enough to span at least a couple of lines"));
        const draw2D = {
            doDrawRotatedRect: () => {},
            doDrawRotatedText: () => {},
            doDrawRotatedBitmap: () => {},
            pushClip: () => {},
            popClip: () => {},
        };

        // Paint from the outer LayoutGroup (Scene.renderNode needs a full canvas surface).
        const outer = scene.getNodeChildren()[0];
        outer.paintNode(interpreter, [0, 0], 0, 1, draw2D);
        expect(outer.lastPassCount).toBe(1);
    });
});
