const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot, sgClock } = scenegraph;
const { BrsString, Interpreter } = core;

/**
 * BusySpinner advances its rotation only on paint passes, by the paint-to-paint time delta —
 * layout passes (bounding-rect refreshes) render the stored rotation without consuming time.
 * Before the layout/paint split a measurement pass both advanced the spin (making measurement
 * frequency change the spin speed) and re-dirtied the scene via the poster field write.
 */
describe("BusySpinner clock behavior across pass kinds", () => {
    let interpreter;
    let fakeNow;
    const draw2D = { doDrawRotatedBitmap: () => {}, doDrawRotatedRect: () => {} };

    beforeEach(() => {
        interpreter = new Interpreter();
        fakeNow = 50_000;
        sgClock.setSource({ now: () => fakeNow, perfNow: () => fakeNow });
    });

    afterEach(() => {
        sgClock.setSource();
        sgRoot.setFocused();
    });

    function buildSpinner() {
        const group = SGNodeFactory.createNode("Group");
        const spinner = SGNodeFactory.createNode("BusySpinner");
        group.appendChildToParent(spinner);
        spinner.setValue("control", new BrsString("start"));
        return { group, spinner, poster: spinner.getValue("poster") };
    }

    test("rotation advances only on paint, by the paint-to-paint delta", () => {
        const { group, poster } = buildSpinner();

        group.paintNode(interpreter, [0, 0], 0, 1, draw2D);
        const start = poster.getValueJS("rotation");

        // Interleave layout passes across 1s of clock: no advancement.
        fakeNow += 400;
        group.layoutNode(interpreter, [0, 0], 0, 1);
        fakeNow += 600;
        group.layoutNode(interpreter, [0, 0], 0, 1);
        expect(poster.getValueJS("rotation")).toBe(start);

        // The next paint advances by the FULL elapsed second (spinInterval default 2s =>
        // half a revolution) — the interleaved layouts did not eat the delta.
        group.paintNode(interpreter, [0, 0], 0, 1, draw2D);
        const advanced = poster.getValueJS("rotation");
        expect(Math.abs(advanced - start)).toBeCloseTo(Math.PI, 5);
    });

    test("layout passes do not re-dirty the scene from the spin", () => {
        const { group } = buildSpinner();
        group.paintNode(interpreter, [0, 0], 0, 1, draw2D);

        sgRoot.clearDirty();
        fakeNow += 300;
        group.layoutNode(interpreter, [0, 0], 0, 1);

        expect(sgRoot.isDirty).toBe(false);
    });
});
