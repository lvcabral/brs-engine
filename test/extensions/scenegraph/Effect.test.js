const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, Effect, normalizeBorderRadius, resolveGradientColors, resolveGradientStops } = scenegraph;
const { BrsDevice, BrsBoolean, BrsString, Float, Int32, IfDraw2D, RoArray, RoAssociativeArray, RoBitmap } = core;

/** Minimal interpreter accepted by renderNode → renderChildren (never dereferenced when draw2D is absent). */
const fakeInterpreter = {};

function vector(values) {
    return new RoArray(values.map((v) => new Float(v)));
}

/** Mounts the common: volume (fonts, 9-patch images) that Poster loads its bitmaps from. */
function mountCommonVolume() {
    const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
    BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
}

function scratchBitmap(size = 40) {
    const fields = [
        { name: new BrsString("width"), value: new Int32(size) },
        { name: new BrsString("height"), value: new Int32(size) },
    ];
    return new RoBitmap(new RoAssociativeArray(fields));
}

describe("Effect node fields", () => {
    test("SGNodeFactory creates a real Effect instance, not the default-node fallback", () => {
        const effect = SGNodeFactory.createNode("Effect");
        expect(effect).toBeInstanceOf(Effect);
        expect(SGNodeFactory.canResolveNodeType("Effect")).toBe(true);
    });

    test("field defaults match the Roku OS 16.0 release notes table", () => {
        const effect = SGNodeFactory.createNode("Effect");
        expect(effect.getValueJS("supported")).toBe(true);
        expect(effect.getValueJS("borderRadius")).toEqual([]);
        expect(effect.getValueJS("borderWidth")).toBe(0);
        expect(effect.getValueJS("borderPadding")).toBe(0);
        expect(effect.getValueJS("borderColor")).toBe(0xffffffff | 0);
        expect(effect.getValueJS("gradientColors")).toEqual([]);
        expect(effect.getValueJS("gradientStops")).toEqual([]);
        expect(effect.getValueJS("gradientAngle")).toBe(0);
        expect(effect.getValueJS("gradientCentre")).toEqual([0.5, 0.5]);
        expect(effect.getValueJS("gradientRadius")).toEqual([1, 1]);
        expect(effect.getValueJS("gradientStyle")).toBe("none");
        expect(effect.getValueJS("gradientFillContent")).toBe(true);
        expect(effect.getValueJS("gradientFillBorder")).toBe(false);
    });

    test("Rectangle and Poster both declare an effect field", () => {
        const rect = SGNodeFactory.createNode("Rectangle");
        const poster = SGNodeFactory.createNode("Poster");
        expect(rect.hasNodeField("effect")).toBe(true);
        expect(poster.hasNodeField("effect")).toBe(true);
    });
});

/**
 * "0, 1, or 4 floats specifying corner radii clockwise from the top right... Other lengths are
 * silently truncated to length 1 or 4." `normalizeBorderRadius` also remaps that order into
 * Canvas2D `roundRect()`'s own [topLeft, topRight, bottomRight, bottomLeft] order.
 */
describe("normalizeBorderRadius", () => {
    test("an empty array means no rounding on any corner", () => {
        expect(normalizeBorderRadius([])).toEqual([0, 0, 0, 0]);
    });

    test("a single value applies uniformly to all four corners", () => {
        expect(normalizeBorderRadius([12])).toEqual([12, 12, 12, 12]);
    });

    test("2 or 3 values truncate to length 1 (only the first value survives)", () => {
        expect(normalizeBorderRadius([12, 99])).toEqual([12, 12, 12, 12]);
        expect(normalizeBorderRadius([12, 99, 99])).toEqual([12, 12, 12, 12]);
    });

    test("4 values remap from Roku's clockwise-from-top-right order to roundRect()'s order", () => {
        // Roku order: [topRight, bottomRight, bottomLeft, topLeft] = [1, 2, 3, 4]
        // roundRect() order: [topLeft, topRight, bottomRight, bottomLeft]
        expect(normalizeBorderRadius([1, 2, 3, 4])).toEqual([4, 1, 2, 3]);
    });

    test("5+ values truncate to the first four, remapped the same way", () => {
        expect(normalizeBorderRadius([1, 2, 3, 4, 999])).toEqual([4, 1, 2, 3]);
    });

    test("ignores non-finite/non-numeric entries", () => {
        expect(normalizeBorderRadius([NaN, "10", undefined])).toEqual([0, 0, 0, 0]);
        expect(normalizeBorderRadius(undefined)).toEqual([0, 0, 0, 0]);
    });
});

