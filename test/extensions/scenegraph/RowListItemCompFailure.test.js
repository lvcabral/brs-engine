const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Interpreter } = core;

function buildContent(rows) {
    const root = SGNodeFactory.createNode("ContentNode");
    for (const items of rows) {
        const rowNode = SGNodeFactory.createNode("ContentNode");
        for (const title of items) {
            const itemNode = SGNodeFactory.createNode("ContentNode");
            itemNode.setValue("title", new BrsString(title));
            rowNode.appendChildToParent(itemNode);
        }
        root.appendChildToParent(rowNode);
    }
    return root;
}

describe("RowList with an item component that cannot be created", () => {
    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
        jest.restoreAllMocks();
    });

    test("skips the slots and logs one error instead of crashing the render pass", () => {
        // Regression: when createItemComponent returned nothing (unresolvable itemComponentName),
        // renderRowItemComponent still dereferenced rowItemComps[row][col].renderNode — a TypeError
        // that killed the whole render pass mid-frame (everything after the RowList stopped drawing).
        const interpreter = new Interpreter();
        const list = SGNodeFactory.createNode("RowList");
        list.setValue("itemComponentName", new BrsString("NoSuchComponent"));
        list.setValue("itemSize", scenegraph.getBrsValueFromFieldType("vector2d", "[1280, 200]"));
        list.setValue(
            "content",
            buildContent([
                ["A", "B", "C"],
                ["D", "E"],
            ])
        );

        const errors = [];
        jest.spyOn(BrsDevice.stderr, "write").mockImplementation((msg) => errors.push(msg));

        expect(() => list.renderNode(interpreter, [0, 0], 0, 1)).not.toThrow();

        const failures = errors.filter((msg) => msg.includes("[sg.rowlist.create.fail]"));
        expect(failures).toHaveLength(1);
        expect(failures[0]).toContain("NoSuchComponent");
    });
});
