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
