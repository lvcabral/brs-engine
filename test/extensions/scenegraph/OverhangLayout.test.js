const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Float, RoArray, Interpreter } = core;

const vector = (values) => new RoArray(values.map((v) => new Float(v)));

/**
 * Every node positions its own drawing through `Group.getDrawTranslation` — that is what keeps a
 * node's clippingRect, its paint position and its reported rect from drifting apart (see the
 * rendering contract in `.claude/docs/scenegraph-invariants.md`).
 *
 * `Overhang` was the one node that did not: it built its draw rect from `origin` alone and passed
 * `origin` straight to its children, ignoring its own `translation`. A translated Overhang therefore
 * painted in the wrong place, and its reported rect (which came from the node translation) disagreed
 * with where it actually drew.
 */
describe("Overhang honors its own translation", () => {
    let interpreter;

    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    test("a translated Overhang reports its translation", () => {
        const overhang = SGNodeFactory.createNode("Overhang");
        overhang.setValue("translation", vector([30, 40]));

        overhang.renderNode(interpreter, [0, 0], 0, 1);

        // Before the fix this reported {0, 0}: the draw rect was built from `origin` alone, and
        // rectToParent now derives from that draw rect.
        const rect = overhang.getBoundingRect("toParent", interpreter);
        expect(Math.round(rect.x)).toBe(30);
        expect(Math.round(rect.y)).toBe(40);
    });

    test("an untranslated Overhang is unchanged", () => {
        const overhang = SGNodeFactory.createNode("Overhang");
        overhang.renderNode(interpreter, [0, 0], 0, 1);
        const rect = overhang.getBoundingRect("toParent", interpreter);
        expect(Math.round(rect.x)).toBe(0);
        expect(Math.round(rect.y)).toBe(0);
    });
});

/**
 * Regression for the default logo overlapping the title/separator when the simulated device's
 * display mode (BrsDevice.getDisplayMode()) disagrees with the scene's resolution (here: an app
 * that never declares `ui_resolutions=fhd`, so the scene stays HD, run on a device in 1080p).
 *
 * Poster.loadUri() used to bake `bitmapWidth` from `scaleToResolution()` (a resolution-mismatch
 * scale factor) on the logo's very first synchronous load, then Overhang set `noScaling = true`
 * only afterward — too late to affect that already-baked value. At render time `noScaling` made
 * the logo draw at its true native pixel size while `alignChildren()` positioned the divider/title
 * off the stale, incorrectly-scaled `bitmapWidth`, so they landed inside the actually-wider logo.
 */
describe("Overhang default logo does not overlap the divider/title on a resolution-mismatched device", () => {
    let interpreter;
    let originalDisplayMode;

    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
        originalDisplayMode = BrsDevice.deviceInfo.displayMode;
    });

    afterAll(() => {
        BrsDevice.setDeviceInfo({ displayMode: originalDisplayMode });
    });

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    test("logo bitmapWidth matches its native asset size and the divider clears it", () => {
        BrsDevice.setDeviceInfo({ displayMode: "1080p" });

        const overhang = SGNodeFactory.createNode("Overhang");
        overhang.setValue("title", new BrsString("Title"));
        overhang.renderNode(interpreter, [0, 0], 0, 1);

        const [, , logo, leftDivider] = overhang.getNodeChildren();
        const logoX = logo.getValueJS("translation")[0];
        const logoWidth = logo.getValueJS("bitmapWidth");
        const dividerX = leftDivider.getValueJS("translation")[0];

        // The HD default logo asset is 90px wide; a resolution mismatch used to scale this to 60.
        expect(logoWidth).toBe(90);
        expect(dividerX).toBeGreaterThanOrEqual(logoX + logoWidth);
    });
});
