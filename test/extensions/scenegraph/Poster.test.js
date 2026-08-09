const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory } = scenegraph;
const { BrsDevice, BrsBoolean, BrsString, Float, Int32, IfDraw2D, RoAssociativeArray, RoBitmap, RoMessagePort } = core;

/**
 * Minimal fake interpreter accepted by Node.addObserver for a port observer (mirrors HiddenFields.test.js).
 */
const fakeInterpreter = { environment: {}, inSubEnv: () => {} };

/** Mounts the common: volume (fonts, 9-patch images) that Poster loads its bitmaps from. */
function mountCommonVolume() {
    const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
    BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
}

/**
 * Poster load notifications: on a real device bitmapWidth/bitmapHeight read 0 until an image finishes
 * loading, so every load transitions 0 -> N and fires observers. Our loader is synchronous, so without
 * resetting these fields a new image with the SAME loaded dimensions (common when loadWidth/loadHeight
 * are fixed) would set bitmapWidth N -> N — no change, no notification. That silently breaks a very common
 * cross-fade pattern (observe bitmapWidth to start a fade-in when the next background finishes loading).
 */
describe("Poster bitmap load notifications", () => {
    beforeAll(mountCommonVolume);

    test("bitmapWidth re-notifies on every load, even when the new image has identical dimensions", () => {
        const poster = SGNodeFactory.createNode("Poster");
        // Force both images to the same loaded dimensions so bitmapWidth would otherwise be unchanged.
        poster.setValue("loadWidth", new Float(48));
        poster.setValue("loadHeight", new Float(48));

        const port = new RoMessagePort();
        const received = [];
        const originalPush = port.pushMessage.bind(port);
        port.pushMessage = (event) => {
            received.push(event);
            originalPush(event);
        };
        poster.addObserver(fakeInterpreter, "unscoped", new BrsString("bitmapWidth"), port);

        poster.setValue("uri", new BrsString("common:/images/icon_options.png"));
        const firstWidth = poster.getValueJS("bitmapWidth");
        expect(firstWidth).toBeGreaterThan(0);
        expect(received.length).toBe(1);

        // A different image that scales to the same dimensions must still fire the observer.
        poster.setValue("uri", new BrsString("common:/images/icon_options_off.png"));
        expect(poster.getValueJS("bitmapWidth")).toBe(firstWidth);
        expect(received.length).toBe(2);
    });
});

/**
 * A 9-patch's marker border is what declares which regions stretch (its fixed corners are blitted
 * 1:1), so the Poster's width/height are authoritative and the SOURCE aspect ratio is meaningless.
 * The aspect-preserving loadDisplayMode values must therefore not apply to a 9-patch. They used to:
 * a pill sized from a measured label (a very common pattern — `background.width =
 * label.boundingRect().width + padding`) whose asset is square then letterboxed down to a square the
 * height of the rect, so every pill rendered at the same small size no matter how wide its text was,
 * while boundingRect() still reported the assigned width (drawn and measured sizes disagreeing).
 */
