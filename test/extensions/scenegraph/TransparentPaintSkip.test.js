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

    test("a node faded out itself, under an opaque parent, is not painted either", () => {
        // The accumulated opacity the template receives has only the ANCESTORS' opacity folded in —
        // each renderNodeContent folds its own in later. Testing that value alone still painted a
        // node an app had faded out directly, which is the common single-widget fade.
        const { group, list, rect } = buildList();
        list.setValue("opacity", new Float(0));
        rect.setValue("opacity", new Float(0));
        const draw2D = recordingDraw2D();

        group.paintNode(interpreter, [0, 0], 0, 1, draw2D);

        expect(draw2D.calls).toHaveLength(0);
    });

    test("a transparent subtree contributes the same ancestor bounds as a layout pass", () => {
        // The skip degrades to a layout traversal rather than returning early: an early return would
        // union a rect the subtree never computed ({0,0,0,0} for a node faded out before its first
        // layout), inflating the parent's bounds toward that node's translation for every later frame.
        function build(opacity) {
            const parent = SGNodeFactory.createNode("Group");
            const shown = SGNodeFactory.createNode("Group");
            const near = SGNodeFactory.createNode("Rectangle");
            near.setValue("width", new Float(100));
            near.setValue("height", new Float(100));
            shown.appendChildToParent(near);
            shown.setValue("translation", new RoArray([new Float(300), new Float(300)]));
            const faded = SGNodeFactory.createNode("Group");
            const far = SGNodeFactory.createNode("Rectangle");
            far.setValue("width", new Float(100));
            far.setValue("height", new Float(100));
            faded.appendChildToParent(far);
            faded.setValue("translation", new RoArray([new Float(500), new Float(500)]));
            faded.setValue("opacity", new Float(opacity));
            parent.appendChildToParent(shown);
            parent.appendChildToParent(faded);
            return parent;
        }

        const painted = build(0);
        painted.paintNode(interpreter, [0, 0], 0, 1, recordingDraw2D());
        const laidOut = build(0);
        laidOut.layoutNode(interpreter, [0, 0], 0, 1);
        const opaque = build(1);
        opaque.paintNode(interpreter, [0, 0], 0, 1, recordingDraw2D());

        // A faded child is unioned by layout, so paint must union it identically — and identically to
        // the same tree with the child opaque. An early return gave width/height 200 here, not 300.
        expect(painted.rectToParent).toEqual(laidOut.rectToParent);
        expect(painted.rectToParent).toEqual(opaque.rectToParent);
        expect(painted.rectToParent.width).toBe(300);
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

    test("a transparent node and its descendants report renderTracking 'none'", () => {
        const { group, list, rect } = buildList();
        for (const node of [group, list, rect]) {
            node.setValue("enableRenderTracking", BrsBoolean.True);
        }
        group.setValue("opacity", new Float(0));
        const draw2D = recordingDraw2D();

        group.paintNode(interpreter, [0, 0], 0, 1, draw2D);

        // The reference puts opacity 0 in the same "none" bucket as visible = false. Because the skip
        // degrades to a traversal, every descendant reaches its own nodeRenderingDone and reports it —
        // an early return would have left theirs at whatever the last painted frame set.
        expect(group.getValueJS("renderTracking")).toBe("none");
        expect(list.getValueJS("renderTracking")).toBe("none");
        expect(rect.getValueJS("renderTracking")).toBe("none");
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
