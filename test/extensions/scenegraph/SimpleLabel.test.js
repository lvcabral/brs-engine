const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Int32 } = core;

/** Minimal fake interpreter accepted by getBoundingRect (mirrors Poster.test.js). */
const fakeObserverInterpreter = { environment: {}, inSubEnv: () => {} };

/** Minimal interpreter accepted by renderNode → renderChildren (never dereferenced when draw2D is absent). */
const fakeInterpreter = {};

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
});