describe("Poster 9-patch display modes", () => {
    beforeAll(mountCommonVolume);

    // A 75x75 9-patch (insets 11/10/12/12 — pinned in test/brsTypes/components/RoBitmap.test.js).
    const ninePatchUri = "common:/images/inputField.9.png";
    const plainUri = "common:/images/icon_options.png";

    /** Renders `poster` onto a scratch canvas, capturing the rects handed to the draw primitives. */
    function renderCapturing(poster) {
        const target = new RoBitmap(
            new RoAssociativeArray([
                { name: new BrsString("width"), value: new Int32(400) },
                { name: new BrsString("height"), value: new Int32(200) },
                { name: new BrsString("alphaEnable"), value: BrsBoolean.True },
            ])
        );
        const draw2D = new IfDraw2D(target);
        const ninePatchRects = [];
        const croppedRects = [];
        // Every blend color handed to any primitive, so a draw that bypasses Group.drawImage's
        // normalization is visible to a test.
        const blendColors = [];
        const drawNinePatch = draw2D.drawNinePatch.bind(draw2D);
        draw2D.drawNinePatch = (bitmap, rect, rgba, opacity) => {
            ninePatchRects.push({ ...rect });
            blendColors.push(rgba);
            return drawNinePatch(bitmap, rect, rgba, opacity);
        };
        const doDrawCroppedBitmap = draw2D.doDrawCroppedBitmap.bind(draw2D);
        draw2D.doDrawCroppedBitmap = (bitmap, source, dest, rgba, opacity) => {
            croppedRects.push({ ...dest });
            blendColors.push(rgba);
            return doDrawCroppedBitmap(bitmap, source, dest, rgba, opacity);
        };
        const scaledRects = [];
        const doDrawScaledObject = draw2D.doDrawScaledObject.bind(draw2D);
        draw2D.doDrawScaledObject = (x, y, scaleX, scaleY, bitmap, rgba, opacity) => {
            scaledRects.push({ x, y, width: scaleX * bitmap.width, height: scaleY * bitmap.height });
            blendColors.push(rgba);
            return doDrawScaledObject(x, y, scaleX, scaleY, bitmap, rgba, opacity);
        };
        poster.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);
        return { ninePatchRects, croppedRects, scaledRects, blendColors };
    }

    /** A Poster sized like a text pill: much wider than tall, from a square-ish source asset. */
    function createPillPoster(uri, displayMode) {
        const poster = SGNodeFactory.createNode("Poster");
        poster.setValue("loadDisplayMode", new BrsString(displayMode));
        poster.setValue("width", new Float(200));
        poster.setValue("height", new Float(40));
        poster.setValue("uri", new BrsString(uri));
        expect(poster.getValueJS("loadStatus")).toBe("ready");
        return poster;
    }

    test("scaleToFit stretches a 9-patch to the full assigned rect instead of letterboxing it", () => {
        const poster = createPillPoster(ninePatchUri, "scaleToFit");
        const { ninePatchRects, croppedRects } = renderCapturing(poster);

        expect(croppedRects).toEqual([]);
        // Letterboxing a 75x75 source into 200x40 would give a 40x40 square centered at x=80.
        expect(ninePatchRects).toEqual([{ x: 0, y: 0, width: 200, height: 40 }]);
    });

    test("scaleToZoom draws a 9-patch through drawNinePatch, uncropped", () => {
        const poster = createPillPoster(ninePatchUri, "scaleToZoom");
        const { ninePatchRects, croppedRects } = renderCapturing(poster);

        // Cropping would slice through the marker border and the fixed corners.
        expect(croppedRects).toEqual([]);
        expect(ninePatchRects).toEqual([{ x: 0, y: 0, width: 200, height: 40 }]);
    });

    // The default blendColor means "no color blending" per the reference, but it is STORED as -1
    // (convertHexColor's `| 0`). `scaletozoom` is the one display mode that goes straight to
    // doDrawCroppedBitmap instead of through Group.drawImage, so it was the only path where that raw -1
    // reached the draw — tinting the poster and washing out every partially transparent pixel.
    test.each(["scaleToFit", "scaleToZoom", "noScale"])(
        "%s draws with no blend color at the default blendColor",
        (displayMode) => {
            const { blendColors } = renderCapturing(createPillPoster(plainUri, displayMode));

            expect(blendColors.length).toBeGreaterThan(0);
            expect(blendColors.every((rgba) => rgba === undefined)).toBe(true);
        }
    );

    test("a failed load draws its placeholder untinted", () => {
        const poster = SGNodeFactory.createNode("Poster");
        poster.setValue("loadDisplayMode", new BrsString("scaleToZoom"));
        poster.setValue("width", new Float(200));
        poster.setValue("height", new Float(40));
        poster.setValue("failedBitmapUri", new BrsString(plainUri));
        poster.setValue("uri", new BrsString("pkg:/images/does-not-exist.png"));
        expect(poster.getValueJS("loadStatus")).toBe("failed");

        const { blendColors } = renderCapturing(poster);

        // Said "untinted" as 0xffffffff, which leaked through the unnormalized scaleToZoom path.
        expect(blendColors.every((rgba) => rgba === undefined)).toBe(true);
    });

    test("an explicit blend color still reaches the draw", () => {
        const poster = createPillPoster(plainUri, "scaleToZoom");
        const purple = 0x7b2ff7ff | 0;
        poster.setValue("blendColor", new Int32(purple));

        const { blendColors } = renderCapturing(poster);

        expect(blendColors).toContain(purple);
    });

    test("the drawn rect matches the reported bounding rect", () => {
        const poster = createPillPoster(ninePatchUri, "scaleToFit");
        renderCapturing(poster);

        expect(poster.rectLocal).toEqual({ x: 0, y: 0, width: 200, height: 40 });
        expect(poster.rectToParent).toEqual({ x: 0, y: 0, width: 200, height: 40 });
    });

    test("a plain (non 9-patch) bitmap still letterboxes under scaleToFit", () => {
        const poster = createPillPoster(plainUri, "scaleToFit");
        const { ninePatchRects, scaledRects } = renderCapturing(poster);

        expect(ninePatchRects).toEqual([]);
        expect(scaledRects.length).toBe(1);
        // A square source pillarboxed into 200x40: 40x40, centered horizontally.
        expect(scaledRects[0].width).toBeCloseTo(40);
        expect(scaledRects[0].height).toBeCloseTo(40);
        expect(scaledRects[0].x).toBeCloseTo(80);
    });
});
