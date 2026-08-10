const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, BrsBoolean, Float, RoArray } = core;

/** Minimal interpreter accepted by renderNode → renderChildren (never dereferenced when draw2D is absent). */
const fakeInterpreter = {};

/** Minimal fake interpreter accepted by getBoundingRect (mirrors SimpleLabel.test.js). */
const fakeObserverInterpreter = { environment: {}, inSubEnv: () => {} };

/** A float vector for translation-style fields. */
function vector(values) {
    return new RoArray(values.map((v) => new Float(v)));
}

/** Renders the label with a stub draw surface, capturing the y of each non-blank drawn line. */
function captureLineYs(label) {
    const ys = [];
    const draw2D = {
        doDrawRotatedText(text, x, y) {
            if (text.trim() !== "") ys.push(y);
        },
    };
    label.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);
    return ys;
}

/** Renders the label with a stub draw surface, capturing the text of each drawn line, in order. */
function captureLineTexts(label) {
    const texts = [];
    const draw2D = {
        doDrawRotatedText(text) {
            texts.push(text);
        },
    };
    label.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);
    return texts;
}

/** A long string that wraps to multiple lines at a narrow width. */
const LONG_TEXT =
    "The quick brown fox jumps over the lazy dog while the lazy dog sleeps soundly in the warm afternoon sun.";

