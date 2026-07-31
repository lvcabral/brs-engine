const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { LayoutGroup, SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Float } = core;

/** AAMember is a plain `{ name, value }` interface — the shape XML attributes arrive in. */
function member(name, value) {
    return { name: new BrsString(name), value: new BrsString(value) };
}

/** Minimal interpreter accepted by renderNode → renderChildren when draw2D is absent. */
const fakeInterpreter = {};

/**
 * `layoutDirection` is an ENUM field on Roku, not free text. This table is DEVICE-MEASURED — every
 * row was produced by a probe channel (Samples/layoutgroup-probe) that reads each case back with
 * `sceneBoundingRect()` and reports which axis the children advanced along. Three passes, and the
 * XML-attribute and runtime-write columns agreed on every row.
 *
 * The two counter-intuitive results, and the reason this file exists:
 *
 *  1. An unrecognized value is REJECTED, not stored-and-ignored — the field reads back as `""`.
 *  2. That empty state lays out HORIZONTALLY, even though a never-written field keeps its `"vert"`
 *     default and lays out vertically. So `layoutDirection="horz"` is a horizontal row on hardware.
 *
 * The engine previously treated any unrecognized value as `vert` and accepted `horizontal`/
 * `vertical` as aliases — both wrong in the direction that silently breaks a real app's menu bar.
 */
const deviceCases = [
    { spelling: "horiz", stored: "horiz", direction: "horiz" },
    { spelling: "vert", stored: "vert", direction: "vert" },
    { spelling: "horz", stored: "", direction: "horiz" },
    { spelling: "horizontal", stored: "", direction: "horiz" },
    { spelling: "vertical", stored: "", direction: "horiz" },
    { spelling: "HORIZ", stored: "horiz", direction: "horiz" },
    { spelling: "Horiz", stored: "horiz", direction: "horiz" },
    { spelling: "", stored: "", direction: "horiz" },
    { spelling: "bogus", stored: "", direction: "horiz" },
];

/**
 * Builds a group of three fixed-size children and renders it, then reports which axis the children
 * advanced along — the same inference the device probe makes, so a failure here reads the same way
 * as a failure on hardware.
 */
function layoutAxisOf(layout) {
    for (let i = 0; i < 3; i++) {
        const child = SGNodeFactory.createNode("Rectangle");
        child.setValue("width", new Float(40));
        child.setValue("height", new Float(10));
        layout.appendChildToParent(child);
    }
    layout.renderNode(fakeInterpreter, [0, 0], 0, 1);

    const first = layout.getNodeChildren()[0].getValueJS("translation");
    const second = layout.getNodeChildren()[1].getValueJS("translation");
    const dx = second[0] - first[0];
    const dy = second[1] - first[1];

    if (dx > 1 && dy <= 1) return "horiz";
    if (dy > 1 && dx <= 1) return "vert";
    return `neither (dx=${dx} dy=${dy})`;
}

describe("LayoutGroup layoutDirection matches device enum behavior", () => {
    beforeAll(() => {
        // ButtonGroup's default fields include fonts from the common: volume; mount it once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    test("an untouched layoutDirection keeps its vert default and stacks vertically", () => {
        const layout = SGNodeFactory.createNode("LayoutGroup");

        expect(layout.getValueJS("layoutDirection")).toBe("vert");
        expect(layoutAxisOf(layout)).toBe("vert");
    });

    test.each(deviceCases)(
        'writing "$spelling" stores "$stored" and lays out $direction',
        ({ spelling, stored, direction }) => {
            const layout = SGNodeFactory.createNode("LayoutGroup");
            layout.setValue("layoutDirection", new BrsString(spelling));

            expect(layout.getValueJS("layoutDirection")).toBe(stored);
            expect(layoutAxisOf(layout)).toBe(direction);
        }
    );

    test("a rejected write clobbers a previously valid one and leaves the field empty", () => {
        // Device case 10: horiz then horz → stored "", laid out HORIZ. The invalid write does not
        // preserve the earlier valid value; the layout stays horizontal only because the empty
        // state is itself horizontal.
        const layout = SGNodeFactory.createNode("LayoutGroup");
        layout.setValue("layoutDirection", new BrsString("horiz"));
        layout.setValue("layoutDirection", new BrsString("horz"));

        expect(layout.getValueJS("layoutDirection")).toBe("");
        expect(layoutAxisOf(layout)).toBe("horiz");
    });

    test("a rejected write flips a vertical group to horizontal", () => {
        // The consequence of case 10 that actually bites: a group that WAS laying out vertically
        // does not stay vertical when handed junk — it rows out. Nothing in the device table covers
        // vert→invalid directly, but it follows from "stored is now empty, empty is horizontal".
        const layout = SGNodeFactory.createNode("LayoutGroup");
        layout.setValue("layoutDirection", new BrsString("vert"));
        layout.setValue("layoutDirection", new BrsString("bogus"));

        expect(layout.getValueJS("layoutDirection")).toBe("");
        expect(layoutAxisOf(layout)).toBe("horiz");
    });

    test("a valid re-write still switches direction", () => {
        // Device case 11: vert then horiz → stored "horiz", laid out HORIZ. Guards against a fix
        // that canonicalizes so eagerly it stops honoring legitimate changes.
        const layout = SGNodeFactory.createNode("LayoutGroup");
        layout.setValue("layoutDirection", new BrsString("vert"));
        layout.setValue("layoutDirection", new BrsString("horiz"));

        expect(layout.getValueJS("layoutDirection")).toBe("horiz");
        expect(layoutAxisOf(layout)).toBe("horiz");
    });

    test("setValueSilent canonicalizes exactly like setValue", () => {
        const layout = SGNodeFactory.createNode("LayoutGroup");
        layout.setValueSilent("layoutDirection", new BrsString("HORIZ"));
        expect(layout.getValueJS("layoutDirection")).toBe("horiz");

        layout.setValueSilent("layoutDirection", new BrsString("horz"));
        expect(layout.getValueJS("layoutDirection")).toBe("");
    });

    test("fields supplied at construction are canonicalized too", () => {
        // The constructor's initializedFields path bypasses setValue (Node writes those straight
        // into the field map), and it is how cross-thread deserialization and createFlatNode
        // rebuild a node — so a Task-side copy must report the same value as the render thread.
        const layout = new LayoutGroup([member("layoutDirection", "Horiz")]);
        expect(layout.getValueJS("layoutDirection")).toBe("horiz");

        const rejected = new LayoutGroup([member("layoutDirection", "horz")]);
        expect(rejected.getValueJS("layoutDirection")).toBe("");
        expect(layoutAxisOf(rejected)).toBe("horiz");
    });

    test("ButtonGroup inherits the enum behavior without losing its vertical default", () => {
        // ButtonGroup extends LayoutGroup; its buttons stack vertically by default and that must
        // not change, but an explicit bad write must behave like any other LayoutGroup.
        const group = SGNodeFactory.createNode("ButtonGroup");
        expect(group.getValueJS("layoutDirection")).toBe("vert");

        group.setValue("layoutDirection", new BrsString("horz"));
        expect(group.getValueJS("layoutDirection")).toBe("");
    });
});
