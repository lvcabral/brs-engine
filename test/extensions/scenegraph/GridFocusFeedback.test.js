const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Float, Int32, Interpreter, RoArray } = core;

describe("ArrayGrid focus feedback rendering", () => {
    let interpreter;

    beforeAll(() => {
        // The default focus bitmap (common:/images/focus_grid.9.png) lives in the common: volume.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    test("tints the focus bitmap with focusBitmapBlendColor and hugs the item via 9-patch margins", () => {
        const grid = SGNodeFactory.createNode("RowList"); // sets focusBitmapUri=focus_grid.9.png, hasNinePatch
        const purple = 0x7b2ff7ff | 0;
        grid.setValue("focusBitmapBlendColor", new Int32(purple));

        // Record the 9-patch draw (focusRect + blend color). drawImage routes 9-patch draws here.
        const calls = [];
        const draw2D = {
            drawNinePatch: (bmp, rect, rgba, opacity) => calls.push({ rect: { ...rect }, rgba }),
        };

        const itemRect = { x: 100, y: 100, width: 300, height: 300 };
        grid.renderFocus(itemRect, 1, true, draw2D);

        expect(calls).toHaveLength(1);
        // Color: the purple blend color must reach the draw call (it used to be dropped → white).
        expect(calls[0].rgba).toBe(grid.getValueJS("focusBitmapBlendColor"));
        // Gap: the frame is inset by the 9-patch content margins (19px), not the larger marginX/Y.
        expect(calls[0].rect.x).toBe(81);
        expect(calls[0].rect.y).toBe(81);
        expect(calls[0].rect.width).toBe(338);
        expect(calls[0].rect.height).toBe(338);
    });

    // PosterGrid specializes its focus GEOMETRY (the frame tracks the poster, not the whole cell). It used
    // to do that by overriding renderFocus wholesale, which dropped the blend color — making both blend
    // fields silent no-ops on this type — and the base's hasNinePatch write. It now overrides only
    // focusFrameRect, so the shared scaffolding cannot be dropped again.
    test.each([
        ["focused", true, "focusBitmapBlendColor"],
        ["unfocused", false, "focusFootprintBlendColor"],
    ])("PosterGrid honors the %s blend color through the shared renderFocus", (_label, nodeFocus, blendField) => {
        const grid = SGNodeFactory.createNode("PosterGrid");
        const purple = 0x7b2ff7ff | 0;
        grid.setValue(blendField, new Int32(purple));

        const calls = [];
        const draw2D = {
            drawNinePatch: (bmp, rect, rgba) => calls.push({ rect: { ...rect }, rgba }),
        };

        grid.renderFocus({ x: 100, y: 100, width: 300, height: 300 }, 1, nodeFocus, draw2D);

        expect(calls).toHaveLength(1);
        expect(calls[0].rgba).toBe(purple);
    });

    test("PosterGrid records hasNinePatch from the drawn frame, like every other grid", () => {
        // The old override omitted this write. Harmless on PosterGrid today only because it also overrides
        // rectMargins(), the sole reader — a coupling no subclass should have to know about.
        const grid = SGNodeFactory.createNode("PosterGrid");
        grid.hasNinePatch = false;

        grid.renderFocus({ x: 0, y: 0, width: 300, height: 300 }, 1, true, { drawNinePatch: () => {} });

        expect(grid.hasNinePatch).toBe(true);
    });

    test("PosterGrid outsets its focus frame by its own constants, not the 9-patch content margins", () => {
        // The outset is device-measured (marginY + focusPadding*), NOT the 19px content margins the base
        // reads off the 9-patch. This pins that PosterGrid's geometry stays ungated on bmp.ninePatch and is
        // not "unified" with the base's focusMargins path — the two are deliberately different.
        const grid = SGNodeFactory.createNode("PosterGrid");
        const calls = [];
        const draw2D = { drawNinePatch: (bmp, rect) => calls.push({ ...rect }) };
        const itemRect = { x: 100, y: 100, width: 300, height: 300 };

        grid.renderFocus(itemRect, 1, true, draw2D);

        expect(calls).toHaveLength(1);
        // With no laid-out poster for this index the frame falls back to the whole cell, so the outsets
        // themselves are what is observable here.
        expect(itemRect.y - calls[0].y).toBe(grid.marginY + grid.focusPaddingTop);
        expect(itemRect.x - calls[0].x).toBe(grid.focusPaddingX);
        expect(calls[0].width - itemRect.width).toBe(grid.focusPaddingX * 2);
        // The base would have used these instead; they must differ, or the assertion above is vacuous.
        expect(grid.focusMargins(grid.getBitmap("focusBitmapUri")).top).not.toBe(grid.marginY + grid.focusPaddingTop);
    });

    test("PosterGrid's focus frame width tracks the laid-out poster, not the cell", () => {
        // The frame's x/width come from that cell's laid-out posterRect — the behavior the deleted
        // focusLayoutOverride field existed to feed, and which no rect assertion covered before. Its
        // HEIGHT deliberately still spans the cell (captions included); only x/width are poster-derived.
        const grid = SGNodeFactory.createNode("PosterGrid");
        grid.setValue("basePosterSize", new RoArray([new Float(120), new Float(120)]));
        grid.setValue("caption1NumLines", new Int32(1));
        grid.setValue("numColumns", new Int32(1));
        const content = SGNodeFactory.createNode("ContentNode");
        for (const title of ["A", "B"]) {
            const item = SGNodeFactory.createNode("ContentNode");
            item.setValue("title", new BrsString(title));
            content.appendChildToParent(item);
        }
        grid.setValue("content", content);

        const frames = [];
        const draw2D = {
            drawNinePatch: (bmp, rect) => frames.push({ ...rect }),
            doDrawRotatedRect: () => {},
            doDrawRotatedText: () => {},
            doDrawScaledObject: () => {},
            doDrawRotatedBitmap: () => {},
            doDrawCroppedBitmap: () => {},
            pushClip: () => {},
            popClip: () => {},
        };
        grid.paintNode(interpreter, [0, 0], 0, 1, draw2D);

        expect(frames.length).toBeGreaterThan(0);
        // Poster width (120) plus the horizontal outset on each side — NOT the cell width.
        expect(frames[0].width).toBe(120 + grid.focusPaddingX * 2);
        expect(frames[0].x).toBe(-grid.focusPaddingX);
        // The caption band is inside the frame's height, so it is taller than the poster: that asymmetry
        // is deliberate, and asserting it here stops a refactor from "fixing" it silently.
        expect(frames[0].height).toBeGreaterThan(120);
    });
});
