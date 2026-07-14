const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Float, RoArray, Interpreter } = core;

/**
 * Regression: honoring the `clippingRect` field. On Roku, `clippingRect` (declared on Group and
 * inherited by every node, and auto-set by lists/grids) limits where a node and its children may
 * render — the mechanism a collapsing container (e.g. a side menu clipped to a narrow width) uses
 * to hide content that sits past its bounds. The field used to be a declared but ignored no-op, so
 * clipped-away UI drew anyway. It is now applied via IfDraw2D.pushClip/popClip.
 *
 * The rect is in the node's LOCAL coordinate system and must be translated to scene/screen space,
 * only applied on a real draw pass (draw2D present) so measurement passes stay unclipped.
 */
describe("clippingRect limits child rendering", () => {
    let interpreter;

    beforeAll(() => {
        // MarkupGrid font-typed defaults need the common: fonts; mount once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    function vector(values) {
        return new RoArray(values.map((v) => new Float(v)));
    }

    /** Records pushClip/popClip and rect draws so we can assert the clip bracket and its geometry. */
    function recordingDraw2D() {
        const clips = [];
        let depth = 0;
        let maxDepth = 0;
        return {
            clips,
            getMaxDepth: () => maxDepth,
            getDepth: () => depth,
            pushClip: (rect) => {
                clips.push({ ...rect });
                depth += 1;
                maxDepth = Math.max(maxDepth, depth);
            },
            popClip: () => {
                depth -= 1;
            },
            doDrawRotatedRect: () => {},
        };
    }

    /** Scene > Group(clippingRect) > Rectangle, with the group translated so we can check local→scene. */
    function buildClippedGroup(clippingRect, groupTranslation = [0, 0]) {
        const scene = SGNodeFactory.createNode("Scene");
        const group = SGNodeFactory.createNode("Group");
        if (groupTranslation) {
            group.setValue("translation", vector(groupTranslation));
        }
        if (clippingRect) {
            group.setValue("clippingRect", vector(clippingRect));
        }
        const rect = SGNodeFactory.createNode("Rectangle");
        rect.setValue("width", new Float(300));
        rect.setValue("height", new Float(100));
        group.appendChildToParent(rect);
        scene.appendChildToParent(group);
        return { scene, group, rect };
    }

    test("a non-empty clippingRect is pushed in scene coordinates around the children", () => {
        const { group } = buildClippedGroup([0, 0, 108, 1080], [40, 20]);
        const draw2D = recordingDraw2D();

        group.renderNode(interpreter, [0, 0], 0, 1, draw2D);

        // The local clip [0,0,108,1080] is offset by the group's translation [40,20].
        expect(draw2D.clips).toEqual([{ x: 40, y: 20, width: 108, height: 1080 }]);
        // The clip was pushed and popped (balanced): depth returned to 0.
        expect(draw2D.getDepth()).toBe(0);
        expect(draw2D.getMaxDepth()).toBe(1);
    });

    test("an empty clippingRect (default) pushes no clip", () => {
        const { group } = buildClippedGroup(null, [40, 20]);
        const draw2D = recordingDraw2D();

        group.renderNode(interpreter, [0, 0], 0, 1, draw2D);

        expect(draw2D.clips).toHaveLength(0);
        expect(draw2D.getMaxDepth()).toBe(0);
    });

    test("a zero-width clippingRect pushes no clip", () => {
        const { group } = buildClippedGroup([0, 0, 0, 1080]);
        const draw2D = recordingDraw2D();

        group.renderNode(interpreter, [0, 0], 0, 1, draw2D);

        expect(draw2D.clips).toHaveLength(0);
    });

    test("a measurement pass (no draw2D) is unaffected and still computes bounding rects", () => {
        const { group, rect } = buildClippedGroup([0, 0, 108, 1080], [40, 20]);

        // No draw target: nothing to clip, but the child must still be measured/laid out.
        const bounds = rect.getBoundingRect("toScene", interpreter);
        expect(bounds.width).toBe(300);
        expect(bounds.height).toBe(100);
        expect(group.getBoundingRect("toScene").width).toBe(300);
    });

    test("a MarkupGrid honors clippingRect around its content", () => {
        const scene = SGNodeFactory.createNode("Scene");
        const grid = SGNodeFactory.createNode("MarkupGrid");
        grid.setValue("translation", vector([50, 0]));
        grid.setValue("clippingRect", vector([0, 0, 108, 1080]));
        scene.appendChildToParent(grid);
        const draw2D = recordingDraw2D();

        grid.renderNode(interpreter, [0, 0], 0, 1, draw2D);

        expect(draw2D.clips).toEqual([{ x: 50, y: 0, width: 108, height: 1080 }]);
        expect(draw2D.getDepth()).toBe(0);
    });
});
