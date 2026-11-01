const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory } = scenegraph;
const { BrsDevice, BrsString, RoArray, Float, Int32, Interpreter } = core;

/**
 * Pins the internal child layout of the TrickPlayBar that Video exposes as `trickPlayBar`. Apps index into it
 * (jellyfin-roku reads `getChild(8)` as the position Label and `getChild(3)` as the ticker), so the order is
 * part of the observable surface. Expected values come from the device capture in
 * test/simulator/probes/trickplaybar-children-probe (Roku OS 16.0).
 */
describe("TrickPlayBar internal children", () => {
    let bar;
    let span;
    let offset;
    let barW;
    let barH;

    const child = (i) => bar.getNodeChildren()[i];
    const translation = (node) => node.getValueJS("translation");
    const setHashMarks = (positions) =>
        bar.setValue("hashMarkPositions", new RoArray(positions.map((p) => new Float(p))));

    beforeAll(() => {
        // The labels' default fonts need the common: volume.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        bar = SGNodeFactory.createNode("TrickPlayBar");
        barW = child(0).getValueJS("width");
        barH = child(0).getValueJS("height");
        // Device FHD: hash marks sit at 1 + pos * (barW - 12); HD scales every pixel value by 2/3.
        const scale = barW === 1716 ? 1 : 2 / 3;
        span = barW - Math.round(12 * scale);
        offset = Math.round(scale);
    });

    test("has the device child order", () => {
        expect(bar.getNodeChildren().length).toBe(12);
        const kinds = bar.getNodeChildren().map((node) => node.nodeSubtype);
        expect(kinds).toEqual([
            "Poster", // 0 track
            "Poster", // 1 filled bar
            "Poster", // 2 thumb
            "Poster", // 3 ticker
            "Poster", // 4-6 hash marks
            "Poster",
            "Poster",
            "Poster", // 7 thumbnail holder
            "Label", // 8 position
            "Label", // 9 remaining
            "Poster", // 10 live icon
            "Label", // 11 LIVE
        ]);
        expect(child(7).getNodeChildren().length).toBe(1);
    });

    test("labels start at 0:00 and LIVE is hidden", () => {
        expect(child(8).getValueJS("text")).toBe("0:00");
        expect(child(9).getValueJS("text")).toBe("0:00");
        expect(child(11).getValueJS("text")).toBe("LIVE");
        expect(child(11).getValueJS("visible")).toBe(false);
        expect(child(10).getValueJS("visible")).toBe(false);
    });

    test("position and remaining labels use unpadded minutes", () => {
        bar.setPosition(903.436, 1800);
        expect(child(8).getValueJS("text")).toBe("15:03");
        expect(child(9).getValueJS("text")).toBe("14:56");

        bar.setPosition(1786.5, 1800);
        expect(child(8).getValueJS("text")).toBe("29:46");
        expect(child(9).getValueJS("text")).toBe("0:13");

        bar.setPosition(3725, 7200);
        expect(child(8).getValueJS("text")).toBe("1:02:05");
    });

    test("ticker travels the track minus its width and the filled bar is clipped to its centre", () => {
        bar.setPosition(900, 1800);
        const tickerX = 0.5 * (barW - barH);
        expect(translation(child(3))[0]).toBeCloseTo(tickerX, 3);
        expect(translation(child(2))[0]).toBeCloseTo(tickerX, 3);
        // The filled bar stays full width; the visible part is the clippingRect.
        expect(child(1).getValueJS("width")).toBe(barW);
        expect(child(1).getValueJS("clippingRect")).toEqual({
            x: 0,
            y: 0,
            width: Math.floor(tickerX + barH / 2),
            height: barH,
        });
        expect(child(1).getValueJS("visible")).toBe(true);
        expect(child(3).getValueJS("visible")).toBe(true);
    });

    test("position past the duration clamps the ticker to the end of the track", () => {
        bar.setPosition(2000, 1800);
        expect(translation(child(3))[0]).toBeCloseTo(barW - barH, 3);
    });

    test("hash marks start hidden at the default slots", () => {
        for (const [i, pos] of [0.25, 0.5, 0.75].entries()) {
            expect(child(4 + i).getValueJS("visible")).toBe(false);
            expect(translation(child(4 + i))[0]).toBeCloseTo(offset + pos * span, 3);
        }
    });

    test("hashMarkPositions reuses, removes and appends marks like a device", () => {
        // Three positions reuse the three marks in place.
        setHashMarks([0.1, 0.5, 0.9]);
        expect(bar.getNodeChildren().length).toBe(12);
        expect(translation(child(4))[0]).toBeCloseTo(offset + 0.1 * span, 3);
        expect(translation(child(6))[0]).toBeCloseTo(offset + 0.9 * span, 3);
        expect(child(4).getValueJS("visible")).toBe(true);
        expect(child(7).getNodeChildren().length).toBe(1);

        // One position drops the surplus marks; the remaining child indexes shift down.
        setHashMarks([0.2]);
        expect(bar.getNodeChildren().length).toBe(10);
        expect(child(5).getNodeChildren().length).toBe(1);
        expect(child(6).getValueJS("text")).toBe("0:00");

        // More positions than marks append the extras after every other child.
        setHashMarks([0.1, 0.2, 0.3, 0.4, 0.5]);
        expect(bar.getNodeChildren().length).toBe(14);
        expect(translation(child(4))[0]).toBeCloseTo(offset + 0.1 * span, 3);
        expect(translation(child(10))[0]).toBeCloseTo(offset + 0.2 * span, 3);
        expect(translation(child(13))[0]).toBeCloseTo(offset + 0.5 * span, 3);

        // Clearing the positions hides the marks and restores the three default slots.
        setHashMarks([]);
        expect(bar.getNodeChildren().length).toBe(12);
        expect(child(4).getValueJS("visible")).toBe(false);
        expect(translation(child(10))[0]).toBeCloseTo(offset + 0.5 * span, 3);
        expect(translation(child(11))[0]).toBeCloseTo(offset + 0.75 * span, 3);
    });

    test("textColor reaches every label and hashMarkBlendColor every mark", () => {
        bar.setValue("textColor", new Int32(0x11223344));
        for (const i of [8, 9, 11]) {
            expect(child(i).getValueJS("color")).toBe(0x11223344);
        }
        setHashMarks([0.1, 0.2, 0.3, 0.4]);
        bar.setValue("hashMarkBlendColor", new Int32(0x55667788));
        // Three marks sit in place at 4-6; the fourth was appended after every other child.
        for (const mark of [child(4), child(5), child(6), child(bar.getNodeChildren().length - 1)]) {
            expect(mark.getValueJS("blendColor")).toBe(0x55667788);
        }
    });

    test("painting clips the full-width filled bar to the ticker centre", () => {
        bar.setPosition(900, 1800);
        const clips = [];
        const draw2D = new Proxy(
            {
                pushClip: (rect) => clips.push({ ...rect }),
                popClip: () => {},
            },
            { get: (target, prop) => target[prop] ?? (() => {}) }
        );
        bar.paintNode(new Interpreter(), [0, 0], 0, 1, draw2D);
        const expected = Math.floor(0.5 * (barW - barH) + barH / 2);
        expect(clips).toContainEqual({ x: 0, y: 0, width: expected, height: barH });
    });

    test("the thumb and ticker keep their bitmap size instead of scaling to the UI resolution", () => {
        // Loading a uri recomputes Poster.noScaling, so it must be set after the uri.
        expect(child(2).noScaling).toBe(true);
        expect(child(3).noScaling).toBe(true);
    });

    test("the track and filled bar keep their images when no uri is given", () => {
        expect(child(0).getValueJS("uri")).toContain("trickplaybar.9.png");
        expect(child(1).getValueJS("uri")).toContain("trickplaybar.9.png");
    });

    test("image uris given at creation reach the track and filled bar", () => {
        const custom = new scenegraph.TrickPlayBar([
            { name: new BrsString("trackImageUri"), value: new BrsString("pkg:/images/track.png") },
            { name: new BrsString("filledBarImageUri"), value: new BrsString("pkg:/images/fill.png") },
            { name: new BrsString("textColor"), value: new Int32(0x11223344) },
        ]);
        expect(custom.getNodeChildren()[0].getValueJS("uri")).toBe("pkg:/images/track.png");
        expect(custom.getNodeChildren()[1].getValueJS("uri")).toBe("pkg:/images/fill.png");
        expect(custom.getNodeChildren()[8].getValueJS("color")).toBe(0x11223344);
    });
});