describe("resolveGradientColors", () => {
    test("at most 8 colors are kept, indexes 8+ ignored", () => {
        const colors = Array.from({ length: 10 }, (_, i) => i);
        expect(resolveGradientColors(colors)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });

    test("fewer than 8 colors pass through unchanged", () => {
        expect(resolveGradientColors([1, 2, 3])).toEqual([1, 2, 3]);
    });
});

describe("resolveGradientStops", () => {
    test("falls back to an even distribution when stops is empty", () => {
        expect(resolveGradientStops([10, 20, 30, 40], [])).toEqual([0, 1 / 3, 2 / 3, 1]);
    });

    test("falls back to an even distribution when the lengths disagree", () => {
        expect(resolveGradientStops([10, 20, 30], [0, 1])).toEqual([0, 0.5, 1]);
    });

    test("a matching-length stops array is used as-is, clamped to [0,1]", () => {
        expect(resolveGradientStops([10, 20], [-0.5, 1.5])).toEqual([0, 1]);
        expect(resolveGradientStops([10, 20], [0.25, 0.75])).toEqual([0.25, 0.75]);
    });

    test("a single color has no meaningful spread and resolves to 0", () => {
        expect(resolveGradientStops([10], [])).toEqual([0]);
    });
});

/** Renders any node (Rectangle, Poster, ...) into a scratch bitmap and returns raw RGBA pixel data at (x, y). */
function renderNodePixel(node, x, y, size = 40) {
    const target = scratchBitmap(size);
    node.renderNode(fakeInterpreter, [0, 0], 0, 1, new IfDraw2D(target));
    return Array.from(target.getContext().getImageData(x, y, 1, 1).data);
}

function opaqueRectangle(size = 40) {
    const rect = SGNodeFactory.createNode("Rectangle");
    rect.setValue("width", new Float(size));
    rect.setValue("height", new Float(size));
    rect.setValue("color", new Int32(0xff0000ff | 0)); // opaque red
    return rect;
}

describe("Rectangle.effect rendering", () => {
    test("without an effect assigned, renders exactly as before (opaque corner)", () => {
        const rect = opaqueRectangle();
        expect(renderNodePixel(rect, 1, 1)).toEqual([255, 0, 0, 255]);
    });

    test("borderRadius clips the corners transparent while the center stays opaque", () => {
        const rect = opaqueRectangle();
        const effect = SGNodeFactory.createNode("Effect");
        effect.setValue("borderRadius", vector([15]));
        rect.setValue("effect", effect);

        expect(renderNodePixel(rect, 1, 1)).toEqual([0, 0, 0, 0]);
        expect(renderNodePixel(rect, 20, 20)).toEqual([255, 0, 0, 255]);
    });

    test("effect.supported = false falls back to unmodified rendering", () => {
        const rect = opaqueRectangle();
        const effect = SGNodeFactory.createNode("Effect");
        effect.setValue("borderRadius", vector([15]));
        effect.setValue("supported", BrsBoolean.False);
        rect.setValue("effect", effect);

        expect(renderNodePixel(rect, 1, 1)).toEqual([255, 0, 0, 255]);
    });

    test("a non-Effect value in the effect field is ignored, not a crash", () => {
        const rect = opaqueRectangle();
        rect.setValue("effect", new BrsString("not an Effect node"));
        expect(renderNodePixel(rect, 1, 1)).toEqual([255, 0, 0, 255]);
    });

    test("borderWidth/borderColor draws a stroke outside the content rect", () => {
        const rect = SGNodeFactory.createNode("Rectangle");
        rect.setValue("width", new Float(20));
        rect.setValue("height", new Float(20));
        rect.setValue("translation", vector([10, 10]));
        rect.setValue("color", new Int32(0xff0000ff | 0));
        const effect = SGNodeFactory.createNode("Effect");
        effect.setValue("borderWidth", new Float(4));
        effect.setValue("borderColor", new Int32(0x00ff00ff | 0)); // opaque green
        rect.setValue("effect", effect);

        // Content rect is [10,10]-[30,30]. borderPadding=0 + borderWidth/2=2 outsets the stroke's
        // centerline to x=8, and the 4px-wide stroke straddles it (x=6..10) — sample well inside
        // that band, clear of both the content edge (x=10) and the outer edge (x=6).
        expect(renderNodePixel(rect, 7, 20)).toEqual([0, 255, 0, 255]);
    });

    /**
     * Regression: combining `borderRadius` with a border used to reuse the CONTENT's corner
     * radius for the border's own (larger, outset) rounded rect. A rounded rect offset outward by
     * `outset` on every side is only a uniform-gap "parallel" curve of the content's rounded rect
     * if its own corner radius ALSO grows by `outset` (the same reason CSS grows a border-radius
     * outward for the outer edge of a border) — reusing the plain radius left the border's corner
     * arc centered `outset` px closer to the content's corner than its straight edges are, so the
     * gap ballooned at each of the 4 corners while staying correct along every straight edge.
     * Reported against a real device screenshot (rounded content wrapped tightly by its border,
     * corners included) that brs-engine did not match before this fix.
     */
    test("the border's corner radius grows with the outset so the corner gap matches the straight-edge gap", () => {
        const rect = SGNodeFactory.createNode("Rectangle");
        rect.setValue("width", new Float(100));
        rect.setValue("height", new Float(100));
        rect.setValue("translation", vector([10, 10]));
        rect.setValue("color", new Int32(0xff0000ff | 0)); // opaque red
        const effect = SGNodeFactory.createNode("Effect");
        effect.setValue("borderRadius", vector([20]));
        effect.setValue("borderWidth", new Float(10));
        effect.setValue("borderPadding", new Float(10)); // outset = 10 + 10/2 = 15
        effect.setValue("borderColor", new Int32(0x00ff00ff | 0)); // opaque green
        rect.setValue("effect", effect);

        // Diagonally inward from the top-left tip, just past where a same-radius (unfixed) border
        // arc would already have ended — this pixel is fully opaque green with the fix, and was
        // fully transparent (a gap: neither content nor border painted) before it.
        expect(renderNodePixel(rect, 7, 7, 150)).toEqual([0, 255, 0, 255]);
    });

    /**
     * Regression (of the regression above): the first "grow the border radius by the outset" fix
     * grew EVERY corner unconditionally, including a corner whose `borderRadius` is 0 — so a plain
     * square border (no `borderRadius` set at all) picked up rounded corners it never asked for.
     * Reported against a real device screenshot: a border with padding/width but no `borderRadius`
     * stays perfectly square at every corner, no matter how large the padding/width is.
     */
    test("a square corner (radius 0) stays square when the border is outset by padding/width", () => {
        const rect = SGNodeFactory.createNode("Rectangle");
        rect.setValue("width", new Float(100));
        rect.setValue("height", new Float(100));
        rect.setValue("translation", vector([30, 30]));
        rect.setValue("color", new Int32(0xff0000ff | 0)); // opaque red
        const effect = SGNodeFactory.createNode("Effect");
        // No borderRadius set — defaults to [] (every corner square).
        effect.setValue("borderWidth", new Float(10));
        effect.setValue("borderPadding", new Float(10)); // outset = 10 + 10/2 = 15
        effect.setValue("borderColor", new Int32(0x00ff00ff | 0)); // opaque green
        rect.setValue("effect", effect);

        // The outer tip of the border's square corner — inside a plain miter-joined square corner,
        // but outside where a (wrongly) rounded corner of radius `outset` would have cut it away.
        expect(renderNodePixel(rect, 10, 10, 160)).toEqual([0, 255, 0, 255]);
    });

    test("gradientFillContent paints a gradient over the rounded content area", () => {
        const rect = opaqueRectangle();
        const effect = SGNodeFactory.createNode("Effect");
        effect.setValue("gradientStyle", new BrsString("linear"));
        effect.setValue("gradientAngle", new Float(180)); // clockwise from up: top -> bottom
        effect.setValue("gradientColors", vector([0xff0000ff | 0, 0x0000ffff | 0]));
        effect.setValue("gradientStops", vector([0, 1]));
        rect.setValue("effect", effect);

        const top = renderNodePixel(rect, 20, 1);
        const bottom = renderNodePixel(rect, 20, 38);
        // Top should be near the first color (red), bottom near the last (blue).
        expect(top[0]).toBeGreaterThan(top[2]);
        expect(bottom[2]).toBeGreaterThan(bottom[0]);
    });

    /**
     * Regression: the effect's rounded clip used to be built axis-aligned from the node's plain
     * (pre-rotation) rect, while the content itself was drawn through its own rotate-around-pivot
     * transform (`doDrawRotatedRect`) — so a rotated Rectangle's content and its effect's clip
     * disagreed on where the shape actually is, and most of a 90°-rotated rect fell outside its own
     * (unrotated) clip box entirely.
     */
    test("a rotated Rectangle's rounded clip rotates together with its content", () => {
        const rect = SGNodeFactory.createNode("Rectangle");
        rect.setValue("width", new Float(100));
        rect.setValue("height", new Float(40));
        rect.setValue("translation", vector([50, 150]));
        rect.setValue("rotation", new Float(Math.PI / 2));
        rect.setValue("color", new Int32(0xff0000ff | 0)); // opaque red
        const effect = SGNodeFactory.createNode("Effect");
        effect.setValue("borderRadius", vector([15]));
        rect.setValue("effect", effect);

        // Rotating 100x40 by 90° around its own top-left corner (translation) sweeps it into a
        // 40x100 vertical strip at screen x:[50,90] y:[50,150] — this point sits well inside that
        // strip (clear of the rounded corners) but OUTSIDE the shape's own un-rotated (100x40) box,
        // which is where an axis-aligned clip would have cut it off.
        expect(renderNodePixel(rect, 70, 120, 200)).toEqual([255, 0, 0, 255]);
    });

    /**
     * Regression: the effect's rounded clip ignored the node's `scale` field entirely, while the
     * content (via `doDrawRotatedRect`) scales around the same pivot — so a scaled Rectangle's
     * content grew/shrank while its effect's clip stayed sized to the pre-scale rect, clipping away
     * whatever the scale had grown past the original bounds.
     */
    test("a scaled Rectangle's rounded clip scales together with its content", () => {
        const rect = SGNodeFactory.createNode("Rectangle");
        rect.setValue("width", new Float(50));
        rect.setValue("height", new Float(50));
        rect.setValue("scale", vector([2, 2]));
        rect.setValue("color", new Int32(0xff0000ff | 0)); // opaque red
        const effect = SGNodeFactory.createNode("Effect");
        effect.setValue("borderRadius", vector([10]));
        rect.setValue("effect", effect);

        // A 50x50 rect scaled 2x around its own origin (default scaleRotateCenter) covers screen
        // (0,0)-(100,100) — this point is inside that scaled footprint but outside the pre-scale
        // (50x50) box a scale-unaware clip would have kept.
        expect(renderNodePixel(rect, 75, 75, 120)).toEqual([255, 0, 0, 255]);
    });
});

describe("Poster.effect rendering", () => {
    beforeAll(mountCommonVolume);

    test("borderRadius clips a Poster's bitmap corners transparent", () => {
        const poster = SGNodeFactory.createNode("Poster");
        poster.setValue("width", new Float(40));
        poster.setValue("height", new Float(40));
        poster.setValue("uri", new BrsString("common:/images/icon_options.png"));
        const effect = SGNodeFactory.createNode("Effect");
        effect.setValue("borderRadius", vector([18]));
        poster.setValue("effect", effect);

        expect(renderNodePixel(poster, 0, 0, 40)[3]).toBe(0);
    });

    /**
     * Regression: `applyNodeEffect` pushes the rounded-corner clip from the rect it is GIVEN, up
     * front — so a Poster whose `loadDisplayMode="limitSize"` clamp is only resolved later, inside
     * its own draw callback, left the clip (and therefore the border/gradient sizing, which reads
     * the same rect afterward) built from the PRE-clamp size while the actually-drawn bitmap used
     * the clamped one. Reproduced with `loadWidth`/`loadHeight` set AFTER `uri` (so the bitmap loads
     * at its natural, unclamped size — `loadUri` only resizes the physical bitmap when
     * loadWidth/loadHeight are already set at load time, which is not this case).
     */
    test("a limitSize clamp resolved after uri still sizes the border to the clamped content, not the pre-clamp rect", () => {
        const poster = SGNodeFactory.createNode("Poster");
        poster.setValue("loadDisplayMode", new BrsString("limitSize"));
        poster.setValue("uri", new BrsString("common:/images/icon_options.png")); // natural 36x36
        poster.setValue("loadWidth", new Float(20));
        poster.setValue("loadHeight", new Float(20));
        const effect = SGNodeFactory.createNode("Effect");
        effect.setValue("borderWidth", new Float(4));
        effect.setValue("borderColor", new Int32(0x00ff00ff | 0)); // opaque green
        poster.setValue("effect", effect);

        // Just outside the CLAMPED (20x20) content, inside its 4px border band — a pre-clamp (36x36)
        // border would place its band near x=36-40 instead, leaving this pixel transparent.
        expect(renderNodePixel(poster, 21, 10, 60)).toEqual([0, 255, 0, 255]);
    });
});
