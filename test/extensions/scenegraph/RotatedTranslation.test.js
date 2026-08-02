const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, Float, RoArray, Interpreter } = core;

const vector = (values) => new RoArray(values.map((v) => new Float(v)));
const HALF_PI = 1.5708;

/**
 * DEVICE-MEASURED (Streaming Stick, Roku OS 15.2) via `out/layout-measure-probe`, case `R`.
 *
 * An inherited rotation rotates a child's OWN translation vector, for every node type. Two identical
 * hosts rotated 90° with a child translated [100, 0] put the child at the same rotated position
 * whether that child is a `Group` or a `Rectangle`.
 *
 * The engine used to rotate for 18 renderable types but not for `Group` or the keyboard/text-entry
 * containers — #1133 preserved that split deliberately, pending exactly this measurement, because the
 * two are indistinguishable whenever the inherited angle is 0.
 */
describe("an inherited rotation rotates every node type's own translation", () => {
    let interpreter;

    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    test("Group and Rectangle compose the same draw translation under an inherited angle", () => {
        // The precise behavior that changed. Node type must not affect the answer.
        const group = SGNodeFactory.createNode("Group");
        group.setValue("translation", vector([100, 0]));
        const rect = SGNodeFactory.createNode("Rectangle");
        rect.setValue("translation", vector([100, 0]));

        const groupTrans = group.getDrawTranslation([0, 0], HALF_PI);
        const rectTrans = rect.getDrawTranslation([0, 0], HALF_PI);

        expect(groupTrans[0]).toBeCloseTo(rectTrans[0], 3);
        expect(groupTrans[1]).toBeCloseTo(rectTrans[1], 3);
        // Rotating [100, 0] by 90° moves it onto the vertical axis: x → ~0, y → ~-100.
        expect(groupTrans[0]).toBeCloseTo(0, 2);
        expect(groupTrans[1]).toBeCloseTo(-100, 2);
    });

    test("the keyboard/text-entry containers rotate too", () => {
        // These were the other side of the removed split, alongside Group.
        const rect = SGNodeFactory.createNode("Rectangle");
        rect.setValue("translation", vector([100, 0]));
        const expected = rect.getDrawTranslation([0, 0], HALF_PI);

        for (const type of ["Keyboard", "MiniKeyboard", "PinPad", "TextEditBox"]) {
            const node = SGNodeFactory.createNode(type);
            node.setValue("translation", vector([100, 0]));
            const trans = node.getDrawTranslation([0, 0], HALF_PI);
            expect(trans[0]).toBeCloseTo(expected[0], 3);
            expect(trans[1]).toBeCloseTo(expected[1], 3);
        }
    });

    test("an unrotated ancestor is unaffected (the two behaviors were identical at angle 0)", () => {
        // Guard against over-correcting: this is why the split went unnoticed for so long.
        const group = SGNodeFactory.createNode("Group");
        group.setValue("translation", vector([100, 25]));
        expect(group.getDrawTranslation([10, 5], 0)).toEqual([110, 30]);
    });

    test("a Rectangle child of a rotated host lands where the device put it", () => {
        // Device: host [900,320] rotated 90°, child translated [100,0] → scene rect {x=900, y=200}.
        const host = SGNodeFactory.createNode("Group");
        host.setValue("translation", vector([900, 320]));
        host.setValue("rotation", new Float(HALF_PI));
        const child = SGNodeFactory.createNode("Rectangle");
        child.setValue("translation", vector([100, 0]));
        child.setValue("width", new Float(20));
        child.setValue("height", new Float(20));
        host.appendChildToParent(child);

        const rect = child.getBoundingRect("toScene", interpreter);

        expect(Math.round(rect.x)).toBe(900);
        expect(Math.round(rect.y)).toBe(200);
    });
});
