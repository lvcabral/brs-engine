const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Float, RoArray } = core;

/** Minimal interpreter accepted by renderNode → renderChildren (never dereferenced when draw2D is absent). */
const fakeInterpreter = {};

/** Minimal fake interpreter accepted by getBoundingRect (mirrors Label.test.js). */
const fakeObserverInterpreter = { environment: {}, inSubEnv: () => {} };

/** A float vector for translation/scale-style fields. */
function vector(values) {
    return new RoArray(values.map((v) => new Float(v)));
}

/**
 * Regression: `scale` used to be a no-op on ScrollableText (it extends Group directly with its
 * own renderNodeContent/renderContent, bypassing Group.drawText's scale bracket and never calling
 * Group.applyScale for its bounding rect). Fixed by wrapping its text-line draw loop in
 * Group.withScale and folding scale into the rect passed to updateBoundingRects. The scrollbar
 * itself is deliberately NOT wrapped in the same bracket — its track/thumb bitmaps already go
 * through Group.drawImage, which independently applies this node's own scale to the bitmap
 * dimensions; nesting that inside another canvas-transform bracket would double-apply it.
 */
describe("ScrollableText node scale", () => {
    beforeAll(() => {
        // Fonts and the default scrollbar 9-patches are resolved from the common: volume.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    function scrollableText({ scale, translation = [0, 0], width = 200, height = 100 } = {}) {
        const node = SGNodeFactory.createNode("ScrollableText");
        node.setValue("font", new BrsString("font:MediumSystemFont"));
        node.setValue("translation", vector(translation));
        node.setValue("width", new Float(width));
        node.setValue("height", new Float(height));
        if (scale) node.setValue("scale", vector(scale));
        node.setValue("text", new BrsString("hello world, this is some scrollable text"));
        return node;
    }

    test("scale=[0,0] pushes a scale bracket once for the text block, around the node's own translation", () => {
        const node = scrollableText({ scale: [0, 0], translation: [10, 20] });
        const calls = [];
        const draw2D = {
            pushClip() {},
            popClip() {},
            pushScale(pivotX, pivotY, scaleX, scaleY) {
                calls.push(["push", pivotX, pivotY, scaleX, scaleY]);
                return true;
            },
            popScale() {
                calls.push(["pop"]);
            },
            doDrawRotatedText(text) {
                if (text.trim() !== "") calls.push(["draw", text]);
            },
            doDrawRotatedRect() {},
        };
        node.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

        expect(calls[0]).toEqual(["push", 10, 20, 0, 0]);
        expect(calls.some((c) => c[0] === "draw")).toBe(true);
        // The push/pop bracket around the text block closes before anything else runs.
        expect(calls[calls.findIndex((c) => c[0] === "pop")]).toEqual(["pop"]);
    });

    test("scale=[1,1] (default) never calls pushScale/popScale", () => {
        const node = scrollableText();
        const draw2D = {
            pushClip() {},
            popClip() {},
            doDrawRotatedText() {},
            doDrawRotatedRect() {},
        };
        expect(() => node.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D)).not.toThrow();
    });

    test("scale=[0,0] collapses the reported boundingRect", () => {
        const node = scrollableText({ scale: [0, 0], translation: [10, 20] });
        const draw2D = {
            pushClip() {},
            popClip() {},
            doDrawRotatedText() {},
            doDrawRotatedRect() {},
            pushScale() {
                return true;
            },
            popScale() {},
        };
        node.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D);

        const rect = node.getBoundingRect("toParent", fakeObserverInterpreter);
        expect(rect.width).toBe(0);
        expect(rect.height).toBe(0);
    });

    test("a narrow width that triggers the scrollbar still renders without throwing at scale=[0,0]", () => {
        // Wide enough text + narrow width forces computeLines/showScrollbar down the scrollbar path,
        // which calls Group.drawImage (its own, independent scale handling) — must not conflict with
        // the text block's withScale bracket.
        const node = scrollableText({ scale: [0, 0], width: 80, height: 40 });
        const draw2D = {
            pushClip() {},
            popClip() {},
            doDrawRotatedText() {},
            doDrawRotatedRect() {},
            drawNinePatch() {},
            pushScale() {
                return true;
            },
            popScale() {},
        };
        expect(() => node.renderNode(fakeInterpreter, [0, 0], 0, 1, draw2D)).not.toThrow();
    });
});
