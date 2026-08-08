const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, BrsBoolean, Float, RoArray, Interpreter } = core;

/**
 * Regression: a subtree whose accumulated opacity is 0 used to do a FULL paint — every draw call
 * was issued and the subtree's invisibility depended entirely on the final globalAlpha write being
 * correct. Any lost alpha downstream (e.g. a blend color of 0x00000000, see BlendColorAlpha) then
 * painted a faded-out node at full strength over the visible screen. Apps commonly hide UI with
 * opacity = 0 rather than visible = false, so the paint must stop at the transparent node.
 *
 * The skip is PAINT-ONLY: layout keeps propagating opacity 0 so UI under a faded-out ancestor still
 * computes bounding rects (the same guarantee HiddenMeasure pins for visible = false).
 */
describe("a fully transparent subtree is not painted", () => {
    let interpreter;

    beforeAll(() => {
        // Grids resolve fonts and the focus/footprint 9-patches from the common: volume.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    /** Records every drawing call the SceneGraph nodes can make, so "painted nothing" is verifiable. */
    function recordingDraw2D() {
        const calls = [];
        const record = (name) => {
            return (...args) => {
                calls.push({ name, args });
            };
        };
        return {
            calls,
            doClearCanvas: record("doClearCanvas"),
            doDrawClearedRect: record("doDrawClearedRect"),
            doDrawCroppedBitmap: record("doDrawCroppedBitmap"),
            doDrawRotatedBitmap: record("doDrawRotatedBitmap"),
            doDrawRotatedRect: record("doDrawRotatedRect"),
            doDrawRotatedText: record("doDrawRotatedText"),
            doDrawScaledObject: record("doDrawScaledObject"),
            drawNinePatch: record("drawNinePatch"),
            pushClip: () => {},
            popClip: () => {},
            resetClips: () => {},
        };
    }

    /**
     * Scene > Group > LabelList (two items) — an unfocused list, which is the case that draws the
     * focus FOOTPRINT 9-patch, plus a Rectangle sibling inside the group so a second draw kind is
     * covered. LabelList renders its own items (no itemComponentName needed).
     */
    function buildList() {
        const scene = SGNodeFactory.createNode("Scene");
        const group = SGNodeFactory.createNode("Group");
        const list = SGNodeFactory.createNode("LabelList");
        const rect = SGNodeFactory.createNode("Rectangle");
        rect.setValue("width", new Float(100));
        rect.setValue("height", new Float(50));

        const content = SGNodeFactory.createNode("ContentNode");
        for (const title of ["A", "B"]) {
            const item = SGNodeFactory.createNode("ContentNode");
            item.setValue("title", new BrsString(title));
            content.appendChildToParent(item);
        }
        list.setValue("content", content);

        group.appendChildToParent(list);
        group.appendChildToParent(rect);
        scene.appendChildToParent(group);
        return { scene, group, list, rect };
    }

    test("an opacity-0 ancestor stops the paint: no draw calls at all", () => {
        const { group } = buildList();
        group.setValue("opacity", new Float(0));
        const draw2D = recordingDraw2D();

        group.paintNode(interpreter, [0, 0], 0, 1, draw2D);

        // Used to issue the list's footprint drawNinePatch, its item text and the sibling rectangle,
        // all relying on globalAlpha to stay invisible.
        expect(draw2D.calls).toHaveLength(0);
    });

    test("the same tree at full opacity still paints the footprint frame", () => {
        const { group } = buildList();
        const draw2D = recordingDraw2D();

        group.paintNode(interpreter, [0, 0], 0, 1, draw2D);

        // Pins that the guard is opacity-0 only, and that this tree really does draw a footprint.
        expect(draw2D.calls.some((call) => call.name === "drawNinePatch")).toBe(true);
        expect(draw2D.calls.some((call) => call.name === "doDrawRotatedRect")).toBe(true);
    });

    test("an accumulated opacity of 0 stops the paint even when the node's own opacity is 1", () => {
        const { group, list } = buildList();
        group.setValue("opacity", new Float(0.5));
        const draw2D = recordingDraw2D();

        // The parent contributes 0 to the accumulated opacity handed to the group.
        group.paintNode(interpreter, [0, 0], 0, 0, draw2D);

        expect(draw2D.calls).toHaveLength(0);
        expect(list.getValueJS("opacity")).toBe(1);
    });

    test("layout still runs under an opacity-0 ancestor, so boundingRect() is unaffected", () => {
        const transparent = buildList();
        transparent.group.setValue("opacity", new Float(0));
        transparent.group.setValue("translation", new RoArray([new Float(40), new Float(60)]));
        const opaque = buildList();
        opaque.group.setValue("translation", new RoArray([new Float(40), new Float(60)]));

        const hiddenRect = transparent.list.getBoundingRect("toScene", interpreter);
        const shownRect = opaque.list.getBoundingRect("toScene", interpreter);

        // The paint skip must not reach the layout pass: a faded-out list measures exactly like the
        // shown one (apps size and position UI from boundingRect() before revealing it).
        expect(hiddenRect.width).toBeGreaterThan(0);
        expect(hiddenRect.height).toBeGreaterThan(0);
        expect(hiddenRect).toEqual(shownRect);
    });

    test("a transparent node reports renderTracking 'none'", () => {
        const { group } = buildList();
        group.setValue("enableRenderTracking", BrsBoolean.True);
        group.setValue("opacity", new Float(0));
        const draw2D = recordingDraw2D();

        group.paintNode(interpreter, [0, 0], 0, 1, draw2D);

        // The reference puts opacity 0 in the same "none" bucket as visible = false.
        expect(group.getValueJS("renderTracking")).toBe("none");
    });

    test("a revealed subtree paints again on the next frame", () => {
        const { group } = buildList();
        group.setValue("opacity", new Float(0));
        group.paintNode(interpreter, [0, 0], 0, 1, recordingDraw2D());

        group.setValue("opacity", new Float(1));
        const draw2D = recordingDraw2D();
        group.paintNode(interpreter, [0, 0], 0, 1, draw2D);

        // isDirty is deliberately left set by the skip, so nothing stays frozen after a reveal.
        expect(draw2D.calls.some((call) => call.name === "drawNinePatch")).toBe(true);
    });
});
