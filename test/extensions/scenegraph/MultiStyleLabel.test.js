const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, BrsBoolean, Int32, RoAssociativeArray } = core;

/** Minimal interpreter accepted by renderNode → renderChildren (never dereferenced when draw2D is absent). */
const fakeInterpreter = {};

/** Minimal fake interpreter accepted by getBoundingRect (mirrors SimpleLabel.test.js). */
const fakeObserverInterpreter = { environment: {}, inSubEnv: () => {} };

/**
 * Builds a `drawingStyles` AA: { styleName: { fontUri, fontSize, color } }.
 * Uses the RoAssociativeArray constructor (not .set) so keys keep their original
 * case — exactly how the interpreter builds AA literals. Reading these properties
 * must be case-insensitive (e.g. "fontUri", not "fonturi").
 */
function drawingStyles(styles) {
    const outerMembers = [];
    for (const [name, def] of Object.entries(styles)) {
        const innerMembers = [];
        if (def.fontUri !== undefined)
            innerMembers.push({ name: new BrsString("fontUri"), value: new BrsString(def.fontUri) });
        if (def.fontSize !== undefined)
            innerMembers.push({ name: new BrsString("fontSize"), value: new Int32(def.fontSize) });
        if (def.color !== undefined)
            innerMembers.push({ name: new BrsString("color"), value: new BrsString(def.color) });
        outerMembers.push({ name: new BrsString(name), value: new RoAssociativeArray(innerMembers) });
    }
    return new RoAssociativeArray(outerMembers);
}

/** Renders the label with a stub draw surface, capturing the font/color used per drawn span. */
function captureSpans(label) {
    const spans = [];
    const draw2D = {
        doDrawRotatedText(text, x, y, color, opacity, font, rotation) {
            if (text.trim() !== "") spans.push({ text, family: font.family, size: font.size, color });
        },
    };
    label.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);
    return spans;
}

