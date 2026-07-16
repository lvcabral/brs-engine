const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { RowList, ZoomRowList, MarkupGrid } = scenegraph;
const { BrsDevice, BrsString } = core;

describe("ArrayGrid scrollingStatus field", () => {
    beforeAll(() => {
        // List/grid nodes have font-typed defaults; mount the common: volume once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    test("is present (default false) on ArrayGrid-derived list and grid nodes", () => {
        // Documented under ZoomRowList but present on all ArrayGrid-derived nodes on a real
        // device — apps alias it on plain RowList, and an unresolvable alias target aborts the
        // component's remaining <interface> fields, cascading into missing-field errors.
        for (const NodeType of [RowList, ZoomRowList, MarkupGrid]) {
            const node = new NodeType();
            expect(node.hasNodeField("scrollingstatus")).toBe(true);
            expect(node.getValueJS("scrollingStatus")).toBe(false);
        }
    });
});

describe("ArrayGrid numColumns/numRows string coercion", () => {
    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    // Settings looked up from the registry come back as strings (e.g. "7"), and apps assign
    // them straight to the integer numColumns/numRows fields. The field coerces the string,
    // but the internal layout cache (this.numCols/this.numRows) must track that too, or the
    // grid keeps rendering the XML-default column count.
    test("caches a numeric string assigned to numColumns/numRows on MarkupGrid", () => {
        const node = new MarkupGrid();

        node.setValue("numColumns", new BrsString("7"));
        node.setValue("numRows", new BrsString("3"));

        // The field itself coerced the string to an integer (matches Roku).
        expect(node.getValueJS("numColumns")).toBe(7);
        expect(node.getValueJS("numRows")).toBe(3);

        // The layout cache the render loop actually reads must match the field.
        expect(node.numCols).toBe(7);
        expect(node.numRows).toBe(3);
    });
});
