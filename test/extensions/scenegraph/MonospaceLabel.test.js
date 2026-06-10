const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, BrsBoolean, Float } = core;

/** Minimal interpreter accepted by renderNode → renderChildren (never dereferenced when draw2D is absent). */
const fakeInterpreter = {};

/** Renders the label with a stub draw surface, capturing each drawn glyph (text + position + color). */
function captureGlyphs(label, origin = [0, 0]) {
    const glyphs = [];
    const draw2D = {
        doDrawRotatedText(text, x, y, color, opacity, font, rotation) {
            glyphs.push({ text, x, y, color, rotation });
        },
    };
    label.renderNode(fakeInterpreter, origin, 0, 1, draw2D);
    return glyphs;
}

describe("MonospaceLabel node", () => {
    beforeAll(() => {
        // Fonts are resolved from the common: volume; mount it once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    test("is wired into the factory as a MonospaceLabel subtype", () => {
        const label = SGNodeFactory.createNode("MonospaceLabel");
        expect(label).toBeDefined();
        expect(label.constructor.name).toBe("MonospaceLabel");
        expect(label.nodeSubtype).toBe("MonospaceLabel");
    });

    test("exposes the documented default fields, types and values", () => {
        const label = SGNodeFactory.createNode("MonospaceLabel");
        const fields = label.getNodeFields();

        const expected = [
            ["text", "string", ""],
            ["color", "color", 0xddddddff | 0], // stored as a signed 32-bit int
            ["horizAlign", "string", "left"],
            ["vertAlign", "string", "top"],
            ["width", "float", 0],
            ["height", "float", 0],
            ["characterWidth", "float", 0],
            ["firstCharTrueLeftAlign", "boolean", false],
            ["ellipsizeOnBoundary", "boolean", false],
            ["isTextEllipsized", "boolean", false],
        ];
        for (const [name, type, value] of expected) {
            const field = fields.get(name.toLowerCase()); // the field map is keyed lowercase
            expect(field).toBeDefined();
            expect(field.getType()).toBe(type);
            expect(label.getValueJS(name)).toBe(value);
        }
    });

    test("extends Label (inherits Group fields)", () => {
        const label = SGNodeFactory.createNode("MonospaceLabel");
        const fields = label.getNodeFields();
        for (const groupField of ["translation", "opacity", "visible", "rotation", "font"]) {
            expect(fields.get(groupField.toLowerCase())).toBeDefined();
        }
    });

    test("spaces identical characters by exactly characterWidth", () => {
        const label = SGNodeFactory.createNode("MonospaceLabel");
        label.setValue("characterWidth", new Float(40));
        label.setValue("text", new BrsString("iiii"));
        const glyphs = captureGlyphs(label);

        expect(glyphs.map((g) => g.text)).toEqual(["i", "i", "i", "i"]);
        for (let i = 1; i < glyphs.length; i++) {
            expect(glyphs[i].x - glyphs[i - 1].x).toBeCloseTo(40, 5);
        }
    });

    test("falls back to the width of 'M' when characterWidth is zero", () => {
        const label = SGNodeFactory.createNode("MonospaceLabel");
        label.setValue("text", new BrsString("WWWW")); // identical chars => uniform centering offset
        const glyphs = captureGlyphs(label);

        expect(glyphs).toHaveLength(4);
        const cell = glyphs[1].x - glyphs[0].x;
        expect(cell).toBeGreaterThan(0);
        for (let i = 1; i < glyphs.length; i++) {
            expect(glyphs[i].x - glyphs[i - 1].x).toBeCloseTo(cell, 5);
        }
    });

    test("firstCharTrueLeftAlign left-aligns only the first character in its cell", () => {
        const label = SGNodeFactory.createNode("MonospaceLabel");
        label.setValue("characterWidth", new Float(60)); // wider than 'i' so centering offset is visible
        label.setValue("firstCharTrueLeftAlign", BrsBoolean.True);
        label.setValue("text", new BrsString("iii"));
        const glyphs = captureGlyphs(label);

        // First glyph sits at the cell's left edge (offset 0); the rest are centered.
        expect(glyphs[0].x).toBeCloseTo(0, 5);
        const firstDelta = glyphs[1].x - glyphs[0].x;
        const laterDelta = glyphs[2].x - glyphs[1].x;
        expect(laterDelta).toBeCloseTo(60, 5);
        expect(firstDelta).toBeGreaterThan(laterDelta);
    });

    test("ellipsizes by character when the text exceeds the width", () => {
        const label = SGNodeFactory.createNode("MonospaceLabel");
        label.setValue("characterWidth", new Float(40));
        label.setValue("width", new Float(240)); // 6 cells: keep 3 chars + "..."
        label.setValue("text", new BrsString("abcdefghij"));
        const glyphs = captureGlyphs(label);

        expect(label.getValueJS("isTextEllipsized")).toBe(true);
        expect(glyphs.map((g) => g.text).join("")).toBe("abc...");
    });

    test("ellipsizeOnBoundary trims back to a whole word", () => {
        const label = SGNodeFactory.createNode("MonospaceLabel");
        label.setValue("characterWidth", new Float(40));
        label.setValue("width", new Float(320)); // 8 cells: keep 5 chars + "..."

        label.setValue("ellipsizeOnBoundary", BrsBoolean.False);
        label.setValue("text", new BrsString("ab cdefghij"));
        expect(
            captureGlyphs(label)
                .map((g) => g.text)
                .join("")
        ).toBe("ab cd...");

        label.setValue("ellipsizeOnBoundary", BrsBoolean.True);
        expect(
            captureGlyphs(label)
                .map((g) => g.text)
                .join("")
        ).toBe("ab...");
    });

    test("horizAlign offsets the whole run within an oversized width", () => {
        const make = (align) => {
            const label = SGNodeFactory.createNode("MonospaceLabel");
            label.setValue("characterWidth", new Float(40));
            label.setValue("width", new Float(400));
            label.setValue("text", new BrsString("ab"));
            label.setValue("horizAlign", new BrsString(align));
            return captureGlyphs(label);
        };
        const left = make("left");
        const right = make("right");
        // Both runs share the same per-glyph centering, so the right-aligned run is shifted
        // by exactly the slack (width - 2 cells = 400 - 80 = 320).
        expect(right[0].x - left[0].x).toBeCloseTo(320, 5);
    });

    test("renders without a draw surface for every alignment", () => {
        const label = SGNodeFactory.createNode("MonospaceLabel");
        label.setValue("text", new BrsString("monospace"));
        label.setValue("width", new Float(200));
        label.setValue("height", new Float(80));
        for (const h of ["left", "center", "right"]) {
            for (const v of ["top", "center", "bottom"]) {
                label.setValue("horizAlign", new BrsString(h));
                label.setValue("vertAlign", new BrsString(v));
                expect(() => label.renderNode(fakeInterpreter, [0, 0], 0, 1)).not.toThrow();
            }
        }
    });
});