describe("MultiStyleLabel node", () => {
    beforeAll(() => {
        // MultiStyleLabel resolves its fonts from the common: volume; mount it once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    test("is wired into the factory as a MultiStyleLabel subtype", () => {
        const label = SGNodeFactory.createNode("MultiStyleLabel");
        expect(label).toBeDefined();
        expect(label.constructor.name).toBe("MultiStyleLabel");
        expect(label.nodeSubtype).toBe("MultiStyleLabel");
    });

    test("exposes the documented default fields, types and values", () => {
        const label = SGNodeFactory.createNode("MultiStyleLabel");
        const fields = label.getNodeFields();

        const expected = [
            ["text", "string", ""],
            ["color", "color", 0xddddddff | 0], // stored as a signed 32-bit int
            ["horizAlign", "string", "left"],
            ["vertAlign", "string", "top"],
            ["width", "float", 0],
            ["height", "float", 0],
            ["numLines", "integer", 0],
            ["maxLines", "integer", 0],
            ["wrap", "boolean", false],
            ["ellipsizeOnBoundary", "boolean", false],
            ["isTextEllipsized", "boolean", false],
        ];
        for (const [name, type, value] of expected) {
            const field = fields.get(name.toLowerCase()); // the field map is keyed lowercase
            expect(field).toBeDefined();
            expect(field.getType()).toBe(type);
            expect(label.getValueJS(name)).toBe(value);
        }
        expect(fields.get("drawingstyles")).toBeDefined();
        expect(fields.get("drawingstyles").getType()).toBe("assocarray");
    });

    test("extends Group (inherits Group fields)", () => {
        const label = SGNodeFactory.createNode("MultiStyleLabel");
        const fields = label.getNodeFields();
        for (const groupField of ["translation", "opacity", "visible", "rotation"]) {
            expect(fields.get(groupField.toLowerCase())).toBeDefined();
        }
    });

    test("round-trips drawingStyles as an associative array (keys keep their case)", () => {
        const label = SGNodeFactory.createNode("MultiStyleLabel");
        label.setValue("drawingStyles", drawingStyles({ red: { fontSize: 36, color: "#FF0000FF" } }));
        const styles = label.getValueJS("drawingStyles");
        // AA literals from the interpreter preserve original key case.
        expect(styles.red.fontSize).toBe(36);
        expect(styles.red.color).toBe("#FF0000FF");
    });

    test("resolves each markup span to its style's font and color (case-insensitive keys)", () => {
        const label = SGNodeFactory.createNode("MultiStyleLabel");
        label.setValue(
            "drawingStyles",
            drawingStyles({
                default: { fontUri: "font:MediumSystemFont", color: "#FFFFFFFF" },
                title: { fontUri: "font:LargeSystemFont", color: "#00FF00FF" },
            })
        );
        label.setValue("text", new BrsString("body <title>BIG</title>"));
        const spans = captureSpans(label);

        const body = spans.find((s) => s.text === "body");
        const big = spans.find((s) => s.text === "BIG");
        expect(body).toBeDefined();
        expect(big).toBeDefined();
        // The styled span must pick up its own font (here a larger system font) and color.
        // A regression in key casing (reading `fonturi` instead of `fontUri`) collapses both
        // spans to the same default font/size, so these would be equal.
        expect(big.size).toBeGreaterThan(body.size);
        expect(big.color).toBe(0x00ff00ff | 0);
        expect(body.color).toBe(0xffffffff | 0);
    });

    test("measures markup text after a measure pass", () => {
        const label = SGNodeFactory.createNode("MultiStyleLabel");
        label.setValue(
            "drawingStyles",
            drawingStyles({
                default: { fontUri: "font:MediumSystemFont", color: "#FFFFFFFF" },
                red: { fontUri: "font:MediumSystemFont", color: "#FF0000FF" },
            })
        );
        label.setValue("text", new BrsString("Plain <red>Red text</red> tail"));
        const measured = label.getMeasured();
        expect(measured.width).toBeGreaterThan(0);
        expect(measured.height).toBeGreaterThan(0);
    });

    test("renders mixed styles without a draw surface for every alignment", () => {
        const label = SGNodeFactory.createNode("MultiStyleLabel");
        label.setValue(
            "drawingStyles",
            drawingStyles({ default: { fontUri: "font:SmallSystemFont" }, big: { fontUri: "font:LargeSystemFont" } })
        );
        label.setValue("text", new BrsString("small <big>BIG</big> small"));
        for (const h of ["left", "center", "right"]) {
            for (const v of ["top", "center", "bottom"]) {
                label.setValue("horizAlign", new BrsString(h));
                label.setValue("vertAlign", new BrsString(v));
                expect(() => label.renderNode(fakeInterpreter, [0, 0], 0, 1)).not.toThrow();
            }
        }
    });

    test("grows a line's height to make room for a larger inline span (baseline stacking)", () => {
        const small = SGNodeFactory.createNode("MultiStyleLabel");
        small.setValue("drawingStyles", drawingStyles({ default: { fontUri: "font:SmallSystemFont" } }));
        small.setValue("text", new BrsString("small text only"));
        const smallHeight = small.getMeasured().height;

        const big = SGNodeFactory.createNode("MultiStyleLabel");
        big.setValue("drawingStyles", drawingStyles({ default: { fontUri: "font:LargeSystemFont" } }));
        big.setValue("text", new BrsString("big text only"));
        const bigHeight = big.getMeasured().height;

        const mixed = SGNodeFactory.createNode("MultiStyleLabel");
        mixed.setValue(
            "drawingStyles",
            drawingStyles({ default: { fontUri: "font:SmallSystemFont" }, big: { fontUri: "font:LargeSystemFont" } })
        );
        mixed.setValue("text", new BrsString("small <big>BIG</big> small"));
        // A single line containing a larger span grows to that span's line height (so it has
        // room), rather than staying at the small base height.
        expect(bigHeight).toBeGreaterThan(smallHeight);
        expect(mixed.getMeasured().height).toBe(bigHeight);
    });

    test("ellipsizes a single line that overflows a fixed width", () => {
        const label = SGNodeFactory.createNode("MultiStyleLabel");
        label.setValue("drawingStyles", drawingStyles({ default: { fontUri: "font:MediumSystemFont" } }));
        label.setValue("width", new Int32(60));
        label.setValue("text", new BrsString("This text is far too long to ever fit in sixty pixels"));
        label.getMeasured();
        expect(label.getValueJS("isTextEllipsized")).toBe(true);
    });

    test("wraps text across multiple lines when wrap is true", () => {
        const label = SGNodeFactory.createNode("MultiStyleLabel");
        label.setValue("drawingStyles", drawingStyles({ default: { fontUri: "font:MediumSystemFont" } }));
        label.setValue("width", new Int32(120));
        label.setValue("wrap", BrsBoolean.True);
        label.setValue("text", new BrsString("one two three four five six seven eight nine ten"));
        const measured = label.getMeasured();
        // More than one line tall: total height exceeds a single line's height.
        const oneLine = SGNodeFactory.createNode("MultiStyleLabel");
        oneLine.setValue("drawingStyles", drawingStyles({ default: { fontUri: "font:MediumSystemFont" } }));
        oneLine.setValue("text", new BrsString("one"));
        expect(measured.height).toBeGreaterThan(oneLine.getMeasured().height);
    });

    /**
     * Regression (see Label.test.js): a detached, explicitly sized label queried with
     * boundingRect() during an active render pass must report its explicit size — getMeasured
     * keeps rectToParent/rectToScene in sync with rectLocal instead of leaving them at zero.
     */
    test("detached sized MultiStyleLabel reports its explicit size from boundingRect() mid-render", () => {
        const label = SGNodeFactory.createNode("MultiStyleLabel");
        label.setValue("drawingStyles", drawingStyles({ default: { fontUri: "font:MediumSystemFont" } }));
        label.setValue("width", new Int32(56));
        label.setValue("height", new Int32(56));

        sgRoot.rendering = true;
        try {
            const rect = label.getBoundingRect("toParent", fakeObserverInterpreter);
            expect(rect.width).toBe(56);
            expect(rect.height).toBe(56);
        } finally {
            sgRoot.rendering = false;
        }
    });
});
