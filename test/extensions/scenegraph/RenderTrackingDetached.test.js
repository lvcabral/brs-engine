const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsBoolean, BrsString, Float, RoArray, RoMessagePort, Interpreter } = core;

/** Port observers never enter inSubEnv; the shape only has to exist. */
const fakeInterpreter = { environment: {}, inSubEnv: () => {} };

/**
 * renderTracking only reflects what the displayed scene renders. Device trace:
 * test/simulator/probes/render-tracking-detached-probe/device-trace-os16.1.txt.
 *
 * A component that measures its own label before its owner appends it (a button sizing itself
 * from an observer, then waiting for renderTracking "full" to signal it is ready) must still see
 * the "none" -> "full" change on its first real frame.
 */
describe("renderTracking of nodes outside the displayed scene", () => {
    let interpreter;
    let scene;

    beforeAll(() => {
        // StandardDialog resolves its fonts and 9-patches from the common: volume.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        interpreter = new Interpreter();
        scene = SGNodeFactory.createNode("Scene");
        sgRoot.setScene(scene);
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    function drawStub() {
        const noop = () => {};
        return {
            doClearCanvas: noop,
            doDrawClearedRect: noop,
            doDrawCroppedBitmap: noop,
            doDrawRotatedBitmap: noop,
            doDrawRotatedRect: noop,
            doDrawRotatedText: noop,
            doDrawScaledObject: noop,
            drawNinePatch: noop,
            pushClip: noop,
            popClip: noop,
            resetClips: noop,
        };
    }

    function trackedGroup() {
        const group = SGNodeFactory.createNode("Group");
        group.setValue("translation", new RoArray([new Float(100), new Float(100)]));
        const rect = SGNodeFactory.createNode("Rectangle");
        rect.setValue("width", new Float(80));
        rect.setValue("height", new Float(24));
        group.appendChildToParent(rect);
        group.setValue("enableRenderTracking", BrsBoolean.True);
        return { group, rect };
    }

    /** One frame, in RoSGScreen's order: scene, current dialog, then removed subtrees. */
    function paint() {
        scene.paintNode(interpreter, [0, 0], 0, 1, drawStub());
        scene.dialog?.paintNode(interpreter, [0, 0], 0, 1, drawStub());
        sgRoot.flushDetachedTracking();
    }

    test("enabling tracking reports none, disabling reports disabled", () => {
        const { group } = trackedGroup();
        expect(group.getValueJS("renderTracking")).toBe("none");

        group.setValue("enableRenderTracking", BrsBoolean.False);
        expect(group.getValueJS("renderTracking")).toBe("disabled");
    });

    test("measuring a detached node or its child leaves it at none", () => {
        const { group, rect } = trackedGroup();

        rect.getBoundingRect("local", interpreter);
        expect(group.getValueJS("renderTracking")).toBe("none");
        const rectToParent = group.getBoundingRect("toParent", interpreter);
        expect(rectToParent.width).toBe(80);
        expect(group.getValueJS("renderTracking")).toBe("none");
    });

    test("a node measured while detached reports full on its first rendered frame", () => {
        const { group, rect } = trackedGroup();
        rect.getBoundingRect("local", interpreter);

        scene.appendChildToParent(group);
        expect(group.getValueJS("renderTracking")).toBe("none");
        paint();
        expect(group.getValueJS("renderTracking")).toBe("full");
    });

    test("measuring an attached node before its first frame leaves it at none (probe case F)", () => {
        const { group, rect } = trackedGroup();
        scene.appendChildToParent(group);

        group.getBoundingRect("toParent", interpreter);
        rect.getBoundingRect("local", interpreter);
        expect(group.getValueJS("renderTracking")).toBe("none");
        paint();
        expect(group.getValueJS("renderTracking")).toBe("full");
    });

    test("enableRenderTracking observers read the updated status (probe case G)", () => {
        const group = SGNodeFactory.createNode("Group");
        const port = new RoMessagePort();
        const seen = [];
        port.pushMessage = () => {
            seen.push(group.getValueJS("renderTracking"));
        };
        group.addObserver(fakeInterpreter, "unscoped", new BrsString("enableRenderTracking"), port);

        group.setValue("enableRenderTracking", BrsBoolean.True);
        group.setValue("enableRenderTracking", BrsBoolean.False);
        expect(seen).toEqual(["none", "disabled"]);
    });

    test("a rendered node removed from the scene reports none on the next frame", () => {
        const { group } = trackedGroup();
        scene.appendChildToParent(group);
        paint();
        expect(group.getValueJS("renderTracking")).toBe("full");

        scene.removeChildrenAtIndex(0, 1);
        expect(group.getValueJS("renderTracking")).toBe("full");
        paint();
        expect(group.getValueJS("renderTracking")).toBe("none");
        group.getBoundingRect("toParent", interpreter);
        expect(group.getValueJS("renderTracking")).toBe("none");
    });

    test("a node removed and re-attached before the next frame keeps its tracking", () => {
        const { group } = trackedGroup();
        scene.appendChildToParent(group);
        paint();

        scene.removeChildrenAtIndex(0, 1);
        scene.appendChildToParent(group);
        paint();
        expect(group.getValueJS("renderTracking")).toBe("full");
    });

    test("enabling tracking on a Task thread reports none there too (probe case T)", () => {
        sgRoot.setCurrentThread(1);
        try {
            const group = SGNodeFactory.createNode("Group");
            group.setValue("enableRenderTracking", BrsBoolean.True);
            expect(group.getValueJS("renderTracking")).toBe("none");
        } finally {
            sgRoot.setCurrentThread(0);
        }
    });

    test("a node that enabled tracking elsewhere reports none after removal (probe case T)", () => {
        // A Task-built node arrives through the Serializer, which writes fields silently, so no
        // render-thread setValue has announced that tracking is in use.
        sgRoot.renderTrackingUsed = false;
        const group = SGNodeFactory.createNode("Group");
        const rect = SGNodeFactory.createNode("Rectangle");
        rect.setValue("width", new Float(80));
        rect.setValue("height", new Float(24));
        group.appendChildToParent(rect);
        group.setValueSilent("enableRenderTracking", BrsBoolean.True);
        scene.appendChildToParent(group);
        paint();
        expect(group.getValueJS("renderTracking")).toBe("full");

        scene.removeChildrenAtIndex(0, 1);
        paint();
        expect(group.getValueJS("renderTracking")).toBe("none");
    });

    test("a node whose parent is hidden reports none on the next frame (probe case I)", () => {
        const { group, rect } = trackedGroup();
        rect.setValue("enableRenderTracking", BrsBoolean.True);
        scene.appendChildToParent(group);
        paint();
        expect(rect.getValueJS("renderTracking")).toBe("full");

        group.setValue("visible", BrsBoolean.False);
        expect(rect.getValueJS("renderTracking")).toBe("full");
        paint();
        expect(group.getValueJS("renderTracking")).toBe("none");
        expect(rect.getValueJS("renderTracking")).toBe("none");

        group.setValue("visible", BrsBoolean.True);
        paint();
        expect(rect.getValueJS("renderTracking")).toBe("full");
    });

    test("a closed dialog and its children report none on the next frame (probe case H)", () => {
        const dialog = SGNodeFactory.createNode("StandardMessageDialog");
        dialog.setValue("title", new BrsString("Probe"));
        dialog.setValue("enableRenderTracking", BrsBoolean.True);
        const child = SGNodeFactory.createNode("Rectangle");
        child.setValue("width", new Float(40));
        child.setValue("height", new Float(40));
        child.setValue("enableRenderTracking", BrsBoolean.True);
        dialog.appendChildToParent(child);
        dialog.setNodeParent(scene);
        scene.dialog = dialog;
        paint();
        expect(dialog.getValueJS("renderTracking")).toBe("full");
        expect(child.getValueJS("renderTracking")).toBe("full");

        dialog.setValue("close", BrsBoolean.True);
        paint();
        expect(dialog.getValueJS("renderTracking")).toBe("none");
        expect(child.getValueJS("renderTracking")).toBe("none");
    });

    test("removal only resets Groups, not a custom renderTracking field on a plain Node", () => {
        const { group } = trackedGroup();
        const data = SGNodeFactory.createNode("Node");
        data.addNodeField("renderTracking", "string", false);
        data.setValue("renderTracking", new BrsString("full"));
        group.appendChildToParent(data);
        scene.appendChildToParent(group);
        paint();

        scene.removeChildrenAtIndex(0, 1);
        paint();
        expect(group.getValueJS("renderTracking")).toBe("none");
        expect(data.getValueJS("renderTracking")).toBe("full");
    });
});
