const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, Node } = scenegraph;
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
 * Regression: `scale` used to be a no-op on a Rectangle's own fill (it was only ever applied to
 * Poster-style bitmap drawing), so `scale=[0,0]` never visually collapsed a Rectangle, AND its
 * reported boundingRect() never shrank either — so a parent LayoutGroup kept spacing a collapsed
 * Rectangle as if it were full size (the exact symptom reported against TextIconButton's Label,
 * reproduced here for Rectangle since it shares the same underlying gap). Fixed by (1) threading
 * the node's own scale field through to `doDrawRotatedRect`'s new trailing scaleX/scaleY params
 * for drawing, and (2) folding scale into the rect passed to `updateBoundingRects` via the new
 * `Group.applyScale` helper, so a rendered node's own reported footprint agrees with what it paints.
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
     * DEVICE-MEASURED (Roku Express 4K+, Roku OS 15; `WacUltraStream/components/poolTable.brs`
     * ~lines 325-335): a `Group`'s `scale` transforms its entire child coordinate system — both
     * child positions and child drawn sizes. On device, each pool ball (`Group` with
     * `scale = [0.5, 0.5]`, `scaleRotateCenter = [32, 32]`) scales its child `Group` (`holder`,
     * `clippingRect = [0, 0, 64, 64]`), child `Poster` (`strip`, 1792x64 sprite sheet at
     * `translation = [-x, 0]`), and child `Poster` (`shade`, 64x64 overlay) down to a 32x32
     * composite on the table felt. Previously this test pinned the opposite (non-propagating)
     * engine assumption from #1147.
     */
    test("scale is propagated to children (both position and drawn scale)", () => {
        const rect = rectangle({ translation: [10, 20], scale: [0, 0] });
        const child = rectangle({ translation: [30, 40], width: 5, height: 5 });
        rect.appendChildToParent(child);

        const calls = [];
        const draw2D = {
            doDrawRotatedRect(r, rgba, rotation, center, opacity, scaleX, scaleY) {
                calls.push({ r, scaleX, scaleY });
            },
        };
        rect.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

        expect(calls.length).toBe(2);
        // Second call is the child: it inherits the parent's [0,0] scale, collapsing both its
        // parent-relative offset ([30*0, 40*0] + [10, 20] = [10, 20]) and its drawn scale ([0, 0]).
        const childCall = calls[1];
        expect(childCall.scaleX).toBe(0);
        expect(childCall.scaleY).toBe(0);
        expect(childCall.r.x).toBe(10);
        expect(childCall.r.y).toBe(20);
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
     * reading the field a second time for `applyScale`/`doDrawRotatedRect` — a real, avoidable
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
 * Descendant transform propagation (Roku Express 4K+, Roku OS 15; `WacUltraStream/components/poolTable.brs`):
 * a `Group`'s `scale` and `rotation` about `scaleRotateCenter` compose down the tree to all
 * descendants' positions, drawn sizes, and `clippingRect`s.
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

    test("Group scale [0.5, 0.5] with a 64x64 Poster child draws 32x32 at the scaled position", () => {
        const group = SGNodeFactory.createNode("Group");
        group.setValue("translation", vector([100, 50]));
        group.setValue("scale", vector([0.5, 0.5]));

        const poster = createLoadedPoster({ width: 64, height: 64, translation: [20, 40] });
        group.appendChildToParent(poster);

        const bitmapCalls = [];
        const draw2D = {
            doDrawRotatedBitmap(x, y, scaleX, scaleY, rotation, bitmap) {
                bitmapCalls.push({
                    x,
                    y,
                    width: scaleX * bitmap.width,
                    height: scaleY * bitmap.height,
                    rotation,
                });
            },
        };
        group.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

        // Child translation [20, 40] is scaled by [0.5, 0.5] -> [10, 20] + parent [100, 50] = [110, 70],
        // and the 64x64 Poster draws at 32x32.
        expect(bitmapCalls).toEqual([{ x: 110, y: 70, width: 32, height: 32, rotation: 0 }]);
        expect(poster.rectToScene).toEqual({ x: 110, y: 70, width: 32, height: 32 });
    });

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

        const calls = [];
        const draw2D = {
            doDrawRotatedRect(r, rgba, rotation, center, opacity, scaleX, scaleY) {
                calls.push({ r: { ...r }, scaleX, scaleY });
            },
        };
        outer.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

        expect(calls.length).toBe(1);
        // Effective scale is 0.5 * 0.5 = 0.25.
        // Position: 100 + 40*0.5 + 16*0.25 = 124; 200 + 80*0.5 + 32*0.25 = 248.
        expect(calls[0].scaleX).toBeCloseTo(0.25, 5);
        expect(calls[0].scaleY).toBeCloseTo(0.25, 5);
        expect(calls[0].r).toEqual({ x: 124, y: 248, width: 64, height: 64 });
        expect(leaf.rectToScene).toEqual({ x: 124, y: 248, width: 16, height: 16 });
    });

    test("rotation about scaleRotateCenter moves a translated child around the pivot, not around (0, 0)", () => {
        const host = SGNodeFactory.createNode("Group");
        host.setValue("translation", vector([100, 50]));
        host.setValue("scaleRotateCenter", vector([32, 32]));
        host.setValue("rotation", new Float(Math.PI / 2));

        // Child placed right at the parent's rotation pivot [32, 32]: rotating the parent around
        // [32, 32] must leave that pivot point at scene [100 + 32, 50 + 32] = [132, 82]. Rotating
        // around (0, 0) instead would swing [32, 32] to [100 + 32, 50 - 32] = [132, 18].
        const atPivot = rectangle({ translation: [32, 32], width: 10, height: 10 });
        // Second child at [-112, 0] (the poolTable strip shape): relative to pivot [32, 32] its
        // offset is [-144, -32]; after +90° CCW rotation (rotateTranslation) that offset becomes
        // [-32, +144], landing at [132 - 32, 82 + 144] = [100, 226].
        const stripChild = rectangle({ translation: [-112, 0], width: 64, height: 64 });
        host.appendChildToParent(atPivot);
        host.appendChildToParent(stripChild);

        const calls = [];
        const draw2D = {
            doDrawRotatedRect(r, rgba, rotation, center, opacity, scaleX, scaleY) {
                calls.push({ r: { ...r }, rotation, center, scaleX, scaleY });
            },
        };
        host.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

        expect(calls.length).toBe(2);
        expect(calls[0].r.x).toBeCloseTo(132, 4);
        expect(calls[0].r.y).toBeCloseTo(82, 4);
        expect(calls[1].r.x).toBeCloseTo(100, 4);
        expect(calls[1].r.y).toBeCloseTo(226, 4);
    });

    test("clip + scaled/rotated content stay aligned (poolTable ballNode > holder > strip)", () => {
        // Exact hierarchy from WacUltraStream/components/poolTable.brs (~lines 325-335):
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

        const clips = [];
        const bitmaps = [];
        const draw2D = {
            pushClip(rect) {
                clips.push({ ...rect });
            },
            popClip() {},
            doDrawRotatedBitmap(x, y, scaleX, scaleY, rotation, bitmap) {
                bitmaps.push({
                    x,
                    y,
                    width: scaleX * bitmap.width,
                    height: scaleY * bitmap.height,
                    rotation,
                });
            },
        };
        ballNode.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

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
});
