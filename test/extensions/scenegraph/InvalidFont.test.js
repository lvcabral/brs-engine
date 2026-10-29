const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot, Node, getBrsValueFromFieldType } = scenegraph;
const { BrsDevice, BrsString, BrsBoolean, BrsInvalid, Float, Int32, Interpreter, RoArray, isInvalid } = core;

/** Minimal interpreter accepted by renderNode → renderChildren. */
const fakeInterpreter = {};

/**
 * Renders the node on a draw surface that records the drawn text and accepts every other draw call,
 * so nodes that also draw bitmaps and rectangles render end to end.
 */
function captureTexts(node) {
    const texts = [];
    const draw2D = new Proxy(
        {
            doDrawRotatedText(text) {
                if (text.trim() !== "") texts.push(text);
            },
        },
        { get: (target, prop) => target[prop] ?? (() => {}) }
    );
    node.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);
    return texts;
}

/** Calls the node's `setField()` method, which checks the value before storing it. */
function callSetField(node, field, value) {
    const interpreter = new Interpreter();
    const setField = node.getMethod("setfield");
    return interpreter.call(setField, [new BrsString(field), value], node.m, interpreter.location);
}

function contentTree(rows) {
    const root = SGNodeFactory.createNode("ContentNode");
    for (const row of rows) {
        const rowNode = SGNodeFactory.createNode("ContentNode");
        rowNode.setValue("title", new BrsString(row.title));
        for (const item of row.items ?? []) {
            const child = SGNodeFactory.createNode("ContentNode");
            child.setValue("title", new BrsString(item));
            rowNode.appendChildToParent(child);
        }
        root.appendChildToParent(rowNode);
    }
    return root;
}

function textNode(type, text) {
    const node = SGNodeFactory.createNode(type);
    node.setValue("text", new BrsString(text));
    if (type === "ScrollingLabel") node.setValue("maxWidth", new Float(1000));
    if (type === "ScrollableText") {
        node.setValue("width", new Float(500));
        node.setValue("height", new Float(200));
    }
    return node;
}

/** Values a device stores as invalid in a font field (see test/simulator/probes/font-invalid-probe). */
const invalidValues = [
    ["invalid", () => BrsInvalid.Instance],
    ["an unknown font: name", () => new BrsString("font:NoSuchFont")],
    ["a string without the font: prefix", () => new BrsString("garbage")],
    ["an empty string", () => new BrsString("")],
    ["a node that is not a Font", () => SGNodeFactory.createNode("Rectangle")],
];

