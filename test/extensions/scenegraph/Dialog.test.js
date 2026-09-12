const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, BrsBoolean, RoArray } = core;

/** Wraps a JS string array as an RoArray of BrsString (the stringarray field shape). */
function stringArray(values) {
    return new RoArray(values.map((v) => new BrsString(v)));
}

/** Minimal interpreter accepted by renderNode → renderChildren (never dereferenced when draw2D is absent). */
const fakeInterpreter = {};

describe("Dialog", () => {
    beforeAll(() => {
        // The dialog's default fonts need the common: fonts; mount the common volume once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    test("closing restores focus through the real focus-chain commit, not just the live pointer", () => {
        const scene = SGNodeFactory.createNode("Group");
        const list = SGNodeFactory.createNode("Group");
        list.setValue("focusable", BrsBoolean.True);
        scene.appendChildToParent(list);
        list.setNodeFocus(true);
        expect(sgRoot.focused).toBe(list);

        const dialog = SGNodeFactory.createNode("Dialog");
        dialog.setValue("buttons", stringArray(["OK", "Cancel"]));
        scene.appendChildToParent(dialog);

        // Rendering lays the dialog out and grabs focus into its button row.
        dialog.renderNode(fakeInterpreter, [0, 0], 0, 1);
        expect(sgRoot.focused).not.toBe(list);

        dialog.setValue("close", BrsBoolean.True);

        expect(dialog.getValueJS("wasClosed")).toBe(true);
        expect(sgRoot.focused).toBe(list);
        // The chain must be properly committed (ancestor focusedChild pointers rewritten), not just
        // the raw sgRoot.focused pointer moved. getValue (not getValueJS, which unwraps nodes into
        // plain JS objects) preserves node identity for this comparison.
        expect(scene.getValue("focusedChild")).toBe(list);
        expect(list.getValue("focusedChild")).toBe(list);
    });
});
