const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Float, RoArray } = core;

/** Minimal interpreter accepted by renderNode → renderChildren (never dereferenced when draw2D is absent). */
const fakeInterpreter = {};

/** A float vector for translation/scale-style fields. */
function vector(values) {
    return new RoArray(values.map((v) => new Float(v)));
}

/** Renders the label with a stub draw surface, capturing the y of the drawn text. */
function captureTextY(label) {
    let capturedY;
    const draw2D = {
        pushClip() {},
        popClip() {},
        doDrawRotatedText(text, x, y) {
            if (text.trim() !== "") capturedY = y;
        },
    };
    label.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);
    return capturedY;
}

describe("ScrollingLabel node vertAlign", () => {
    beforeAll(() => {
        // ScrollingLabel resolves its font from the common: volume; mount it once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    /** Short, non-scrolling label so the text is drawn statically. */
    function scrollingLabel({ vertAlign = "top", height } = {}) {
        const label = SGNodeFactory.createNode("ScrollingLabel");
        label.setValue("font", new BrsString("font:MediumSystemFont"));
        label.setValue("width", new Float(200));
        label.setValue("vertAlign", new BrsString(vertAlign));
        if (height !== undefined) label.setValue("height", new Float(height));
        label.setValue("text", new BrsString("Search"));
        return label;
    }

    function textHeightOf(label) {
        return label.getValue("font").createDrawFont().measureTextHeight();
    }

    /**
     * Regression: a ScrollingLabel with an explicit height taller than the text and
     * vertAlign="center" must center the text within its box. The bug overwrote rect.height
     * with the measured text height before applying the offset, so it always drew at the top
     * (y = 0) — the symptom being the Jellyfin home Search/Settings button labels sitting at
     * the top of the button instead of centered next to the icon.
     */
    test("explicit height centers the text (vertAlign=center)", () => {
        const label = scrollingLabel({ vertAlign: "center", height: 50 });
        const expected = (50 - textHeightOf(label)) / 2;
        expect(expected).toBeGreaterThan(1); // sanity: the box is meaningfully taller than the text

        expect(captureTextY(label)).toBeCloseTo(expected, 5);
    });

    /** vertAlign="bottom" pushes the text to the bottom of the taller box. */
    test("explicit height honors vertAlign=bottom", () => {
        const label = scrollingLabel({ vertAlign: "bottom", height: 50 });
        const expected = 50 - textHeightOf(label);

        expect(captureTextY(label)).toBeCloseTo(expected, 5);
    });

    /** vertAlign="top" (and the default) draws at the box top. */
    test("explicit height with vertAlign=top draws at the top", () => {
        expect(captureTextY(scrollingLabel({ vertAlign: "top", height: 50 }))).toBeCloseTo(0, 5);
    });

    /**
     * When height is unset (0), the box is not taller than the text, so vertAlign is a no-op
     * and the text must NOT be shifted up above its own origin (guarded by boxHeight > textHeight).
     */
    test("height=0 does not shift the text up", () => {
        const centerYs = captureTextY(scrollingLabel({ vertAlign: "center" }));
        const bottomYs = captureTextY(scrollingLabel({ vertAlign: "bottom" }));

        expect(centerYs).toBeCloseTo(0, 5);
        expect(bottomYs).toBeCloseTo(0, 5);
    });
});

/**
 * Regression: `scale` used to be a no-op on ScrollingLabel (it overrides Label.renderLabel with
 * its own marquee draw path, bypassing Group.drawText's scale bracket entirely), so
 * `scale=[0,0]` never visually collapsed it. Fixed via the same Group.withScale mechanism, pushed
 * around the existing pushClip/popClip bracket. The bounding-rect fix comes for free: ScrollingLabel
 * doesn't override Label.renderNodeContent, which already applies Group.applyScale.
 */
describe("ScrollingLabel node scale", () => {
    afterEach(() => {
        sgRoot.setFocused();
    });

    function scrollingLabel({ scale, translation = [0, 0] } = {}) {
        const label = SGNodeFactory.createNode("ScrollingLabel");
        label.setValue("font", new BrsString("font:MediumSystemFont"));
        label.setValue("translation", vector(translation));
        if (scale) label.setValue("scale", vector(scale));
        label.setValue("text", new BrsString("Search"));
        return label;
    }

    test("scale=[0,0] pushes a scale bracket around the node's own translation before drawing", () => {
        const label = scrollingLabel({ scale: [0, 0], translation: [10, 20] });
        const calls = [];
        const draw2D = {
            pushClip() {},
            popClip() {},
            pushScale(pivotX, pivotY, scaleX, scaleY) {
                calls.push(["push", pivotX, pivotY, scaleX, scaleY]);
                return true;
            },
            popScale() {
                calls.push(["pop"]);
            },
            doDrawRotatedText(text) {
                if (text.trim() !== "") calls.push(["draw", text]);
            },
        };
        label.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

        expect(calls[0]).toEqual(["push", 10, 20, 0, 0]);
        expect(calls.at(-1)).toEqual(["pop"]);
    });

    test("scale=[1,1] (default) never calls pushScale/popScale", () => {
        const label = scrollingLabel();
        const draw2D = { pushClip() {}, popClip() {}, doDrawRotatedText() {} };
        expect(() => label.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D)).not.toThrow();
    });

    test("scale=[0,0] collapses the reported boundingRect", () => {
        const label = scrollingLabel({ scale: [0, 0], translation: [10, 20] });
        const draw2D = {
            pushClip() {},
            popClip() {},
            doDrawRotatedText() {},
            pushScale() {
                return true;
            },
            popScale() {},
        };
        label.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

        const rect = label.getBoundingRect("toParent", { environment: {}, inSubEnv: () => {} });
        expect(rect.width).toBe(0);
        expect(rect.height).toBe(0);
    });
});
