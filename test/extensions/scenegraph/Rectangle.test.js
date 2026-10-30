const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, Node, Group } = scenegraph;
const { Float, RoArray } = core;

/** Minimal interpreter accepted by renderNode → renderChildren (never dereferenced when draw2D is absent). */
const fakeInterpreter = {};

/** Minimal fake interpreter accepted by getBoundingRect (mirrors Label.test.js). */
const fakeObserverInterpreter = { environment: {}, inSubEnv: () => {} };

/** A float vector for translation/scale-style fields. */
function vector(values) {
    return new RoArray(values.map((v) => new Float(v)));
}

function rectangle({ width = 100, height = 50, translation = [0, 0], scale, scaleRotateCenter } = {}) {
    const rect = SGNodeFactory.createNode("Rectangle");
    rect.setValue("width", new Float(width));
    rect.setValue("height", new Float(height));
    rect.setValue("translation", vector(translation));
    if (scale !== undefined) rect.setValue("scale", vector(scale));
    if (scaleRotateCenter !== undefined) rect.setValue("scaleRotateCenter", vector(scaleRotateCenter));
    return rect;
}

/**
 * Fake draw target that records what lands on SCREEN: it composes `pushScale`/`pushScaleFrame`
 * around their pivot the way the canvas does, and maps each draw call and clip through it. Assertions then check
 * where content appears, not how the engine splits a transform between draw arguments and the
 * canvas. Own-scale pivots are not modelled: the drawn nodes use the default scaleRotateCenter.
 */
function screenRecorder() {
    const stack = [{ sx: 1, sy: 1, bx: 0, by: 0 }];
    const top = () => stack[stack.length - 1];
    const toScreen = (x, y, width, height) => {
        const m = top();
        return { x: m.sx * x + m.bx, y: m.sy * y + m.by, width: m.sx * width, height: m.sy * height };
    };
    const rec = {
        rects: [],
        bitmaps: [],
        clips: [],
        pushScale(px, py, sx, sy) {
            const m = top();
            stack.push({
                sx: m.sx * sx,
                sy: m.sy * sy,
                bx: m.sx * px * (1 - sx) + m.bx,
                by: m.sy * py * (1 - sy) + m.by,
            });
            return true;
        },
        popScale() {
            stack.pop();
        },
        pushScaleFrame(px, py, sx, sy) {
            rec.pushScale(px, py, sx, sy);
            return stack.length - 2;
        },
        popScaleFrame(depth) {
            if (depth >= 0) {
                stack.pop();
            }
        },
        pushClip(r) {
            rec.clips.push(toScreen(r.x, r.y, r.width, r.height));
        },
        popClip() {},
        doDrawRotatedRect(r, rgba, rotation, center, opacity, scaleX = 1, scaleY = 1) {
            rec.rects.push({ ...toScreen(r.x, r.y, r.width * scaleX, r.height * scaleY), rotation });
        },
        doDrawRotatedBitmap(x, y, scaleX, scaleY, rotation, bitmap, centerX = 0, centerY = 0) {
            const drawn = toScreen(x, y, scaleX * bitmap.width, scaleY * bitmap.height);
            const pivot = toScreen(x + centerX, y + centerY, 0, 0);
            rec.bitmaps.push({ ...drawn, rotation, pivot: [pivot.x, pivot.y] });
        },
        doDrawScaledObject(x, y, scaleX, scaleY, bitmap) {
            rec.bitmaps.push({ ...toScreen(x, y, scaleX * bitmap.width, scaleY * bitmap.height), rotation: 0 });
        },
        depth: () => stack.length - 1,
    };
    return rec;
}

/**
 * Regression: `scale` used to be a no-op on a Rectangle's own fill (it was only ever applied to
 * Poster-style bitmap drawing), so `scale=[0,0]` never visually collapsed a Rectangle, AND its
 * reported boundingRect() never shrank either — so a parent LayoutGroup kept spacing a collapsed
 * Rectangle as if it were full size (the exact symptom reported against TextIconButton's Label,
 * reproduced here for Rectangle since it shares the same underlying gap). Fixed by (1) threading
 * the node's own scale field through to `doDrawRotatedRect`'s new trailing scaleX/scaleY params
 * for drawing, and (2) taking the node's local rect through its scale in `updateBoundingRects`, so
 * a rendered node's own reported footprint agrees with what it paints.
 */