describe("Label node wrap/vertAlign", () => {
    beforeAll(() => {
        // Label resolves its font from the common: volume; mount it once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    function wrappingLabel({ vertAlign = "top", height, translation = [0, 0], lineSpacing }) {
        const label = SGNodeFactory.createNode("Label");
        label.setValue("font", new BrsString("font:MediumSystemFont"));
        label.setValue("width", new Float(400));
        label.setValue("wrap", BrsBoolean.True);
        label.setValue("vertAlign", new BrsString(vertAlign));
        label.setValue("translation", vector(translation));
        if (height !== undefined) label.setValue("height", new Float(height));
        if (lineSpacing !== undefined) label.setValue("lineSpacing", new Float(lineSpacing));
        label.setValue("text", new BrsString(LONG_TEXT));
        return label;
    }

    /**
     * Regression: a wrapping Label with no explicit height (height=0) and vertAlign="bottom"
     * must NOT shift its text up by the rendered text height. Roku's LabelBase spec: when
     * height, numLines and maxLines are all zero the computed height equals the rendered text
     * height, so every vertAlign value renders identically. The bug shifted the text up by the
     * full text height, drawing it above its own origin and overlapping the node above it.
     */
    test("wrap + height=0 ignores vertAlign (bottom draws at the same y as top)", () => {
        const topYs = captureLineYs(wrappingLabel({ vertAlign: "top", translation: [0, 100] }));
        const bottomYs = captureLineYs(wrappingLabel({ vertAlign: "bottom", translation: [0, 100] }));

        expect(topYs.length).toBeGreaterThan(1); // actually wrapped
        expect(bottomYs.length).toBe(topYs.length);
        // First line starts at the translation y, not shifted up by the text height.
        expect(topYs[0]).toBeCloseTo(100, 5);
        expect(bottomYs[0]).toBeCloseTo(topYs[0], 5);
    });

    /**
     * When height is explicitly larger than the rendered text, vertAlign still applies:
     * "bottom" pushes the text down within the taller box.
     */
    test("wrap + explicit height honors vertAlign=bottom", () => {
        const topYs = captureLineYs(wrappingLabel({ vertAlign: "top", height: 600 }));
        const bottomYs = captureLineYs(wrappingLabel({ vertAlign: "bottom", height: 600 }));

        expect(topYs[0]).toBeCloseTo(0, 5);
        expect(bottomYs[0]).toBeGreaterThan(topYs[0]);
    });

    /**
     * Regression: wrap="true" must break on an embedded chr(10) even when the whole string
     * (newlines and all) measures narrower than the label's width. The reference is explicit:
     * "Each newline character in the text results in a new line of text." `breakTextIntoLines`
     * had a single-line fast path (skip word-splitting when the full text already fits the box)
     * that measured the newline characters as ordinary — near-zero-width — glyphs instead of
     * treating them as forced breaks, so short multi-line text (e.g. a handful of short chat/log
     * lines appended with chr(10), each individually much narrower than the box) rendered as one
     * run-together line. It only "worked" once accumulated text grew wide enough to overflow the
     * box and fall through to the real word-wrap loop below, which already handled "\n" correctly
     * — matching the reported symptom exactly (fine once wrapping kicks in, broken before that).
     */
    test("wrap + short text still breaks on embedded newlines", () => {
        const label = SGNodeFactory.createNode("Label");
        label.setValue("font", new BrsString("font:MediumSystemFont"));
        label.setValue("width", new Float(400));
        label.setValue("wrap", BrsBoolean.True);
        label.setValue("text", new BrsString("line one\nline two\nline three"));

        const texts = captureLineTexts(label);
        expect(texts).toEqual(["line one", "line two", "line three"]);

        const ys = captureLineYs(label);
        expect(new Set(ys).size).toBe(3); // three distinct line positions, not stacked on one y
    });

    /**
     * The measured multi-line height must include inter-line lineSpacing, matching the draw
     * loop (which advances by lineHeight + lineSpacing between lines). Otherwise a LayoutGroup
     * stacking children below a wrapped Label uses an under-measured height and overlaps them.
     */
    test("measured wrap height includes (N-1) * lineSpacing", () => {
        const label = wrappingLabel({ lineSpacing: 20 });

        // Count the wrapped lines via the draw pass.
        const lineCount = captureLineYs(label).length;
        expect(lineCount).toBeGreaterThan(1);

        const font = label.getValue("font").createDrawFont();
        const lineHeight = font.measureTextHeight();
        const expected = lineCount * lineHeight + (lineCount - 1) * 20;

        const measured = label.getMeasured();
        expect(measured.height).toBeCloseTo(expected, 5);
    });

    /**
     * Regression: a detached Label given explicit width/height (text not yet set) must report
     * that size from boundingRect() even when queried during an active render pass. Apps center
     * an overlay label over an icon by reading boundingRect() right after setting width/height
     * and before appendChild; when that code runs inside a render (e.g. an item component
     * created mid-frame), getBoundingRect skips the layout refresh and its measuring fallback
     * (rectLocal is already populated by getMeasured), so getMeasured itself must keep
     * rectToParent/rectToScene in sync with rectLocal rather than leaving them at zero —
     * otherwise the app's centering math places the label's top-left at the icon's center.
     */
    test("detached sized Label reports its explicit size from boundingRect() mid-render", () => {
        const label = SGNodeFactory.createNode("Label");
        label.setValue("font", new BrsString("font:SmallestSystemFont"));
        label.setValue("horizAlign", new BrsString("center"));
        label.setValue("vertAlign", new BrsString("center"));
        label.setValue("width", new Float(56));
        label.setValue("height", new Float(56));
        // NOT appended to any parent; text not set — exactly the eager-measure scenario.

        sgRoot.rendering = true;
        try {
            const rect = label.getBoundingRect("toParent", fakeObserverInterpreter);
            expect(rect.width).toBe(56);
            expect(rect.height).toBe(56);
            const scene = label.getBoundingRect("toScene", fakeObserverInterpreter);
            expect(scene.width).toBe(56);
            expect(scene.height).toBe(56);
        } finally {
            sgRoot.rendering = false;
        }

        // Outside a render pass the same query must also return the explicit size.
        const rect = label.getBoundingRect("toParent", fakeObserverInterpreter);
        expect(rect.width).toBe(56);
        expect(rect.height).toBe(56);
    });

    test("detached sized Label boundingRect() carries its translation into parent space", () => {
        const label = SGNodeFactory.createNode("Label");
        label.setValue("font", new BrsString("font:SmallestSystemFont"));
        label.setValue("translation", vector([10, 20]));
        label.setValue("width", new Float(56));
        label.setValue("height", new Float(56));

        sgRoot.rendering = true;
        try {
            expect(label.getBoundingRect("toParent", fakeObserverInterpreter)).toEqual({
                x: 10,
                y: 20,
                width: 56,
                height: 56,
            });
        } finally {
            sgRoot.rendering = false;
        }
    });
});

/**
 * Regression: `scale` used to be a no-op on drawn text (it was only ever applied to Poster-style
 * bitmap drawing), so a component hiding a Label via `scale=[0,0]` when unfocused — the idiomatic
 * Roku show/hide pattern used by many apps' focus-driven buttons — rendered the label at full size
 * regardless of scale. Fixed by wrapping the (unmodified) draw call in a division-free
 * translate/scale/translate-back bracket (IfDraw2D.pushScale/popScale).
 */
describe("Label node scale", () => {
    afterEach(() => {
        sgRoot.setFocused();
    });

    function textLabel({ scale, translation = [0, 0], text = "hello", horizAlign = "left" } = {}) {
        const label = SGNodeFactory.createNode("Label");
        label.setValue("font", new BrsString("font:MediumSystemFont"));
        label.setValue("translation", vector(translation));
        label.setValue("horizAlign", new BrsString(horizAlign));
        if (scale !== undefined) label.setValue("scale", vector(scale));
        label.setValue("text", new BrsString(text));
        return label;
    }

    test("scale=[0,0] pushes a scale bracket (around the node's translated origin) before drawing, then pops it", () => {
        const label = textLabel({ scale: [0, 0], translation: [10, 20] });
        const calls = [];
        const draw2D = {
            pushScale(pivotX, pivotY, scaleX, scaleY) {
                calls.push(["push", pivotX, pivotY, scaleX, scaleY]);
                return true;
            },
            popScale() {
                calls.push(["pop"]);
            },
            doDrawRotatedText(text) {
                calls.push(["draw", text]);
            },
        };
        label.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

        expect(calls[0]).toEqual(["push", 10, 20, 0, 0]);
        expect(calls[1][0]).toBe("draw");
        expect(calls[2]).toEqual(["pop"]);
    });

    test("scale=[1,1] (default) never calls pushScale/popScale", () => {
        const label = textLabel();
        // Deliberately omits pushScale/popScale, mirroring existing minimal draw2D stubs
        // elsewhere in this file (e.g. captureLineYs) — a default-scale node must not call them.
        const draw2D = { doDrawRotatedText() {} };
        expect(() => label.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D)).not.toThrow();
    });

    test("a wrapping multi-line Label pushes the scale bracket once for the whole block, not per line", () => {
        const label = SGNodeFactory.createNode("Label");
        label.setValue("font", new BrsString("font:MediumSystemFont"));
        label.setValue("width", new Float(400));
        label.setValue("wrap", BrsBoolean.True);
        label.setValue("scale", vector([2, 2]));
        label.setValue("text", new BrsString(LONG_TEXT));

        let pushCount = 0;
        let popCount = 0;
        let drawCount = 0;
        const draw2D = {
            pushScale() {
                pushCount++;
                return true;
            },
            popScale() {
                popCount++;
            },
            doDrawRotatedText(text) {
                if (text.trim() !== "") drawCount++;
            },
        };
        label.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

        expect(drawCount).toBeGreaterThan(1); // actually wrapped into multiple lines
        expect(pushCount).toBe(1);
        expect(popCount).toBe(1);
    });

    test("scale does not affect measured size (getMeasured)", () => {
        const unscaled = textLabel().getMeasured();
        const shrunk = textLabel({ scale: [0, 0] }).getMeasured();
        const grown = textLabel({ scale: [2, 2] }).getMeasured();

        expect(shrunk.width).toBeCloseTo(unscaled.width, 5);
        expect(shrunk.height).toBeCloseTo(unscaled.height, 5);
        expect(grown.width).toBeCloseTo(unscaled.width, 5);
        expect(grown.height).toBeCloseTo(unscaled.height, 5);
    });
});