describe("font fields holding a value that is not a Font", () => {
    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    test.each(invalidValues)("Label.font set to %s reads back invalid", (_name, value) => {
        const label = textNode("Label", "hello");
        label.setValue("font", new BrsString("font:LargeBoldSystemFont"));
        label.setValue("font", value());

        expect(isInvalid(label.getValue("font"))).toBe(true);
    });

    test.each(invalidValues)("setField() stores invalid for %s", (_name, value) => {
        const label = textNode("Label", "hello");
        label.setValue("font", new BrsString("font:LargeBoldSystemFont"));

        expect(callSetField(label, "font", value()).toBoolean()).toBe(true);
        expect(isInvalid(label.getValue("font"))).toBe(true);
    });

    test("setField() keeps the font on a type mismatch", () => {
        const label = textNode("Label", "hello");
        label.setValue("font", new BrsString("font:LargeBoldSystemFont"));
        callSetField(label, "font", new Int32(5));

        expect(label.getValue("font").getSize()).toBe(30);
    });

    // Node.setValue is the path for every node and thread (a Task writing a node it created runs here).
    test.each(invalidValues)("a font field on a plain Node set to %s reads back invalid", (_name, value) => {
        const node = new Node([], "Node");
        node.addNodeField("f", "font", false);
        node.setValue("f", new BrsString("font:LargeBoldSystemFont"));
        node.setValue("f", value());

        expect(isInvalid(node.getValue("f"))).toBe(true);
    });

    test.each([["garbage"], [""], ["font:NoSuchFont"], ["pkg:/fonts/missing.ttf"]])(
        "an XML font attribute of %j is invalid",
        (text) => {
            expect(isInvalid(getBrsValueFromFieldType("font", text))).toBe(true);
        }
    );

    test("a font field declared without a value gets the default font", () => {
        expect(getBrsValueFromFieldType("font").getSize()).toBeGreaterThan(0);
        expect(getBrsValueFromFieldType("font", "font:LargeBoldSystemFont").getSize()).toBe(30);
    });

    // A device draws no text with such a font and measures the label as 0x0; it does not fall back
    // to the default font.
    test.each(["Label", "MonospaceLabel", "ScrollingLabel", "ScrollableText"])(
        "%s draws no text when its font is invalid",
        (type) => {
            const node = textNode(type, "hello world");
            expect(captureTexts(node)).not.toEqual([]);

            node.setValue("font", BrsInvalid.Instance);
            expect(captureTexts(node)).toEqual([]);
        }
    );

    test("a wrapping Label draws no text when its font is invalid", () => {
        const label = textNode("Label", "the quick brown fox jumps over the lazy dog");
        label.setValue("wrap", BrsBoolean.True);
        label.setValue("width", new Float(120));
        label.setValue("font", new BrsString("font:NoSuchFont"));

        expect(captureTexts(label)).toEqual([]);
    });

    test("a later valid font draws again", () => {
        const label = textNode("Label", "hello");
        label.setValue("font", BrsInvalid.Instance);
        expect(captureTexts(label)).toEqual([]);

        label.setValue("font", new BrsString("font:SmallSystemFont"));
        expect(captureTexts(label)).toEqual(["hello"]);
    });

    test.each(["textFont", "focusedTextFont"])("Button draws no text when %s is invalid", (field) => {
        const button = textNode("Button", "press me");
        button.setValue(field, BrsInvalid.Instance);
        // The unfocused font is drawn first; focus the button to draw with focusedTextFont.
        if (field === "focusedTextFont") sgRoot.setFocused(button);

        expect(captureTexts(button)).not.toContain("press me");
    });

    test("ButtonGroup renders when its fonts are invalid", () => {
        const group = SGNodeFactory.createNode("ButtonGroup");
        group.setValue("buttons", new RoArray([new BrsString("One"), new BrsString("Two")]));
        group.setValue("textFont", BrsInvalid.Instance);
        group.setValue("focusedTextFont", BrsInvalid.Instance);

        expect(() => captureTexts(group)).not.toThrow();
    });

    function labeledRowList(font) {
        const rowList = SGNodeFactory.createNode("RowList");
        rowList.setValue("itemSize", new RoArray([new Float(500), new Float(100)]));
        rowList.setValue("rowItemSize", new RoArray([new RoArray([new Float(120), new Float(60)])]));
        rowList.setValue("showRowLabel", new RoArray([BrsBoolean.True]));
        rowList.setValue("rowLabelFont", font);
        rowList.setValue("content", contentTree([{ title: "Row Label", items: ["Cell 1", "Cell 2"] }]));
        return rowList;
    }

    // A device lays the row label out once: invalid from the start leaves no label and no label space.
    test("RowList with an invalid rowLabelFont from the start has no label and no label space", () => {
        const good = labeledRowList(new BrsString("font:LargeBoldSystemFont"));
        const bad = labeledRowList(BrsInvalid.Instance);

        expect(captureTexts(good)).toContain("Row Label");
        expect(good.titleHeight).toBeGreaterThan(0);
        expect(captureTexts(bad)).not.toContain("Row Label");
        expect(bad.titleHeight).toBe(0);
    });

    test("RowList keeps the row label font it was first laid out with", () => {
        const rowList = labeledRowList(new BrsString("font:LargeBoldSystemFont"));
        captureTexts(rowList);
        const height = rowList.titleHeight;

        rowList.setValue("rowLabelFont", BrsInvalid.Instance);
        expect(captureTexts(rowList)).toContain("Row Label");
        expect(rowList.titleHeight).toBe(height);
    });

    test("PosterGrid gives an invalid caption font no caption height", () => {
        const grid = SGNodeFactory.createNode("PosterGrid");
        grid.setValue("caption1NumLines", new Int32(1));
        grid.setValue("caption1Font", new BrsString("font:LargeBoldSystemFont"));
        const good = grid.computeCaptionMetrics(0).caption1Height;
        grid.setValue("caption1Font", BrsInvalid.Instance);

        expect(good).toBeGreaterThan(0);
        expect(grid.computeCaptionMetrics(0).caption1Height).toBe(0);
    });

    test.each([
        ["LabelList", "font"],
        ["LabelList", "focusedFont"],
        ["PosterGrid", "caption1Font"],
        ["PosterGrid", "caption2Font"],
        ["ZoomRowList", "rowTitleFont"],
        ["TimeGrid", "programTitleFont"],
    ])("%s renders with %s set to invalid", (type, field) => {
        const node = SGNodeFactory.createNode(type);
        node.setValue(field, BrsInvalid.Instance);
        node.setValue("content", contentTree([{ title: "Row Label", items: ["Cell 1", "Cell 2"] }]));
        if (type === "LabelList") sgRoot.setFocused(node);

        expect(() => captureTexts(node)).not.toThrow();
    });
});
