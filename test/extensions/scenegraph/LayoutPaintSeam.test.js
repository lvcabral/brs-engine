const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsString, Float, RoArray, Interpreter } = core;

/**
 * The layout/paint seam (docs/scenegraph-layout-passes.md): `layoutNode` is the pure measurement
 * entry point (today it wraps renderNode with no draw target), `paintNode` is the per-frame render.
 * Each sets `sgRoot.renderPass` for the duration of its traversal and restores it afterwards, so
 * node internals can gate time-based state on the pass kind without a signature change.
 */
describe("layoutNode/paintNode seam", () => {
    let interpreter;

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    function vector(values) {
        return new RoArray(values.map((v) => new Float(v)));
    }

    function buildTree() {
        const scene = SGNodeFactory.createNode("Scene");
        const group = SGNodeFactory.createNode("Group");
        const layout = SGNodeFactory.createNode("LayoutGroup");
        layout.setValue("layoutDirection", new BrsString("vert"));
        layout.setValue("translation", vector([30, 40]));
        const first = SGNodeFactory.createNode("Rectangle");
        first.setValue("width", new Float(200));
        first.setValue("height", new Float(80));
        const second = SGNodeFactory.createNode("Rectangle");
        second.setValue("width", new Float(120));
        second.setValue("height", new Float(60));
        layout.appendChildToParent(first);
        layout.appendChildToParent(second);
        group.appendChildToParent(layout);
        scene.appendChildToParent(group);
        return { scene, group, layout, first, second };
    }

    function snapshotRects(node) {
        return {
            local: { ...node.rectLocal },
            toParent: { ...node.rectToParent },
            toScene: { ...node.rectToScene },
        };
    }

    test("layoutNode computes the same rects as renderNode without a draw target", () => {
        const measured = buildTree();
        measured.scene.layoutNode(interpreter, [0, 0], 0, 1);
        const viaLayout = [measured.group, measured.layout, measured.first, measured.second].map(snapshotRects);

        const rendered = buildTree();
        rendered.scene.renderNode(interpreter, [0, 0], 0, 1);
        const viaRender = [rendered.group, rendered.layout, rendered.first, rendered.second].map(snapshotRects);

        expect(viaLayout).toEqual(viaRender);
    });

    test("paintNode draws through the provided draw target", () => {
        // Paint from the group (Scene.renderNode needs a full canvas surface; the fake only
        // records rect draws).
        const { group } = buildTree();
        const calls = [];
        const draw2D = {
            doDrawRotatedRect: (...args) => calls.push(args),
        };

        group.paintNode(interpreter, [0, 0], 0, 1, draw2D);

        expect(calls.length).toBeGreaterThan(0);
    });

    test("renderPass is 'layout'/'paint' inside each traversal and restored afterwards", () => {
        const { group, layout } = buildTree();
        const seen = [];
        const originalRenderNode = layout.renderNode.bind(layout);
        layout.renderNode = (...args) => {
            seen.push(sgRoot.renderPass);
            return originalRenderNode(...args);
        };

        expect(sgRoot.renderPass).toBe("paint");
        group.layoutNode(interpreter, [0, 0], 0, 1);
        expect(sgRoot.renderPass).toBe("paint");
        group.paintNode(interpreter, [0, 0], 0, 1, { doDrawRotatedRect: () => {} });
        expect(sgRoot.renderPass).toBe("paint");

        expect(seen).toEqual(["layout", "paint"]);
    });

    test("getBoundingRect's refresh runs as a layout pass", () => {
        const { scene, layout } = buildTree();
        const passes = [];
        const originalRenderNode = scene.renderNode.bind(scene);
        scene.renderNode = (...args) => {
            passes.push(sgRoot.renderPass);
            return originalRenderNode(...args);
        };

        const rect = layout.getBoundingRect("toParent", interpreter);

        expect(passes).toEqual(["layout"]);
        expect(rect.width).toBe(200);
        expect(rect.height).toBe(140);
    });
});
