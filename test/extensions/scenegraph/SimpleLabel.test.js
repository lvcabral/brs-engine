const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Int32, Float, RoArray } = core;

/** Minimal fake interpreter accepted by getBoundingRect (mirrors Poster.test.js). */
const fakeObserverInterpreter = { environment: {}, inSubEnv: () => {} };

/** Minimal interpreter accepted by renderNode → renderChildren (never dereferenced when draw2D is absent). */
const fakeInterpreter = {};

/** A float vector for translation/scale-style fields. */
function vector(values) {
    return new RoArray(values.map((v) => new Float(v)));
}

describe("SimpleLabel node", () => {
    beforeAll(() => {
        // SimpleLabel resolves its font from the common: volume; mount it once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    test("is wired into the factory as a SimpleLabel subtype", () => {
        const label = SGNodeFactory.createNode("SimpleLabel");
        expect(label).toBeDefined();
        expect(label.constructor.name).toBe("SimpleLabel");
        expect(label.nodeSubtype).toBe("SimpleLabel");
    });

    test("exposes the documented default fields, types and values", () => {
        const label = SGNodeFactory.createNode("SimpleLabel");
        const fields = label.getNodeFields();

        const expected = [
            ["text", "string", ""],
            ["color", "color", 0xddddddff | 0], // stored as a signed 32-bit int
            ["fontUri", "string", ""],
            ["fontSize", "integer", 0],
            ["horizOrigin", "string", "left"],
            ["vertOrigin", "string", "top"],
        ];
        for (const [name, type, value] of expected) {
            const field = fields.get(name.toLowerCase()); // the field map is keyed lowercase
            expect(field).toBeDefined();
            expect(field.getType()).toBe(type);
            expect(label.getValueJS(name)).toBe(value);
        }
    });

    test("extends Group (inherits Group fields)", () => {
        const label = SGNodeFactory.createNode("SimpleLabel");
        const fields = label.getNodeFields();
        for (const groupField of ["translation", "opacity", "visible", "rotation"]) {
            expect(fields.get(groupField.toLowerCase())).toBeDefined();
        }
    });

    test("round-trips field assignments", () => {
        const label = SGNodeFactory.createNode("SimpleLabel");
        label.setValue("text", new BrsString("Hello"));
        label.setValue("fontUri", new BrsString("font:LargeBoldSystemFont"));
        label.setValue("fontSize", new Int32(40));
        label.setValue("horizOrigin", new BrsString("center"));
        label.setValue("vertOrigin", new BrsString("baseline"));

        expect(label.getValueJS("text")).toBe("Hello");
        expect(label.getValueJS("fontUri")).toBe("font:LargeBoldSystemFont");
        expect(label.getValueJS("fontSize")).toBe(40);
        expect(label.getValueJS("horizOrigin")).toBe("center");
        expect(label.getValueJS("vertOrigin")).toBe("baseline");
    });

    test("measures non-empty text after a measure pass", () => {
        const label = SGNodeFactory.createNode("SimpleLabel");
        label.setValue("text", new BrsString("Measured"));
        const measured = label.getMeasured();
        expect(measured.width).toBeGreaterThan(0);
        expect(measured.height).toBeGreaterThan(0);
    });

    /**
     * Regression: boundingRect() queried during a render on a label whose cached rect is degenerate
     * in ONLY one dimension must still re-measure. A text label first measured while its text was
     * empty caches width 0 but a non-zero, text-independent line height. When a consumer then reads
     * boundingRect() mid-render (e.g. an item component sizing a background from the label), the
     * getBoundingRect measuring fallback used to require BOTH width and height to be zero, so a
     * {width:0, height:N} rect skipped the refresh and returned width 0 — collapsing the background
     * to padding. The fallback now triggers when EITHER dimension is zero.
     */
    test("boundingRect() re-measures a zero-width/non-zero-height label queried mid-render", () => {
        const label = SGNodeFactory.createNode("SimpleLabel");
        label.setValue("fontUri", new BrsString("font:MediumSystemFont"));
        label.setValue("fontSize", new Int32(16));
        label.setValue("text", new BrsString("Measured"));
        const trueWidth = label.getMeasured().width;
        expect(trueWidth).toBeGreaterThan(0);

        // Poison the cached rect to width 0 with a non-zero height, as an empty-text measure leaves it.
        label.rectLocal = { x: 0, y: 0, width: 0, height: 22 };
        label.rectToParent = { x: 0, y: 0, width: 0, height: 22 };
        label.rectToScene = { x: 0, y: 0, width: 0, height: 22 };

        sgRoot.rendering = true;
        try {
            const rect = label.getBoundingRect("toParent", fakeObserverInterpreter);
            expect(rect.width).toBe(trueWidth);
        } finally {
            sgRoot.rendering = false;
        }
    });

    test("renders without a draw surface for every origin combination", () => {
        const label = SGNodeFactory.createNode("SimpleLabel");
        label.setValue("text", new BrsString("Origin"));
        for (const h of ["left", "center", "right"]) {
            for (const v of ["top", "center", "baseline", "bottom"]) {
                label.setValue("horizOrigin", new BrsString(h));
                label.setValue("vertOrigin", new BrsString(v));
                expect(() => label.renderNode(fakeInterpreter, [0, 0], 0, 1)).not.toThrow();
            }
        }
    });

    /**
     * Regression: `scale` used to be a no-op on SimpleLabel (only Label ever wired the draw-time
     * and bounding-rect scale bracket), so `scale=[0,0]` never visually collapsed it. Fixed by the
     * same Group.withScale/applyScale mechanism Label uses. SimpleLabel's own renderLabel mutates
     * rect.x/y in place for horizOrigin/vertOrigin alignment BEFORE drawing, so the scale pivot must
     * be captured up front — otherwise a centered/right/bottom-anchored label would scale around its
     * post-alignment position instead of its own translation.
     */
    describe("scale", () => {
        function scaledLabel({ scale, translation, horizOrigin = "left", vertOrigin = "top" } = {}) {
            const label = SGNodeFactory.createNode("SimpleLabel");
            label.setValue("fontUri", new BrsString("font:MediumSystemFont"));
            label.setValue("text", new BrsString("hello"));
            if (translation) label.setValue("translation", vector(translation));
            label.setValue("horizOrigin", new BrsString(horizOrigin));
            label.setValue("vertOrigin", new BrsString(vertOrigin));
            if (scale) label.setValue("scale", vector(scale));
            return label;
        }

        test("scale=[0,0] pushes a scale bracket around the node's own translation, not the aligned draw position", () => {
            const label = scaledLabel({
                scale: [0, 0],
                translation: [10, 20],
                horizOrigin: "center",
                vertOrigin: "bottom",
            });
            const calls = [];
            const draw2D = {
                pushScale(pivotX, pivotY, scaleX, scaleY) {
                    calls.push(["push", pivotX, pivotY, scaleX, scaleY]);
                    return true;
                },
                popScale() {
                    calls.push(["pop"]);
                },
                doDrawRotatedText(text, x, y) {
                    calls.push(["draw", x, y]);
                },
            };
            label.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

            // Pivot is the node's own (10,20) translation, NOT wherever center/bottom alignment
            // shifted the actual draw position to.
            expect(calls[0]).toEqual(["push", 10, 20, 0, 0]);
            expect(calls[1][0]).toBe("draw");
            expect(calls[1][1]).not.toBe(10); // the draw itself IS shifted by horizOrigin/vertOrigin
            expect(calls[2]).toEqual(["pop"]);
        });

        test("scale=[1,1] (default) never calls pushScale/popScale", () => {
            const label = scaledLabel();
            const draw2D = { doDrawRotatedText() {} };
            expect(() => label.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D)).not.toThrow();
        });

        test("scale=[0,0] collapses the reported boundingRect", () => {
            const label = scaledLabel({ scale: [0, 0], translation: [10, 20] });
            const draw2D = {
                doDrawRotatedText() {},
                pushScale() {
                    return true;
                },
                popScale() {},
            };
            label.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

            const rect = label.getBoundingRect("toParent", fakeObserverInterpreter);
            expect(rect.width).toBe(0);
            expect(rect.height).toBe(0);
        });
    });
});
