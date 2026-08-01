const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory } = scenegraph;
const { BrsString, Float, Int32, RoArray } = core;

const floatArray = (nums) => new RoArray(nums.map((n) => new Float(n)));
const stringArray = (strs) => new RoArray(strs.map((s) => new BrsString(s)));
const intArray = (nums) => new RoArray(nums.map((n) => new Int32(n)));

const channels = (rgba) => ({
    r: (rgba >> 24) & 0xff,
    g: (rgba >> 16) & 0xff,
    b: (rgba >> 8) & 0xff,
    a: rgba & 0xff,
});

/**
 * `colorarray` fields (ColorFieldInterpolator.keyValue, ArrayGrid's rowTitleColor/rowCounterColor, ...)
 * must normalize hex STRINGS to packed 0xRRGGBBAA integers the way the scalar `color` path and the XML
 * attribute path already do. Apps build these lists from string constants
 * (`keyValue = [colorBlack + alpha60, colorBackgroundPrimary]`), and the stored strings used to reach
 * consumers that do bitwise math on them — JS `ToNumber` then read a 6-digit "0x0D1117" as 0x000D1117,
 * shifting every lane one byte right so the intended blue (0x17) became the ALPHA. A panel animated to
 * that color rendered ~9% opaque instead of solid, leaving everything painted behind it visible.
 */
describe("colorarray hex-string normalization", () => {
    test("a 6-digit hex string gains the implicit FF alpha; an 8-digit one keeps its own", () => {
        const interp = SGNodeFactory.createNode("ColorFieldInterpolator");
        interp.setValue("keyValue", stringArray(["0x00000099", "0x0D1117"]));

        expect(interp.getValueJS("keyValue")).toEqual([0x00000099, 0x0d1117ff]);
    });

    test("#, 0x and &h prefixes and an integer all normalize to the same value", () => {
        const forms = ["0x0D1117", "#0D1117", "&h0D1117", "0x0D1117FF"];
        for (const form of forms) {
            const interp = SGNodeFactory.createNode("ColorFieldInterpolator");
            interp.setValue("keyValue", stringArray([form]));
            expect(interp.getValueJS("keyValue")).toEqual([0x0d1117ff]);
        }

        const numeric = SGNodeFactory.createNode("ColorFieldInterpolator");
        numeric.setValue("keyValue", intArray([0x0d1117ff]));
        expect(numeric.getValueJS("keyValue")).toEqual([0x0d1117ff]);
    });

    test("string keyframes drive the target to a FULLY OPAQUE color", () => {
        // The app shape: a Rectangle panel whose own child Animation interpolates the panel's color
        // from translucent black to an opaque theme background as it slides over the content below.
        const panel = SGNodeFactory.createNode("Rectangle");
        panel.setValue("id", new BrsString("extrasGrp"));
        panel.setValue("color", new BrsString("0x00000099"));

        const animation = SGNodeFactory.createNode("Animation");
        animation.setValue("duration", new Float(0.4));
        const interp = SGNodeFactory.createNode("ColorFieldInterpolator");
        interp.setValue("fieldToInterp", new BrsString("extrasGrp.color"));
        interp.setValue("key", floatArray([0.0, 1.0]));
        interp.setValue("keyValue", stringArray(["0x00000099", "0x0D1117"]));
        animation.appendChildToParent(interp);
        panel.appendChildToParent(animation);

        // Starts translucent (0x99 = 60% alpha), so the buttons behind it show through.
        expect(channels(panel.getValueJS("color")).a).toBe(0x99);

        animation.setValue("control", new BrsString("finish"));

        // Ends opaque: the panel now hides everything painted before it.
        const end = channels(panel.getValueJS("color"));
        expect(end.a).toBe(0xff);
        expect(end.r).toBeCloseTo(0x0d, -0.5);
        expect(end.g).toBeCloseTo(0x11, -0.5);
        expect(end.b).toBeCloseTo(0x17, -0.5);
    });

    test("numeric keyframes still interpolate unchanged", () => {
        // Pins the XML/integer path, which already worked via NodeFactory.parseColorArray.
        const panel = SGNodeFactory.createNode("Rectangle");
        panel.setValue("id", new BrsString("panel"));

        const animation = SGNodeFactory.createNode("Animation");
        animation.setValue("duration", new Float(0.4));
        const interp = SGNodeFactory.createNode("ColorFieldInterpolator");
        interp.setValue("fieldToInterp", new BrsString("panel.color"));
        interp.setValue("key", floatArray([0.0, 1.0]));
        interp.setValue("keyValue", intArray([0x00000099, 0x0d1117ff]));
        animation.appendChildToParent(interp);
        panel.appendChildToParent(animation);

        animation.setValue("control", new BrsString("finish"));
        expect(channels(panel.getValueJS("color")).a).toBe(0xff);
    });
});
