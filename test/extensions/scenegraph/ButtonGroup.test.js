const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, BrsBoolean } = core;

/** Minimal interpreter accepted by renderNode → renderChildren (never dereferenced when draw2D is absent). */
const fakeInterpreter = {};

describe("ButtonGroup bounding rect", () => {
    beforeAll(() => {
        // ButtonGroup measures its buttons with fonts from the common: volume; mount it once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    test("reports its own measured width even when a child contributes no rect this pass", () => {
        // Regression: the group's bounding rect used to be built from `this.width` BEFORE refreshButtons
        // recomputed it, so on the first render it captured width=0. The child button's rect is normally
        // unioned in and hides this, but a custom button still mid-sizing (its background not yet drawn)
        // contributes nothing that pass — so the group's own width is the only source. With the stale 0,
        // an app centering via `(1920 - boundingRect().width) / 2` placed the group at ~960 (hard right).
        const group = SGNodeFactory.createNode("ButtonGroup");
        const button = SGNodeFactory.createNode("Button");
        button.setValue("text", new BrsString("Manual Login"));
        // Child draws nothing this pass -> no contribution to the parent's unioned bounding rect.
        button.setValue("visible", BrsBoolean.False);
        group.appendChildToParent(button);

        group.renderNode(fakeInterpreter, [0, 0], 0, 1);

        // boundingRect() returns rectToParent; it must reflect the group's measured button width, not 0.
        const rect = group.rectToParent;
        expect(rect.width).toBeGreaterThan(100);
        expect(rect.height).toBeGreaterThan(0);
        // Centering must not collapse to the far right (the bug placed it at ~960 on a 1920 screen).
        expect((1920 - rect.width) / 2).toBeLessThan(900);
    });
});
