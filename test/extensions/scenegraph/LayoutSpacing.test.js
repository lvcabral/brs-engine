const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsBoolean, BrsString, Float, RoArray } = core;

/** Minimal interpreter accepted by renderNode → renderChildren when draw2D is absent. */
const fakeInterpreter = {};

const CHILD = { width: 30, height: 10 };

/**
 * Device-measured `itemSpacings` / `addItemSpacingAfterChild` behavior, from the probe channel
 * `Samples/layoutspacing-probe` (three children of 30x10, three passes; the engine reproduces every
 * row). The load-bearing rule is the first one: apps write a single-element `itemSpacings` with many
 * children constantly, and the engine's "repeat the last entry" reading was an assumption until this
 * probe confirmed it.
 */
function vector(values) {
    return new RoArray(values.map((v) => new Float(v)));
}

/**
 * Lays out three equal children and reports the first child's offset plus the two gaps BETWEEN
 * children (distance minus child size, so 0 means touching and negative means overlapping) — the
 * same quantities the probe prints.
 */
function spacingCase(spacings, { addAfter = true, direction = "horiz" } = {}) {
    const layout = SGNodeFactory.createNode("LayoutGroup");
    layout.setValue("layoutDirection", new BrsString(direction));
    layout.setValue("itemSpacings", vector(spacings));
    layout.setValue("addItemSpacingAfterChild", BrsBoolean.from(addAfter));

    for (let i = 0; i < 3; i++) {
        const child = SGNodeFactory.createNode("Rectangle");
        child.setValue("width", new Float(CHILD.width));
        child.setValue("height", new Float(CHILD.height));
        layout.appendChildToParent(child);
    }
    layout.renderNode(fakeInterpreter, [0, 0], 0, 1);

    const axis = direction === "vert" ? 1 : 0;
    const size = direction === "vert" ? CHILD.height : CHILD.width;
    const positions = layout.getNodeChildren().map((child) => child.getValueJS("translation")[axis]);

    return {
        start: positions[0],
        gaps: [positions[1] - positions[0] - size, positions[2] - positions[1] - size],
        dimensions: layout.getDimensions(),
    };
}

describe("LayoutGroup itemSpacings matches device behavior", () => {
    afterEach(() => {
        sgRoot.setFocused();
    });

    test("no spacing packs the children edge to edge", () => {
        const result = spacingCase([]);
        expect(result.start).toBeCloseTo(0);
        expect(result.gaps).toEqual([0, 0]);
        expect(result.dimensions.width).toBeCloseTo(90);
    });

    test("a single-entry array repeats that entry for every gap", () => {
        // The rule that matters most: itemSpacings="[4]" with three children spaces BOTH gaps by 4,
        // not just the first. Confirmed on hardware.
        const result = spacingCase([4]);
        expect(result.gaps).toEqual([4, 4]);
        expect(result.dimensions.width).toBeCloseTo(98);
    });

    test("an exactly-sized array maps entry i to the gap after child i", () => {
        const result = spacingCase([4, 9]);
        expect(result.gaps).toEqual([4, 9]);
        expect(result.dimensions.width).toBeCloseTo(103);
    });

    test("entries past the last gap are ignored, adding no trailing space", () => {
        // The extra entries must not widen the group: a trailing space would change the size every
        // parent measures (a wrapping LayoutGroup, a dialog sizing itself around it).
        const three = spacingCase([4, 9, 15]);
        const four = spacingCase([4, 9, 15, 20]);
        expect(three.gaps).toEqual([4, 9]);
        expect(four.gaps).toEqual([4, 9]);
        expect(three.dimensions.width).toBeCloseTo(103);
        expect(four.dimensions.width).toBeCloseTo(103);
    });

    test("negative spacing overlaps the children instead of clamping to zero", () => {
        const result = spacingCase([-6]);
        expect(result.gaps).toEqual([-6, -6]);
        expect(result.dimensions.width).toBeCloseTo(78);
    });

    test("fractional spacing is used as-is, not rounded", () => {
        const result = spacingCase([2.5]);
        expect(result.gaps[0]).toBeCloseTo(2.5);
        expect(result.gaps[1]).toBeCloseTo(2.5);
        expect(result.dimensions.width).toBeCloseTo(95);
    });

    test("the same index mapping applies to a vertical layout", () => {
        expect(spacingCase([4], { direction: "vert" }).gaps).toEqual([4, 4]);

        const exact = spacingCase([4, 9], { direction: "vert" });
        expect(exact.gaps).toEqual([4, 9]);
        expect(exact.dimensions.height).toBeCloseTo(43);
    });

    describe("addItemSpacingAfterChild=false inserts the space BEFORE each child", () => {
        test("the whole run shifts by the first entry", () => {
            // The first child is pushed off the origin by spacings[0] — the visible signature of
            // before-placement insertion, and the reason the group's own rect starts at x=4.
            const result = spacingCase([4], { addAfter: false });
            expect(result.start).toBeCloseTo(4);
            expect(result.gaps).toEqual([4, 4]);
        });

        test("gaps come from the FOLLOWING entries, not the preceding ones", () => {
            // [4,9]: 4 before child 0, 9 before child 1, then 9 repeated before child 2 → gaps 9,9.
            const result = spacingCase([4, 9], { addAfter: false });
            expect(result.start).toBeCloseTo(4);
            expect(result.gaps).toEqual([9, 9]);
        });

        test("a third entry is consumed by the third child rather than ignored", () => {
            // Mirror of the addAfter=true case: with before-placement there IS a third gap position,
            // so [4,9,15] is fully used where addAfter=true would have dropped the 15.
            const result = spacingCase([4, 9, 15], { addAfter: false });
            expect(result.start).toBeCloseTo(4);
            expect(result.gaps).toEqual([9, 15]);
        });

        test("an empty array leaves the run at the origin", () => {
            const result = spacingCase([], { addAfter: false });
            expect(result.start).toBeCloseTo(0);
            expect(result.gaps).toEqual([0, 0]);
        });
    });
});
