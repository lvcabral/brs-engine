const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory } = scenegraph;
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

    test("scale is not propagated to children", () => {
        const rect = rectangle({ translation: [10, 20], scale: [0, 0] });
        const child = rectangle({ width: 5, height: 5 });
        rect.appendChildToParent(child);

        const calls = [];
        const draw2D = {
            doDrawRotatedRect(r, rgba, rotation, center, opacity, scaleX, scaleY) {
                calls.push({ r, scaleX, scaleY });
            },
        };
        rect.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

        expect(calls.length).toBe(2);
        // Second call is the child: it must not inherit the parent's [0,0] scale, and must render
        // at the parent's unscaled translation (renderChildren receives unscaled drawTrans).
        const childCall = calls[1];
        expect(childCall.scaleX).toBe(1);
        expect(childCall.scaleY).toBe(1);
        expect(childCall.r.x).toBe(10);
        expect(childCall.r.y).toBe(20);
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