describe("Rectangle node scale", () => {
    test("scale=[1,1] (default) draws with scaleX=1/scaleY=1 and the node's plain unscaled rect", () => {
        const rect = rectangle({ translation: [10, 20] });
        const calls = [];
        const draw2D = {
            doDrawRotatedRect(r, rgba, rotation, center, opacity, scaleX, scaleY) {
                calls.push({ r, scaleX, scaleY });
            },
        };
        rect.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

        expect(calls.length).toBe(1);
        expect(calls[0].scaleX).toBe(1);
        expect(calls[0].scaleY).toBe(1);
        expect(calls[0].r).toEqual({ x: 10, y: 20, width: 100, height: 50 });
        expect(rect.getBoundingRect("toParent", fakeObserverInterpreter)).toEqual({
            x: 10,
            y: 20,
            width: 100,
            height: 50,
        });
    });

    test("scale=[0,0] passes scaleX=0/scaleY=0 to the draw call (unscaled rect - it applies its own bracket)", () => {
        const rect = rectangle({ translation: [10, 20], scale: [0, 0] });
        const calls = [];
        const draw2D = {
            doDrawRotatedRect(r, rgba, rotation, center, opacity, scaleX, scaleY) {
                calls.push({ r, scaleX, scaleY });
            },
        };
        rect.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

        expect(calls.length).toBe(1);
        expect(calls[0].scaleX).toBe(0);
        expect(calls[0].scaleY).toBe(0);
        expect(calls[0].r).toEqual({ x: 10, y: 20, width: 100, height: 50 });
    });

    test("scale=[0,0] collapses the REPORTED boundingRect (default scaleRotateCenter [0,0]: top-left anchored)", () => {
        const rect = rectangle({ translation: [10, 20], scale: [0, 0] });
        rect.renderNode(fakeInterpreter, [0, 0], 0, 1, { doDrawRotatedRect() {} });

        expect(rect.getBoundingRect("toParent", fakeObserverInterpreter)).toEqual({
            x: 10,
            y: 20,
            width: 0,
            height: 0,
        });
    });

    test("scale=[0.5,0.5] with a non-default scaleRotateCenter shrinks the boundingRect around that pivot", () => {
        const rect = rectangle({
            translation: [10, 20],
            width: 100,
            height: 50,
            scale: [0.5, 0.5],
            scaleRotateCenter: [20, 10],
        });
        rect.renderNode(fakeInterpreter, [0, 0], 0, 1, { doDrawRotatedRect() {} });

        // x = rect.x + center.x*(1-scaleX) = 10 + 20*0.5 = 20; width = 100*0.5 = 50 (symmetric for y/height).
        expect(rect.getBoundingRect("toParent", fakeObserverInterpreter)).toEqual({
            x: 20,
            y: 25,
            width: 50,
            height: 25,
        });
    });

    test("a mirrored (negative) scale reports a non-negative boundingRect, not a backwards one", () => {
        const rect = rectangle({ translation: [10, 20], width: 100, height: 50, scale: [-1, 1] });
        rect.renderNode(fakeInterpreter, [0, 0], 0, 1, { doDrawRotatedRect() {} });

        // x=10, width=100*-1=-100 -> normalized to x=10-100=-90, width=abs(-100)=100 (unionRect
        // assumes non-negative width when computing the far edge as x+width).
        expect(rect.getBoundingRect("toParent", fakeObserverInterpreter)).toEqual({
            x: -90,
            y: 20,
            width: 100,
            height: 50,
        });
    });

    test("getDimensions() (the raw width/height fields) is unaffected by scale", () => {
        const rect = rectangle({ scale: [0, 0] });
        expect(rect.getDimensions()).toEqual({ width: 100, height: 50 });
    });

    /**
     * DEVICE-MEASURED (Roku OS 16, probe `group-scale-probe`): a node's `scale` transforms its
     * children's coordinate system, positions and drawn sizes alike, around the node's own
     * position.
     */
    test("scale is propagated to children (both position and drawn size)", () => {
        const rect = rectangle({ translation: [10, 20], scale: [0, 0] });
        const child = rectangle({ translation: [30, 40], width: 5, height: 5 });
        rect.appendChildToParent(child);

        const screen = screenRecorder();
        rect.renderNode(fakeInterpreter, [0, 0], 0, 1, screen);

        // Second draw is the child: the parent's [0,0] scale collapses both its offset [30, 40]
        // and its size onto the parent's position [10, 20].
        expect(screen.rects[1]).toEqual({ x: 10, y: 20, width: 0, height: 0, rotation: 0 });
        expect(screen.depth()).toBe(0);
        expect(child.getBoundingRect("toScene", fakeObserverInterpreter)).toEqual({
            x: 10,
            y: 20,
            width: 0,
            height: 0,
        });
    });

    /**
     * Efficiency regression: `getTranslation()` already reads the `scale` field internally (to
     * compensate the drawn position for `scaleRotateCenter`), so `renderNodeContent` must fetch
     * `scale` ONCE and thread it into `getDrawTranslation(origin, angle, scale)` rather than
     * reading the field a second time for `updateBoundingRects`/`doDrawRotatedRect` — a real, avoidable
     * double allocation (getValueJS on a vector2d field allocates a WeakSet + a fresh array) that
     * slipped in when scale support was first wired into these node types.
     */
    test("reads the scale field exactly once per render pass", () => {
        const rect = rectangle({ translation: [10, 20], scale: [0.5, 0.5] });
        const spy = vi.spyOn(Node.prototype, "getValueJS");
        rect.renderNode(fakeInterpreter, [0, 0], 0, 1, { doDrawRotatedRect() {} });

        const scaleCalls = spy.mock.calls.filter(([field]) => field === "scale");
        expect(scaleCalls.length).toBe(1);
        spy.mockRestore();
    });

    test("unscaled, unrotated Groups never read scaleRotateCenter while rendering", () => {
        const group = SGNodeFactory.createNode("Group");
        group.setValue("translation", vector([30, 40]));
        const inner = SGNodeFactory.createNode("Group");
        inner.appendChildToParent(rectangle({ translation: [10, 20] }));
        group.appendChildToParent(inner);
        const spy = vi.spyOn(Node.prototype, "getValue");
        group.renderNode(fakeInterpreter, [0, 0], 0, 1, { doDrawRotatedRect() {} });

        const groupCenterReads = spy.mock.calls.filter(
            ([field], call) => field === "scaleRotateCenter" && spy.mock.contexts[call].constructor === Group
        );
        expect(groupCenterReads.length).toBe(0);
        spy.mockRestore();
    });
});

