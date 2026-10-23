const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Float, RoArray, Interpreter } = core;

/**
 * Regression: honoring the `clippingRect` field. On Roku, `clippingRect` (declared on Group and
 * inherited by every node, and auto-set by lists/grids) limits where a node and its children may
 * render — the mechanism a collapsing container (e.g. a side menu clipped to a narrow width) uses
 * to hide content that sits past its bounds. The field used to be a declared but ignored no-op, so
 * clipped-away UI drew anyway. It is now applied via IfDraw2D.pushClip/popClip.
 *
 * The rect is in the node's LOCAL coordinate system and must be translated to scene/screen space,
 * only applied on a real draw pass (draw2D present) so measurement passes stay unclipped.
 */
describe("clippingRect limits child rendering", () => {
    let interpreter;

    beforeAll(() => {
        // MarkupGrid font-typed defaults need the common: fonts; mount once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    function vector(values) {
        return new RoArray(values.map((v) => new Float(v)));
    }

    /** Records pushClip/popClip and rect draws so we can assert the clip bracket and its geometry. */
    function recordingDraw2D() {
        const clips = [];
        let depth = 0;
        let maxDepth = 0;
        return {
            clips,
            getMaxDepth: () => maxDepth,
            getDepth: () => depth,
            pushClip: (rect) => {
                clips.push({ ...rect });
                depth += 1;
                maxDepth = Math.max(maxDepth, depth);
            },
            popClip: () => {
                depth -= 1;
            },
            doDrawRotatedRect: () => {},
        };
    }

    /** Scene > Group(clippingRect) > Rectangle, with the group translated so we can check local→scene. */
    function buildClippedGroup(clippingRect, groupTranslation = [0, 0]) {
        const scene = SGNodeFactory.createNode("Scene");
        const group = SGNodeFactory.createNode("Group");
        if (groupTranslation) {
            group.setValue("translation", vector(groupTranslation));
        }
        if (clippingRect) {
            group.setValue("clippingRect", vector(clippingRect));
        }
        const rect = SGNodeFactory.createNode("Rectangle");
        rect.setValue("width", new Float(300));
        rect.setValue("height", new Float(100));
        group.appendChildToParent(rect);
        scene.appendChildToParent(group);
        return { scene, group, rect };
    }

    test("a non-empty clippingRect is pushed in scene coordinates around the children", () => {
        const { group } = buildClippedGroup([0, 0, 108, 1080], [40, 20]);
        const draw2D = recordingDraw2D();

        group.renderNode(interpreter, [0, 0], 0, 1, draw2D);

        // The local clip [0,0,108,1080] is offset by the group's translation [40,20].
        expect(draw2D.clips).toEqual([{ x: 40, y: 20, width: 108, height: 1080 }]);
        // The clip was pushed and popped (balanced): depth returned to 0.
        expect(draw2D.getDepth()).toBe(0);
        expect(draw2D.getMaxDepth()).toBe(1);
    });

    test("an empty clippingRect (default) pushes no clip", () => {
        const { group } = buildClippedGroup(null, [40, 20]);
        const draw2D = recordingDraw2D();

        group.renderNode(interpreter, [0, 0], 0, 1, draw2D);

        expect(draw2D.clips).toHaveLength(0);
        expect(draw2D.getMaxDepth()).toBe(0);
    });

    test("a zero-width clippingRect pushes no clip", () => {
        const { group } = buildClippedGroup([0, 0, 0, 1080]);
        const draw2D = recordingDraw2D();

        group.renderNode(interpreter, [0, 0], 0, 1, draw2D);

        expect(draw2D.clips).toHaveLength(0);
    });

    test("a measurement pass (no draw2D) is unaffected and still computes bounding rects", () => {
        const { group, rect } = buildClippedGroup([0, 0, 108, 1080], [40, 20]);

        // No draw target: nothing to clip, but the child must still be measured/laid out.
        const bounds = rect.getBoundingRect("toScene", interpreter);
        expect(bounds.width).toBe(300);
        expect(bounds.height).toBe(100);
        expect(group.getBoundingRect("toScene").width).toBe(300);
    });

    test("a MarkupGrid honors clippingRect around its content", () => {
        const scene = SGNodeFactory.createNode("Scene");
        const grid = SGNodeFactory.createNode("MarkupGrid");
        grid.setValue("translation", vector([50, 0]));
        grid.setValue("clippingRect", vector([0, 0, 108, 1080]));
        scene.appendChildToParent(grid);
        const draw2D = recordingDraw2D();

        grid.renderNode(interpreter, [0, 0], 0, 1, draw2D);

        expect(draw2D.clips).toEqual([{ x: 50, y: 0, width: 108, height: 1080 }]);
        expect(draw2D.getDepth()).toBe(0);
    });
});

/**
 * `clippingRect` is declared on Group, so EVERY Group-derived node inherits it, and per the reference
 * it limits "all drawing by this node AND its children" — the node's own geometry included. Only the
 * two nodes that draw nothing of their own (Group, ArrayGrid) used to apply it; the ~25 node types
 * that override the render entry point drew unclipped, and because a Rectangle/Poster/Label also
 * renders children, an ignored rect leaked the whole subtree. The clip now lives in the `renderNode`
 * template on Group, so it brackets each node's own drawing as well as its children.
 */
describe("clippingRect on nodes that draw their own geometry", () => {
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

    function vector(values) {
        return new RoArray(values.map((v) => new Float(v)));
    }

    /** Records every clip push/pop plus the draw calls, so we can assert a draw happened inside a clip. */
    function recorder() {
        const events = [];
        let depth = 0;
        const record =
            (kind) =>
            (...args) => {
                events.push({ kind, arg: args[0] });
            };
        return {
            events,
            getDepth: () => depth,
            clips: () => events.filter((e) => e.kind === "push").map((e) => ({ ...e.arg })),
            pushClip(rect) {
                events.push({ kind: "push", arg: { ...rect } });
                depth += 1;
            },
            popClip() {
                events.push({ kind: "pop" });
                depth -= 1;
            },
            doDrawRotatedRect: record("draw"),
            doDrawRotatedBitmap: record("draw"),
            doDrawScaledObject: record("draw"),
            doDrawRotatedText: record("draw"),
            drawNinePatch: record("draw"),
            doDrawText: record("draw"),
            doDrawObject: record("draw"),
            doClearCanvas: () => {},
            getContext: () => undefined,
        };
    }

    /** True when at least one draw call happened between a push and its matching pop. */
    function drewInsideAClip(events) {
        let depth = 0;
        for (const e of events) {
            if (e.kind === "push") depth += 1;
            else if (e.kind === "pop") depth -= 1;
            else if (e.kind === "draw" && depth > 0) return true;
        }
        return false;
    }

    test("a Rectangle's OWN fill is clipped by its own clippingRect", () => {
        // The "this node" half of the contract. A Rectangle used to push no clip at all, so an app
        // collapsing a filled panel by shrinking its clippingRect still saw the full fill.
        const rect = SGNodeFactory.createNode("Rectangle");
        rect.setValue("translation", vector([40, 20]));
        rect.setValue("width", new Float(300));
        rect.setValue("height", new Float(100));
        rect.setValue("clippingRect", vector([0, 0, 120, 100]));
        const draw2D = recorder();

        rect.renderNode(interpreter, [0, 0], 0, 1, draw2D);

        expect(draw2D.clips()).toEqual([{ x: 40, y: 20, width: 120, height: 100 }]);
        expect(drewInsideAClip(draw2D.events)).toBe(true);
        expect(draw2D.getDepth()).toBe(0);
    });

    test("a Label's own text draw is clipped by its own clippingRect", () => {
        const label = SGNodeFactory.createNode("Label");
        label.setValue("translation", vector([10, 10]));
        label.setValue("text", new BrsString("clipped text"));
        label.setValue("clippingRect", vector([0, 0, 40, 20]));
        const draw2D = recorder();

        label.renderNode(interpreter, [0, 0], 0, 1, draw2D);

        expect(draw2D.clips()).toEqual([{ x: 10, y: 10, width: 40, height: 20 }]);
        expect(draw2D.getDepth()).toBe(0);
    });

    test("a node painted directly via paintNode honors its clippingRect", () => {
        // RoSGScreen paints the scene and the active dialog through paintNode, with no parent
        // traversal above them — the entry point a parent-side clip would never reach. (A Dialog
        // stands in for the Scene here: Scene buffers every field write until init, which is
        // unrelated to clipping.)
        const dialog = SGNodeFactory.createNode("Dialog");
        dialog.setValue("translation", vector([100, 50]));
        dialog.setValue("clippingRect", vector([0, 0, 640, 360]));
        const draw2D = recorder();

        dialog.paintNode(interpreter, [0, 0], 0, 1, draw2D);

        expect(draw2D.clips()).toEqual([{ x: 100, y: 50, width: 640, height: 360 }]);
        expect(draw2D.getDepth()).toBe(0);
    });

    test("nested clippingRects compose and stay balanced", () => {
        const outer = SGNodeFactory.createNode("Group");
        outer.setValue("translation", vector([10, 10]));
        outer.setValue("clippingRect", vector([0, 0, 500, 500]));
        const inner = SGNodeFactory.createNode("Group");
        inner.setValue("translation", vector([5, 5]));
        inner.setValue("clippingRect", vector([0, 0, 100, 100]));
        const rect = SGNodeFactory.createNode("Rectangle");
        rect.setValue("width", new Float(300));
        rect.setValue("height", new Float(300));
        inner.appendChildToParent(rect);
        outer.appendChildToParent(inner);
        const draw2D = recorder();

        outer.renderNode(interpreter, [0, 0], 0, 1, draw2D);

        // Each rect is pushed in scene coordinates, outer first; the canvas intersects them.
        expect(draw2D.clips()).toEqual([
            { x: 10, y: 10, width: 500, height: 500 },
            { x: 15, y: 15, width: 100, height: 100 },
        ]);
        expect(draw2D.getDepth()).toBe(0);
    });

    test("a measurement pass pushes no clip on a self-drawing node", () => {
        // Extends the existing measurement invariant to the newly clipped node types: boundingRect()
        // must stay unclipped so hidden UI still lays out.
        const rect = SGNodeFactory.createNode("Rectangle");
        rect.setValue("width", new Float(300));
        rect.setValue("height", new Float(100));
        rect.setValue("clippingRect", vector([0, 0, 10, 10]));

        expect(() => rect.renderNode(interpreter, [0, 0], 0, 1)).not.toThrow();
        expect(rect.getBoundingRect("toScene", interpreter).width).toBe(300);
    });

    test("an invisible node with a clippingRect pushes no clip", () => {
        const rect = SGNodeFactory.createNode("Rectangle");
        rect.setValue("width", new Float(300));
        rect.setValue("height", new Float(100));
        rect.setValue("clippingRect", vector([0, 0, 50, 50]));
        rect.setValue("visible", core.BrsBoolean.False);
        const draw2D = recorder();

        rect.renderNode(interpreter, [0, 0], 0, 1, draw2D);

        expect(draw2D.clips()).toHaveLength(0);
        expect(draw2D.getDepth()).toBe(0);
    });

    test("a throwing child leaves the clip stack balanced", () => {
        // A clip is ctx.save() without its restore(): leaking one does not just break this frame, it
        // clips every frame drawn afterwards. Arbitrary app BrightScript runs inside the bracket, so
        // the pop has to be in a finally.
        const group = SGNodeFactory.createNode("Group");
        group.setValue("clippingRect", vector([0, 0, 100, 100]));
        const child = SGNodeFactory.createNode("Rectangle");
        child.renderNode = () => {
            throw new Error("boom");
        };
        group.appendChildToParent(child);
        const draw2D = recorder();

        expect(() => group.renderNode(interpreter, [0, 0], 0, 1, draw2D)).toThrow("boom");
        expect(draw2D.getDepth()).toBe(0);
    });

    test("a LayoutGroup pushes its clip exactly once, balanced", () => {
        // LayoutGroup calls its super render inside a convergence loop, so a super call that reached
        // the clipping template (instead of the content hook) would push one clip per pass.
        const layout = SGNodeFactory.createNode("LayoutGroup");
        layout.setValue("translation", vector([20, 30]));
        layout.setValue("clippingRect", vector([0, 0, 200, 200]));
        const rect = SGNodeFactory.createNode("Rectangle");
        rect.setValue("width", new Float(80));
        rect.setValue("height", new Float(40));
        layout.appendChildToParent(rect);
        const draw2D = recorder();

        layout.renderNode(interpreter, [0, 0], 0, 1, draw2D);

        expect(draw2D.clips()).toEqual([{ x: 20, y: 30, width: 200, height: 200 }]);
        expect(draw2D.getDepth()).toBe(0);
    });

    test("IfDraw2D.resetClips unwinds a leaked clip so the next frame is not poisoned", () => {
        // The frame-level backstop RoSGScreen runs in a finally around the scene+dialog paint.
        const { RoBitmap, IfDraw2D } = core;
        const bitmap = new RoBitmap({ width: 100, height: 100, alphaEnable: false });
        const draw2D = new IfDraw2D(bitmap);

        draw2D.pushClip({ x: 0, y: 0, width: 10, height: 10 });
        draw2D.pushClip({ x: 0, y: 0, width: 5, height: 5 });
        expect(draw2D.getClipDepth()).toBe(2);

        draw2D.resetClips();
        expect(draw2D.getClipDepth()).toBe(0);

        // Idempotent: an already-balanced frame is left alone (no stray ctx.restore()).
        draw2D.resetClips();
        expect(draw2D.getClipDepth()).toBe(0);
    });
});
