const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot, sgClock } = scenegraph;
const { BrsDevice, BrsString, Int32, Interpreter } = core;

/**
 * ScrollingLabel's marquee advances only on paint passes; a layout pass (bounding-rect refresh)
 * renders the stored scroll position without consuming the time delta. Before the layout/paint
 * split, a measurement between two frames ate part of the elapsed time (stuttering the marquee
 * under boundingRect polling) and the mid-render makeDirty re-dirtied the scene from inside a
 * refresh.
 */
describe("ScrollingLabel marquee across pass kinds", () => {
    let interpreter;
    let fakeNow;

    /** Captures the x offset the marquee text is drawn at. */
    function paintAndCaptureX(label) {
        let capturedX;
        const draw2D = {
            pushClip() {},
            popClip() {},
            doDrawRotatedText(text, x) {
                capturedX = x;
            },
        };
        label.paintNode(interpreter, [0, 0], 0, 1, draw2D);
        return capturedX;
    }

    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        interpreter = new Interpreter();
        fakeNow = 200_000;
        sgClock.setSource({ now: () => fakeNow, perfNow: () => fakeNow });
    });

    afterEach(() => {
        sgClock.setSource();
        sgRoot.setFocused();
    });

    function buildMarquee() {
        const label = SGNodeFactory.createNode("ScrollingLabel");
        label.setValue("maxWidth", new Int32(150));
        label.setValue("text", new BrsString("A very long text that certainly does not fit into 150 pixels"));
        return label;
    }

    test("interleaved layout passes do not eat the scroll delta", () => {
        // Two identical marquees; one gets layout passes interleaved between its paints.
        // Both must land on the same scroll offset at the same wall-clock time.
        const plain = buildMarquee();
        const measured = buildMarquee();

        paintAndCaptureX(plain);
        paintAndCaptureX(measured);

        // Get both past the initial pause (2500ms) into SCROLLING.
        fakeNow += 3000;
        paintAndCaptureX(plain);
        paintAndCaptureX(measured);

        // Advance 1s of scrolling; hammer one with layout passes mid-interval.
        fakeNow += 500;
        measured.layoutNode(interpreter, [0, 0], 0, 1);
        measured.layoutNode(interpreter, [0, 0], 0, 1);
        fakeNow += 500;
        const plainX = paintAndCaptureX(plain);
        const measuredX = paintAndCaptureX(measured);

        expect(measuredX).toBe(plainX);
        // And it actually scrolled (offset went negative).
        expect(plainX).toBeLessThan(0);
    });

    test("a layout pass during scrolling does not move the drawn offset", () => {
        const label = buildMarquee();
        paintAndCaptureX(label);
        fakeNow += 3000; // into SCROLLING
        const x1 = paintAndCaptureX(label);

        fakeNow += 1000;
        label.layoutNode(interpreter, [0, 0], 0, 1);
        // Paint with a zero-delta clock read (no time passed since the layout): the offset
        // moved only by the paint-to-paint delta, unaffected by the layout in between.
        const x2 = paintAndCaptureX(label);
        expect(x2).toBeLessThan(x1); // scrolled by the 1000ms between paints

        // Now verify layout alone never moves it: two layouts with clock advancing.
        const rectBefore = { ...label.rectToParent };
        fakeNow += 700;
        label.layoutNode(interpreter, [0, 0], 0, 1);
        expect(label.rectToParent).toEqual(rectBefore);
    });

    test("layout passes do not re-dirty the scene while the marquee is active", () => {
        const label = buildMarquee();
        paintAndCaptureX(label);
        fakeNow += 3000;

        sgRoot.clearDirty();
        label.layoutNode(interpreter, [0, 0], 0, 1);

        expect(sgRoot.isDirty).toBe(false);
    });
});