/**
 * Integration regression, reproducing the exact reported scenario: a Rectangle inside a
 * LayoutGroup must contribute its SCALED (not natural) size to the LayoutGroup's item spacing,
 * matching TextIconButton's Label shrinking inside VideoPlayerScreen's TransportButtons LayoutGroup.
 */
describe("LayoutGroup spacing reflects a scaled child's collapsed size", () => {
    test("a horizontal LayoutGroup packs a scaled-to-zero Rectangle at zero width, not its natural width", () => {
        const layout = SGNodeFactory.createNode("LayoutGroup");
        layout.setValue("layoutDirection", new core.BrsString("horiz"));
        layout.setValue("itemSpacings", vector([10]));

        const first = rectangle({ width: 100, height: 50 });
        const collapsed = rectangle({ width: 100, height: 50, scale: [0, 0] });
        const third = rectangle({ width: 100, height: 50 });
        layout.appendChildToParent(first);
        layout.appendChildToParent(collapsed);
        layout.appendChildToParent(third);

        layout.renderNode(fakeInterpreter, [0, 0], 0, 1, { doDrawRotatedRect() {} });

        // first at x=0 (width 100), collapsed at x=110 (width 0), third packed right after it at
        // x=120 (110 + 0 + itemSpacing) — NOT x=210, which is what the pre-fix natural-width-100
        // collapsed rect would have produced.
        expect(first.getValueJS("translation")[0]).toBeCloseTo(0, 5);
        expect(collapsed.getValueJS("translation")[0]).toBeCloseTo(110, 5);
        expect(third.getValueJS("translation")[0]).toBeCloseTo(120, 5);
    });
});

/**
 * Descendant transform propagation (Roku OS 16, probe `group-scale-probe`): a `Group`'s `scale` and
 * `rotation` about `scaleRotateCenter` compose down the tree to all descendants' positions, drawn
 * sizes, and `clippingRect`s.
 */