/**
 * Integration regression, reproducing the reported shape: a custom "button" component (a Group
 * wrapping a fixed-width Rectangle background that stays present, plus a Label collapsed via
 * `scale=[0,0]` — TextIconButton's exact pattern, with a Rectangle standing in for its Poster
 * background) placed inside an outer horizontal LayoutGroup (TransportButtons). Before this fix,
 * the collapsed Label still contributed its full unscaled text width to the button's own reported
 * footprint, so the outer LayoutGroup spaced buttons as if every label were shown even when none
 * had focus.
 */
describe("LayoutGroup spacing reflects a button whose label is collapsed via scale", () => {
    afterEach(() => {
        sgRoot.setFocused();
    });

    function button({ bgWidth, labelScale, text = "Feedback" }) {
        const group = SGNodeFactory.createNode("Group");
        const bg = SGNodeFactory.createNode("Rectangle");
        bg.setValue("width", new Float(bgWidth));
        bg.setValue("height", new Float(60));
        group.appendChildToParent(bg);

        const label = SGNodeFactory.createNode("Label");
        label.setValue("font", new BrsString("font:MediumSystemFont"));
        label.setValue("translation", vector([10, 20]));
        label.setValue("scale", vector(labelScale));
        label.setValue("text", new BrsString(text));
        group.appendChildToParent(label);

        return group;
    }

    test("a button with its label collapsed reports a footprint close to its background, not its label text", () => {
        const focusedButton = button({ bgWidth: 160, labelScale: [1, 1] });
        const collapsedButton = button({ bgWidth: 40, labelScale: [0, 0] });

        const row = SGNodeFactory.createNode("LayoutGroup");
        row.setValue("layoutDirection", new BrsString("horiz"));
        row.setValue("itemSpacings", vector([20]));
        row.appendChildToParent(focusedButton);
        row.appendChildToParent(collapsedButton);

        const draw2D = {
            doDrawRotatedText() {},
            doDrawRotatedRect() {},
            pushScale() {
                return true;
            },
            popScale() {},
        };
        row.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

        // The collapsed button must be packed right after the focused one's background width
        // (160) plus the item spacing (20) — NOT pushed out by "Feedback"'s full text width,
        // which is comfortably wider than the 40px background alone.
        expect(collapsedButton.getValueJS("translation")[0]).toBeCloseTo(180, 5);
    });
});
