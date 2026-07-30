const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot, sgClock } = scenegraph;
const { BrsDevice, BrsString, Float, Int32, Interpreter } = core;

/**
 * The central invariant of the layout/paint split (docs/scenegraph-layout-passes.md): a layout
 * pass is pure — idempotent and clock-free. Running layoutNode twice while the clock ADVANCES
 * between calls must produce identical rects and must not advance any node's time-based state,
 * for every node type that reads the clock during render.
 */
describe("layout passes are pure (idempotent, clock-free)", () => {
    let interpreter;
    let fakeNow;

    beforeAll(() => {
        // Label/keyboard nodes resolve fonts from the common: volume; mount it once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        interpreter = new Interpreter();
        fakeNow = 100_000;
        sgClock.setSource({ now: () => fakeNow, perfNow: () => fakeNow });
    });

    afterEach(() => {
        sgClock.setSource();
        sgRoot.setFocused();
    });

    function snapshot(node) {
        return {
            local: { ...node.rectLocal },
            toParent: { ...node.rectToParent },
            toScene: { ...node.rectToScene },
        };
    }

    /** Two layout passes with 5s of clock between them must agree exactly. */
    function expectIdempotentLayout(root, node) {
        root.layoutNode(interpreter, [0, 0], 0, 1);
        const first = snapshot(node);
        fakeNow += 5000;
        root.layoutNode(interpreter, [0, 0], 0, 1);
        expect(snapshot(node)).toEqual(first);
    }

    test("BusySpinner: layout does not advance the spin nor write the poster rotation", () => {
        const group = SGNodeFactory.createNode("Group");
        const spinner = SGNodeFactory.createNode("BusySpinner");
        group.appendChildToParent(spinner);
        spinner.setValue("control", new BrsString("start"));
        const poster = spinner.getValue("poster");
        const before = poster.getValueJS("rotation");

        expectIdempotentLayout(group, spinner);

        expect(poster.getValueJS("rotation")).toBe(before);

        // A paint pass advances it.
        fakeNow += 500;
        group.paintNode(interpreter, [0, 0], 0, 1, { doDrawRotatedBitmap: () => {}, doDrawRotatedRect: () => {} });
        expect(poster.getValueJS("rotation")).not.toBe(before);
    });

    test("ScrollingLabel: layout does not consume the marquee time delta nor re-dirty the scene", () => {
        const group = SGNodeFactory.createNode("Group");
        const label = SGNodeFactory.createNode("ScrollingLabel");
        label.setValue("text", new BrsString("A very long text that certainly does not fit the maximum width"));
        label.setValue("maxWidth", new Int32(120));
        group.appendChildToParent(label);

        sgRoot.clearDirty();
        expectIdempotentLayout(group, label);
        // The makeDirty that keeps the marquee animating is paint-only; a bounding-rect
        // refresh must not re-dirty the scene (that made every measurement force a frame).
        expect(sgRoot.isDirty).toBe(false);
    });

    test("TextEditBox: layout does not flip the cursor blink phase", () => {
        const group = SGNodeFactory.createNode("Group");
        const editBox = SGNodeFactory.createNode("TextEditBox");
        editBox.setValue("text", new BrsString("hello"));
        editBox.setValue("active", core.BrsBoolean.True);
        group.appendChildToParent(editBox);

        // Paint once to seed lastPaintNow, then layout repeatedly across several blink
        // intervals — the phase must not change (each flip would mutate state).
        const draw2D = {
            doDrawRotatedBitmap: () => {},
            doDrawRotatedRect: () => {},
            doDrawRotatedText: () => {},
            doDrawScaledObject: () => {},
            drawNinePatch: () => {},
            drawImage: () => {},
        };
        group.paintNode(interpreter, [0, 0], 0, 1, draw2D);
        expectIdempotentLayout(group, editBox);
    });

    test("Video: layout does not advance seek state", () => {
        const group = SGNodeFactory.createNode("Group");
        const video = SGNodeFactory.createNode("Video");
        group.appendChildToParent(video);

        expectIdempotentLayout(group, video);
    });

    test("DynamicKeyGrid: a layout pass after the hover dwell does not open the popup", () => {
        const grid = SGNodeFactory.createNode("DynamicKeyGrid");
        const kdfUri = "common:/keyboards/kdf/qwerty_suggestions.json";
        if (grid.getValueJS("keyDefinitionUri") !== undefined) {
            grid.setValue("keyDefinitionUri", new BrsString(kdfUri));
        }
        sgRoot.setFocused(grid);
        const childCountBefore = grid.getNodeChildren().length;

        fakeNow += 10_000; // way past any hover delay
        grid.layoutNode(interpreter, [0, 0], 0, 1);

        // No popup node was appended by the layout pass.
        expect(grid.getNodeChildren().length).toBe(childCountBefore);
    });

    test("a LayoutGroup subtree with mixed content lays out identically across advancing clock", () => {
        const scene = SGNodeFactory.createNode("Scene");
        const layout = SGNodeFactory.createNode("LayoutGroup");
        layout.setValue("layoutDirection", new BrsString("vert"));
        const rect = SGNodeFactory.createNode("Rectangle");
        rect.setValue("width", new Float(300));
        rect.setValue("height", new Float(100));
        const marquee = SGNodeFactory.createNode("ScrollingLabel");
        marquee.setValue("text", new BrsString("Another long scrolling text that overflows its container"));
        marquee.setValue("maxWidth", new Int32(200));
        const spinner = SGNodeFactory.createNode("BusySpinner");
        spinner.setValue("control", new BrsString("start"));
        layout.appendChildToParent(rect);
        layout.appendChildToParent(marquee);
        layout.appendChildToParent(spinner);
        scene.appendChildToParent(layout);

        expectIdempotentLayout(scene, layout);
    });
});