describe("Group scale and scaleRotateCenter propagation to descendants", () => {
    const fs = require("fs");
    const path = require("path");
    const { BrsDevice, BrsString } = core;

    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    function createLoadedPoster({ width, height, translation = [0, 0] }) {
        const poster = SGNodeFactory.createNode("Poster");
        poster.setValue("translation", vector(translation));
        poster.setValue("width", new Float(width));
        poster.setValue("height", new Float(height));
        poster.setValue("loadWidth", new Float(width));
        poster.setValue("loadHeight", new Float(height));
        poster.setValue("uri", new BrsString("common:/images/icon_options.png"));
        return poster;
    }

    test("nested Group scales multiply across levels", () => {
        const outer = SGNodeFactory.createNode("Group");
        outer.setValue("translation", vector([100, 200]));
        outer.setValue("scale", vector([0.5, 0.5]));

        const inner = SGNodeFactory.createNode("Group");
        inner.setValue("translation", vector([40, 80]));
        inner.setValue("scale", vector([0.5, 0.5]));
        outer.appendChildToParent(inner);

        const leaf = rectangle({ translation: [16, 32], width: 64, height: 64 });
        inner.appendChildToParent(leaf);

        const screen = screenRecorder();
        outer.renderNode(fakeInterpreter, [0, 0], 0, 1, screen);

        // Effective scale is 0.5 * 0.5 = 0.25.
        // Position: 100 + 40*0.5 + 16*0.25 = 124; 200 + 80*0.5 + 32*0.25 = 248.
        expect(screen.rects).toEqual([{ x: 124, y: 248, width: 16, height: 16, rotation: 0 }]);
        expect(screen.depth()).toBe(0);
        expect(leaf.rectToScene).toEqual({ x: 124, y: 248, width: 16, height: 16 });
    });

    test("clip + scaled/rotated content stay aligned (ball > clipped holder > sprite strip)", () => {
        // A pool ball sprite: a scaled ball Group whose clipped holder rolls a sprite strip under a
        // fixed shading overlay.
        // ballNode (Group, translation=[100,50], scale=[0.5,0.5], scaleRotateCenter=[32,32])
        //   ├── holder (Group, clippingRect=[0,0,64,64], scaleRotateCenter=[32,32], rotation=π/2)
        //   │     └── strip (Poster, 1792x64 sprite sheet, translation=[-112,0])
        //   └── shade (Poster, 64x64 overlay, translation=[0,0])
        const ballNode = SGNodeFactory.createNode("Group");
        ballNode.setValue("translation", vector([100, 50]));
        ballNode.setValue("scale", vector([0.5, 0.5]));
        ballNode.setValue("scaleRotateCenter", vector([32, 32]));

        const holder = SGNodeFactory.createNode("Group");
        holder.setValue("clippingRect", vector([0, 0, 64, 64]));
        holder.setValue("scaleRotateCenter", vector([32, 32]));
        holder.setValue("rotation", new Float(Math.PI / 2));
        ballNode.appendChildToParent(holder);

        const strip = createLoadedPoster({ width: 1792, height: 64, translation: [-112, 0] });
        holder.appendChildToParent(strip);

        const shade = createLoadedPoster({ width: 64, height: 64, translation: [0, 0] });
        ballNode.appendChildToParent(shade);

        const screen = screenRecorder();
        ballNode.renderNode(fakeInterpreter, [0, 0], 0, 1, screen);
        const { clips, bitmaps } = screen;

        // 1. holder's 64x64 clip scaled by 0.5 around [32,32] and rotated 90° around its centre
        //    lands at { x: 116, y: 66, width: 32, height: 32 }.
        expect(clips).toHaveLength(1);
        expect(clips[0].x).toBeCloseTo(116, 4);
        expect(clips[0].y).toBeCloseTo(66, 4);
        expect(clips[0].width).toBeCloseTo(32, 4);
        expect(clips[0].height).toBeCloseTo(32, 4);

        // 2. strip is drawn scaled to 896x32 (1792*0.5 x 64*0.5), rotated by π/2, with its
        //    local (0,0) at [116, 154] — so the 64x64 frame at u=[112..176], v=[0..64] maps to
        //    canvas x=[116..148], y=[66..98], matching holder's 32x32 clip box [116..148, 66..98].
        // 3. shade is drawn unrotated at [116, 66] with size 32x32, also matching the clip box.
        expect(bitmaps).toHaveLength(2);
        expect(bitmaps[0].x).toBeCloseTo(116, 4);
        expect(bitmaps[0].y).toBeCloseTo(154, 4);
        expect(bitmaps[0].width).toBeCloseTo(896, 4);
        expect(bitmaps[0].height).toBeCloseTo(32, 4);
        expect(bitmaps[0].rotation).toBeCloseTo(Math.PI / 2, 4);

        expect(bitmaps[1].x).toBeCloseTo(116, 4);
        expect(bitmaps[1].y).toBeCloseTo(66, 4);
        expect(bitmaps[1].width).toBeCloseTo(32, 4);
        expect(bitmaps[1].height).toBeCloseTo(32, 4);
        expect(bitmaps[1].rotation).toBeCloseTo(0, 4);
    });
    test("a scaled Poster rotates about its scaleRotateCenter, as its children do", () => {
        // Poster at [100, 50], 64x64, scale [0.5, 0.5], rotated 90° about [32, 32]: the pivot stays
        // at its unscaled spot [100 + 32, 50 + 32], not 32 * 0.5 further along each axis.
        const poster = createLoadedPoster({ width: 64, height: 64, translation: [100, 50] });
        poster.setValue("scale", vector([0.5, 0.5]));
        poster.setValue("scaleRotateCenter", vector([32, 32]));
        poster.setValue("rotation", new Float(Math.PI / 2));

        const screen = screenRecorder();
        poster.renderNode(fakeInterpreter, [0, 0], 0, 1, screen);

        expect(screen.bitmaps).toHaveLength(1);
        expect(screen.bitmaps[0].pivot[0]).toBeCloseTo(132, 4);
        expect(screen.bitmaps[0].pivot[1]).toBeCloseTo(82, 4);
        expect(screen.bitmaps[0].width).toBeCloseTo(32, 4);
    });

    test("an own-scale clip is placed once, not again by the scale it applies to its children", () => {
        // Group at [40, 20] with clippingRect [0, 0, 100, 60], scale [0.5, 0.5] about [20, 10]: the
        // clip covers x = 40 + 20*(1-0.5) = 50, y = 20 + 10*(1-0.5) = 25, 50x30 on screen, and so
        // does its 100x60 child. Pushed inside the canvas scale applied to the children, the clip
        // would shrink again to 25x15.
        const group = SGNodeFactory.createNode("Group");
        group.setValue("translation", vector([40, 20]));
        group.setValue("scale", vector([0.5, 0.5]));
        group.setValue("scaleRotateCenter", vector([20, 10]));
        group.setValue("clippingRect", vector([0, 0, 100, 60]));
        group.appendChildToParent(rectangle({ width: 100, height: 60 }));

        const screen = screenRecorder();
        group.renderNode(fakeInterpreter, [0, 0], 0, 1, screen);

        expect(screen.clips).toEqual([{ x: 50, y: 25, width: 50, height: 30 }]);
        expect(screen.rects).toEqual([{ x: 50, y: 25, width: 50, height: 30, rotation: 0 }]);
        expect(screen.depth()).toBe(0);
    });

    test("a MaskGroup under a scaled Group composites its screen-sized bitmap 1:1", () => {
        // The offscreen bitmap is in screen pixels, so the composite must cancel the ancestors'
        // canvas scale: it covers the 1280x720 scene from [0, 0], not 640x360 from the scale pivot.
        const outer = SGNodeFactory.createNode("Group");
        outer.setValue("translation", vector([100, 200]));
        outer.setValue("scale", vector([0.5, 0.5]));
        const masked = SGNodeFactory.createNode("MaskGroup");
        masked.setValue("maskUri", new BrsString("common:/images/icon_options.png"));
        masked.appendChildToParent(rectangle({ width: 64, height: 64 }));
        outer.appendChildToParent(masked);

        const screen = screenRecorder();
        outer.renderNode(fakeInterpreter, [0, 0], 0, 1, screen);

        expect(screen.bitmaps).toEqual([{ x: 0, y: 0, width: 1280, height: 720, rotation: 0 }]);
        expect(screen.depth()).toBe(0);
    });
});
