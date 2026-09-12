const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, Poster, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Float, Int32, IfDraw2D, RoArray, RoAssociativeArray, RoBitmap } = core;

/** Mounts the common: volume (fonts, 9-patch/plain images) that Poster loads its bitmaps from. */
function mountCommonVolume() {
    const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
    BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
}

function scratchBitmap(size = 40) {
    const fields = [
        { name: new BrsString("width"), value: new Int32(size) },
        { name: new BrsString("height"), value: new Int32(size) },
    ];
    return new RoBitmap(new RoAssociativeArray(fields));
}

/**
 * Roku OS 16.0: the Poster ArrayGrid draws its focus indicator with is now a public
 * `focusFeedbackPoster` field, so an app can apply an Effect (rounded/asymmetric corners) to it —
 * see the release notes example under `external/dev-doc/docs/DEVELOPER/release-notes/index.md`.
 */
describe("ArrayGrid.focusFeedbackPoster (Roku OS 16.0)", () => {
    beforeAll(mountCommonVolume);

    afterEach(() => {
        sgRoot.setFocused();
    });

    test("defaults to a real Poster instance, not invalid, matching a device using it internally already", () => {
        const grid = SGNodeFactory.createNode("MarkupGrid");
        expect(grid.getValue("focusFeedbackPoster")).toBeInstanceOf(Poster);
    });

    test("an Effect assigned to focusFeedbackPoster rounds the drawn focus indicator's corners", () => {
        const grid = SGNodeFactory.createNode("MarkupGrid");
        // A plain (non-9-patch) bitmap: drawNinePatch bypasses none of the rounded clip, but a plain
        // scaled draw exercises the same `applyNodeEffect` path Poster/Rectangle already use.
        grid.setValue("focusBitmapUri", new BrsString("common:/images/icon_options.png"));
        const effect = SGNodeFactory.createNode("Effect");
        effect.setValue("borderRadius", new RoArray([new Float(18)]));
        grid.getValue("focusFeedbackPoster").setValue("effect", effect);

        const target = scratchBitmap(40);
        const draw2D = new IfDraw2D(target);
        grid.renderFocus({ x: 0, y: 0, width: 40, height: 40 }, 1, true, draw2D);

        const corner = Array.from(target.getContext().getImageData(0, 0, 1, 1).data);
        const center = Array.from(target.getContext().getImageData(20, 20, 1, 1).data);
        expect(corner[3]).toBe(0); // clipped transparent by the rounded corner
        expect(center[3]).toBeGreaterThan(0); // untouched away from the corner
    });

    test("swapping in an app-assigned Poster is what renderFocus draws", () => {
        const grid = SGNodeFactory.createNode("MarkupGrid");
        grid.setValue("focusBitmapUri", new BrsString("common:/images/icon_options.png"));

        const customPoster = SGNodeFactory.createNode("Poster");
        grid.setValue("focusFeedbackPoster", customPoster);
        expect(grid.getValue("focusFeedbackPoster")).toBe(customPoster);

        const effect = SGNodeFactory.createNode("Effect");
        effect.setValue("borderRadius", new RoArray([new Float(18)]));
        customPoster.setValue("effect", effect);

        const target = scratchBitmap(40);
        const draw2D = new IfDraw2D(target);
        grid.renderFocus({ x: 0, y: 0, width: 40, height: 40 }, 1, true, draw2D);

        const corner = Array.from(target.getContext().getImageData(0, 0, 1, 1).data);
        expect(corner[3]).toBe(0);
        expect(customPoster.getValueJS("loadStatus")).toBe("ready");
    });

    /**
     * Regression: `renderFocus` used to draw through a private `this.focusFeedbackPoster` cache set
     * only in the constructor. `Node.cloneNode` copies a node-valued field by ALIASING the same node
     * (device-confirmed: only children are deep-copied) while still running the clone's own
     * constructor, which used to create a fresh, unrelated default Poster and cache it privately —
     * leaving the clone's private cache and its (aliased) field pointing at two different Posters.
     */
    test("Clone() renders with the field's (aliased) Poster, not a fresh default from its own constructor", () => {
        const grid = SGNodeFactory.createNode("MarkupGrid");
        grid.setValue("focusBitmapUri", new BrsString("common:/images/icon_options.png"));
        const effect = SGNodeFactory.createNode("Effect");
        effect.setValue("borderRadius", new RoArray([new Float(18)]));
        grid.getValue("focusFeedbackPoster").setValue("effect", effect);

        const clone = grid.cloneNode(false);
        expect(clone.getValue("focusFeedbackPoster")).toBe(grid.getValue("focusFeedbackPoster"));

        const target = scratchBitmap(40);
        const draw2D = new IfDraw2D(target);
        clone.renderFocus({ x: 0, y: 0, width: 40, height: 40 }, 1, true, draw2D);

        const corner = Array.from(target.getContext().getImageData(0, 0, 1, 1).data);
        expect(corner[3]).toBe(0);
    });
});
