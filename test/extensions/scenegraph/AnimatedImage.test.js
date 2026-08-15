const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Field, SGNodeFactory, sgRoot, sgClock } = scenegraph;
const { BrsDevice, BrsString, Float, Interpreter } = core;

/**
 * AnimatedImage (field list device-confirmed, some vocabulary still inferred — see
 * AnimatedImage.ts's doc comment) must advance playback only on paint passes, exactly like
 * BusySpinner/ScrollingLabel (see BusySpinnerClock.test.js, ScrollingLabelClock.test.js and
 * .claude/docs/scenegraph-invariants.md's isPaintPass rule): a layout pass (bounding-rect refresh)
 * must draw the already-rendered frame, never advance it.
 */
describe("AnimatedImage clock behavior across pass kinds", () => {
    let interpreter;
    let fakeNow;

    /** Captures the frame actually rendered onto the node's internal drawable at draw time. */
    function paintAndCapturePixel(node) {
        let drawn;
        const draw2D = {
            doDrawScaledObject: (x, y, scaleX, scaleY, object) => {
                drawn = Array.from(object.getContext().getImageData(0, 0, 1, 1).data);
            },
            doDrawRotatedBitmap: (x, y, scaleX, scaleY, rotation, object) => {
                drawn = Array.from(object.getContext().getImageData(0, 0, 1, 1).data);
            },
        };
        node.paintNode(interpreter, [0, 0], 0, 1, draw2D);
        return drawn;
    }

    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
        const fixture = fs.readFileSync(path.join(__dirname, "../../brsTypes/resources/animated.webp"));
        BrsDevice.fileSystem.mkdirSync("pkg:/images");
        BrsDevice.fileSystem.writeFileSync("pkg:/images/animated.webp", fixture);
        const lottieFixture = fs.readFileSync(path.join(__dirname, "../../brsTypes/resources/sample.lottie.json"));
        BrsDevice.fileSystem.writeFileSync("pkg:/images/lottie.json", lottieFixture);
    });

    beforeEach(() => {
        interpreter = new Interpreter();
        fakeNow = 100_000;
        sgClock.setSource({ now: () => fakeNow, perfNow: () => fakeNow });
    });

    afterEach(() => {
        sgClock.setSource();
        sgRoot.setFocused();
    });

    function buildNode() {
        const node = SGNodeFactory.createNode("AnimatedImage");
        // DEVICE-CONFIRMED: real WebP apps never set `mimeType` at all — only Lottie apps do (see
        // AnimatedImage.ts's class/maybeLoad doc comments). `uri` alone must be enough to load.
        node.setValue("uri", new BrsString("pkg:/images/animated.webp"));
        return node;
    }

    test("loads a WebP file from uri alone, with no mimeType set at all", () => {
        const node = buildNode();
        expect(node.getValueJS("mimeType")).toBe("");
        // Loaded but not yet playing (no `control` set): the first frame is ready and displayed.
        expect(node.getValueJS("state")).toBe("first");
        expect(node.getValueJS("mediaWidth")).toBe(4);
        expect(node.getValueJS("mediaHeight")).toBe(4);
        expect(node.getValueJS("error")).toBe("");
    });

    test("loads a Lottie file when mimeType is set, uri applied first (imperative write order)", () => {
        const node = SGNodeFactory.createNode("AnimatedImage");
        node.setValue("uri", new BrsString("pkg:/images/lottie.json"));
        node.setValue("mimeType", new BrsString("video/lottie+json"));

        expect(node.getValueJS("state")).toBe("first");
        expect(node.getValueJS("mediaWidth")).toBe(200);
        expect(node.getValueJS("mediaHeight")).toBe(200);
    });

    test("loads a Lottie file when mimeType is set before uri (XML attribute order)", () => {
        const node = SGNodeFactory.createNode("AnimatedImage");
        node.setValue("mimeType", new BrsString("video/lottie+json"));
        node.setValue("uri", new BrsString("pkg:/images/lottie.json"));

        expect(node.getValueJS("state")).toBe("first");
        expect(node.getValueJS("mediaWidth")).toBe(200);
        expect(node.getValueJS("mediaHeight")).toBe(200);
    });

    test("reports error for a non-existent uri", () => {
        const node = SGNodeFactory.createNode("AnimatedImage");
        node.setValue("uri", new BrsString("pkg:/images/does-not-exist.webp"));
        expect(node.getValueJS("state")).toBe("error");
        expect(node.getValueJS("error")).not.toBe("");
    });

    // mimeType is a hint, not an authoritative format switch (Roku's own "video/webp" is
    // non-standard — the container's real, sniffable MIME is "image/webp"). Omitted, the format
    // is auto-detected; given, it's validated against the actual content.
    describe("mimeType is a hint, validated against the actual content", () => {
        test("Roku's non-standard 'video/webp' mimeType loads a real WebP file", () => {
            const node = SGNodeFactory.createNode("AnimatedImage");
            node.setValue("mimeType", new BrsString("video/webp"));
            node.setValue("uri", new BrsString("pkg:/images/animated.webp"));

            expect(node.getValueJS("state")).toBe("first");
            expect(node.getValueJS("mediaWidth")).toBe(4);
        });

        test("an unrecognized mimeType fails rather than guessing the format", () => {
            const node = SGNodeFactory.createNode("AnimatedImage");
            node.setValue("mimeType", new BrsString("image/webp")); // NOT one of the 3 documented values
            node.setValue("uri", new BrsString("pkg:/images/animated.webp"));

            expect(node.getValueJS("state")).toBe("error");
            expect(node.getValueJS("error")).not.toBe("");
        });

        test("a mimeType that contradicts the actual content fails instead of decoding the wrong way", () => {
            const node = SGNodeFactory.createNode("AnimatedImage");
            node.setValue("mimeType", new BrsString("video/lottie+json")); // real content is WebP
            node.setValue("uri", new BrsString("pkg:/images/animated.webp"));

            expect(node.getValueJS("state")).toBe("error");
            expect(node.getValueJS("error")).not.toBe("");
        });
    });

    test("field defaults match the published spec (loadDisplayMode/control/state)", () => {
        const node = SGNodeFactory.createNode("AnimatedImage");
        expect(node.getValueJS("loadDisplayMode")).toBe("scaleToFit");
        expect(node.getValueJS("control")).toBe("");
        expect(node.getValueJS("state")).toBe("stop");
    });

    test("control=loop/pause moves state between decode and stop once content is loaded", () => {
        const node = buildNode();
        expect(node.getValueJS("state")).toBe("first");

        node.setValue("control", new BrsString("loop"));
        expect(node.getValueJS("state")).toBe("decode");

        node.setValue("control", new BrsString("pause"));
        expect(node.getValueJS("state")).toBe("stop");
    });

    test("loadWidth/loadHeight scale the decoded media size, preserving aspect ratio", () => {
        const node = SGNodeFactory.createNode("AnimatedImage");
        node.setValue("loadWidth", new Float(2));
        node.setValue("loadHeight", new Float(2));
        node.setValue("uri", new BrsString("pkg:/images/animated.webp"));

        expect(node.getValueJS("mediaWidth")).toBe(2);
        expect(node.getValueJS("mediaHeight")).toBe(2);
    });

    test("frame advances only on paint, not on layout, and holds the frame across a layout pass", () => {
        const node = buildNode();
        node.setValue("control", new BrsString("loop"));

        const start = paintAndCapturePixel(node); // frame 0: red, [0, 100)
        expect(start).toEqual([255, 0, 0, 255]);

        // A layout pass (bounding-rect refresh) 150ms later must NOT advance playback.
        fakeNow += 150;
        node.layoutNode(interpreter, [0, 0], 0, 1);

        // The next PAINT still reflects the full 150ms elapsed (frame 1: green, [100, 250)) — the
        // interleaved layout did not consume or duplicate the time delta.
        const next = paintAndCapturePixel(node);
        expect(next).toEqual([0, 255, 0, 255]);
    });

    test("layout passes do not re-dirty the scene while playing", () => {
        const node = buildNode();
        node.setValue("control", new BrsString("loop"));
        paintAndCapturePixel(node);

        sgRoot.clearDirty();
        fakeNow += 50;
        node.layoutNode(interpreter, [0, 0], 0, 1);

        expect(sgRoot.isDirty).toBe(false);
    });

    test("control=stop resets playback and holds frame 0", () => {
        const node = buildNode();
        node.setValue("control", new BrsString("loop"));
        fakeNow += 120; // into frame 1 (green)
        paintAndCapturePixel(node);

        node.setValue("control", new BrsString("stop"));

        const afterStop = paintAndCapturePixel(node);
        expect(afterStop).toEqual([255, 0, 0, 255]); // back to frame 0, and not advancing further
    });

    test("control=play (single-shot) stops playback and holds the last frame once the duration elapses", () => {
        const node = buildNode();
        node.setValue("control", new BrsString("play"));

        fakeNow += 500; // past the fixture's 450ms total duration
        const held = paintAndCapturePixel(node);

        expect(held).toEqual([0, 0, 255, 255]); // held on the last frame (blue)

        // Time continuing to pass must not wrap back to frame 0 now that it has stopped.
        fakeNow += 1000;
        const stillHeld = paintAndCapturePixel(node);
        expect(stillHeld).toEqual([0, 0, 255, 255]);
    });

    test("control=loop never stops, even past the source's total duration", () => {
        const node = buildNode();
        node.setValue("control", new BrsString("loop"));

        fakeNow += 500; // past the 450ms total duration -> wraps to frame 0 (red)
        const wrapped = paintAndCapturePixel(node);
        expect(wrapped).toEqual([255, 0, 0, 255]);
    });
});
