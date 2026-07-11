const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { RowList, ZoomRowList, MarkupGrid } = scenegraph;
const { BrsDevice } = core;

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
