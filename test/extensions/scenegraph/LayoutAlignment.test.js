const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsString, Float, RoArray } = core;

/** Minimal interpreter accepted by renderNode → renderChildren when draw2D is absent. */
const fakeInterpreter = {};

/**
 * `horizAlignment` and `vertAlignment` are ENUM fields, exactly like `layoutDirection` — see
 * LayoutDirection.test.js. This file pins the device-measured behavior from the companion probe
 * channel `Samples/layoutalign-probe` (48 cases: 12 spellings × 4 direction/field combinations,
 * three passes, all agreeing; the engine now reproduces all 48 rows byte for byte).
 *
 * Two children of deliberately different sizes, each with its own non-zero translation, so an
 * unmanaged ("custom") axis is distinguishable from an aligned one. These are the probe's exact
 * child specs, so the expected numbers below are the device's numbers, not re-derived ones.
 */
const CHILD_A = { width: 30, height: 8, translation: [7, 13] };
const CHILD_B = { width: 50, height: 16, translation: [11, 17] };
const SPACING = 4;

function vector(values) {
    return new RoArray(values.map((v) => new Float(v)));
}

/**
 * Builds one probe case and returns both children's translations after layout. The group sits at
 * the origin, so a child's translation is exactly the probe's measured offset from the group origin.
 */
function layoutCase(direction, fieldName, value, secondValue) {
    const layout = SGNodeFactory.createNode("LayoutGroup");
    layout.setValue("layoutDirection", new BrsString(direction));
    layout.setValue("itemSpacings", vector([SPACING]));
    if (value !== undefined) {
        layout.setValue(fieldName, new BrsString(value));
    }
    if (secondValue !== undefined) {
        layout.setValue(fieldName, new BrsString(secondValue));
    }

    for (const spec of [CHILD_A, CHILD_B]) {
        const child = SGNodeFactory.createNode("Rectangle");
        child.setValue("width", new Float(spec.width));
        child.setValue("height", new Float(spec.height));
        child.setValue("translation", vector(spec.translation));
        layout.appendChildToParent(child);
    }

    layout.renderNode(fakeInterpreter, [0, 0], 0, 1);

    const children = layout.getNodeChildren();
    return {
        stored: layout.getValueJS(fieldName),
        first: children[0].getValueJS("translation"),
        second: children[1].getValueJS("translation"),
    };
}

/** Appends the two probe children to an already-configured group, renders, and reports positions. */
function buildAndRender(layout) {
    for (const spec of [CHILD_A, CHILD_B]) {
        const child = SGNodeFactory.createNode("Rectangle");
        child.setValue("width", new Float(spec.width));
        child.setValue("height", new Float(spec.height));
        child.setValue("translation", vector(spec.translation));
        layout.appendChildToParent(child);
    }
    layout.renderNode(fakeInterpreter, [0, 0], 0, 1);

    const children = layout.getNodeChildren();
    return {
        first: children[0].getValueJS("translation"),
        second: children[1].getValueJS("translation"),
    };
}

function expectPositions(result, first, second) {
    expect(result.first[0]).toBeCloseTo(first[0]);
    expect(result.first[1]).toBeCloseTo(first[1]);
    expect(result.second[0]).toBeCloseTo(second[0]);
    expect(result.second[1]).toBeCloseTo(second[1]);
}

describe("LayoutGroup alignment fields match device enum behavior", () => {
    afterEach(() => {
        sgRoot.setFocused();
    });

    describe("storage: documented values canonicalize, everything else is rejected", () => {
        const cases = [
            { field: "horizAlignment", written: "left", stored: "left" },
            { field: "horizAlignment", written: "LEFT", stored: "left" },
            { field: "horizAlignment", written: "Center", stored: "center" },
            { field: "horizAlignment", written: "custom", stored: "custom" },
            { field: "horizAlignment", written: "centre", stored: "" },
            { field: "horizAlignment", written: "middle", stored: "" },
            { field: "horizAlignment", written: "", stored: "" },
            { field: "horizAlignment", written: "bogus", stored: "" },
            // A value valid for the SIBLING field is rejected: the two fields do not share a table.
            { field: "horizAlignment", written: "top", stored: "" },
            { field: "vertAlignment", written: "top", stored: "top" },
            { field: "vertAlignment", written: "TOP", stored: "top" },
            { field: "vertAlignment", written: "Center", stored: "center" },
            { field: "vertAlignment", written: "custom", stored: "custom" },
            { field: "vertAlignment", written: "centre", stored: "" },
            { field: "vertAlignment", written: "bogus", stored: "" },
            { field: "vertAlignment", written: "left", stored: "" },
        ];

        test.each(cases)('$field = "$written" reads back "$stored"', ({ field, written, stored }) => {
            const layout = SGNodeFactory.createNode("LayoutGroup");
            layout.setValue(field, new BrsString(written));
            expect(layout.getValueJS(field)).toBe(stored);
        });

        test("defaults are left/top and are not the rejected state", () => {
            const layout = SGNodeFactory.createNode("LayoutGroup");
            expect(layout.getValueJS("horizAlignment")).toBe("left");
            expect(layout.getValueJS("vertAlignment")).toBe("top");
        });

        test("a rejected write clobbers a previously valid one", () => {
            const layout = SGNodeFactory.createNode("LayoutGroup");
            layout.setValue("horizAlignment", new BrsString("center"));
            layout.setValue("horizAlignment", new BrsString("bogus"));
            expect(layout.getValueJS("horizAlignment")).toBe("");
        });
    });

    // Probe group A. horizAlignment is the CROSS axis: each child is aligned independently.
    describe("layoutDirection=vert, horizAlignment (cross axis)", () => {
        test("left aligns both left edges at the origin", () => {
            expectPositions(layoutCase("vert", "horizAlignment", "left"), [0, 0], [0, 12]);
        });

        test("center centers each child on the origin independently", () => {
            expectPositions(layoutCase("vert", "horizAlignment", "center"), [-15, 0], [-25, 12]);
        });

        test("right aligns both right edges at the origin", () => {
            expectPositions(layoutCase("vert", "horizAlignment", "right"), [-30, 0], [-50, 12]);
        });

        test("custom keeps each child's own x while still stacking on y", () => {
            expectPositions(layoutCase("vert", "horizAlignment", "custom"), [7, 0], [11, 12]);
        });

        test("a rejected value collapses every child onto the origin", () => {
            // Device behavior, not a left fallback: the primary-axis stacking is abandoned too, and
            // the children's own translations are discarded. A `left` fallback would give [0,12] for
            // the second child; the device gives [0,0].
            expectPositions(layoutCase("vert", "horizAlignment", "bogus"), [0, 0], [0, 0]);
        });
    });

    // Probe group B. horizAlignment is the PRIMARY axis: the whole row is placed as a unit.
    describe("layoutDirection=horiz, horizAlignment (primary axis)", () => {
        test("left starts the row at the origin", () => {
            expectPositions(layoutCase("horiz", "horizAlignment", "left"), [0, 0], [34, 0]);
        });

        test("center centers the whole row on the origin", () => {
            expectPositions(layoutCase("horiz", "horizAlignment", "center"), [-42, 0], [-8, 0]);
        });

        test("right ends the row at the origin", () => {
            expectPositions(layoutCase("horiz", "horizAlignment", "right"), [-84, 0], [-50, 0]);
        });

        test("custom is not valid on the primary axis and falls back to left", () => {
            expectPositions(layoutCase("horiz", "horizAlignment", "custom"), [0, 0], [34, 0]);
        });

        test("a rejected value falls back to left without collapsing", () => {
            // The cross axis (vertAlignment) is still valid here, so the layout runs normally —
            // only a rejected CROSS alignment collapses.
            expectPositions(layoutCase("horiz", "horizAlignment", "bogus"), [0, 0], [34, 0]);
        });
    });

    // Probe group C. vertAlignment is the PRIMARY axis.
    describe("layoutDirection=vert, vertAlignment (primary axis)", () => {
        test("top starts the column at the origin", () => {
            expectPositions(layoutCase("vert", "vertAlignment", "top"), [0, 0], [0, 12]);
        });

        test("center centers the whole column on the origin", () => {
            expectPositions(layoutCase("vert", "vertAlignment", "center"), [0, -14], [0, -2]);
        });

        test("bottom ends the column at the origin", () => {
            expectPositions(layoutCase("vert", "vertAlignment", "bottom"), [0, -28], [0, -16]);
        });

        test("custom is not valid on the primary axis and falls back to top", () => {
            expectPositions(layoutCase("vert", "vertAlignment", "custom"), [0, 0], [0, 12]);
        });

        test("a rejected value falls back to top without collapsing", () => {
            expectPositions(layoutCase("vert", "vertAlignment", "bogus"), [0, 0], [0, 12]);
        });

        test("a rejected value written over a valid one still falls back to top", () => {
            expectPositions(layoutCase("vert", "vertAlignment", "center", "bogus"), [0, 0], [0, 12]);
        });
    });

    // Probe group D. vertAlignment is the CROSS axis.
    describe("layoutDirection=horiz, vertAlignment (cross axis)", () => {
        test("top aligns both top edges at the origin", () => {
            expectPositions(layoutCase("horiz", "vertAlignment", "top"), [0, 0], [34, 0]);
        });

        test("center centers each child on the origin independently", () => {
            expectPositions(layoutCase("horiz", "vertAlignment", "center"), [0, -4], [34, -8]);
        });

        test("bottom aligns both bottom edges at the origin", () => {
            expectPositions(layoutCase("horiz", "vertAlignment", "bottom"), [0, -8], [34, -16]);
        });

        test("custom keeps each child's own y while still packing on x", () => {
            expectPositions(layoutCase("horiz", "vertAlignment", "custom"), [0, 13], [34, 17]);
        });

        test("a rejected value collapses every child onto the origin", () => {
            expectPositions(layoutCase("horiz", "vertAlignment", "bogus"), [0, 0], [0, 0]);
        });

        test("a rejected value written over a valid one also collapses", () => {
            expectPositions(layoutCase("horiz", "vertAlignment", "center", "bogus"), [0, 0], [0, 0]);
        });
    });

    // Probe group R (Samples/layoutspacing-probe). The cross-axis collapse was extrapolated to these
    // combinations before they were measured; hardware confirmed every one.
    describe("rejected-value combinations", () => {
        test("both alignments rejected still collapses (the cross-axis rule wins)", () => {
            const layout = SGNodeFactory.createNode("LayoutGroup");
            layout.setValue("layoutDirection", new BrsString("vert"));
            layout.setValue("horizAlignment", new BrsString("bogus"));
            layout.setValue("vertAlignment", new BrsString("bogus"));
            expectPositions(buildAndRender(layout), [0, 0], [0, 0]);
        });

        test("a rejected layoutDirection resolves to horiz, making vertAlignment the cross field", () => {
            // dir rejected → horizontal. A rejected vertAlignment is then the CROSS field → collapse.
            const collapsing = SGNodeFactory.createNode("LayoutGroup");
            collapsing.setValue("layoutDirection", new BrsString("bogus"));
            collapsing.setValue("vertAlignment", new BrsString("bogus"));
            expectPositions(buildAndRender(collapsing), [0, 0], [0, 0]);

            // Whereas a rejected horizAlignment is the PRIMARY field there → plain left fallback.
            const laying = SGNodeFactory.createNode("LayoutGroup");
            laying.setValue("layoutDirection", new BrsString("bogus"));
            laying.setValue("horizAlignment", new BrsString("bogus"));
            laying.setValue("itemSpacings", vector([4]));
            expectPositions(buildAndRender(laying), [0, 0], [34, 0]);
        });
    });

    // Probe section F. Roku's Group/LayoutGroup declare no width/height, and the device confirms it:
    // hasField("width") is false and lg.width reads invalid, while localBoundingRect() is correct.
    describe("a LayoutGroup exposes no width/height fields", () => {
        test("the fields are absent before and after layout, but getDimensions() reports the size", () => {
            const layout = SGNodeFactory.createNode("LayoutGroup");
            layout.setValue("layoutDirection", new BrsString("horiz"));
            layout.setValue("itemSpacings", vector([4]));

            expect(layout.hasNodeField("width")).toBe(false);
            expect(layout.hasNodeField("height")).toBe(false);

            buildAndRender(layout);

            expect(layout.hasNodeField("width")).toBe(false);
            expect(layout.hasNodeField("height")).toBe(false);
            // 30 + 4 + 50 wide; tallest child is 16.
            expect(layout.getDimensions().width).toBeCloseTo(84);
            expect(layout.getDimensions().height).toBeCloseTo(16);
        });
    });

    test("a collapsed group settles instead of re-dirtying every layout pass", () => {
        // collapseChildren deliberately writes no metricsMap entries; if it did, synchronizeChildMetrics
        // would compare real child sizes against zeroed expectations and burn all 8 passes forever.
        const layout = SGNodeFactory.createNode("LayoutGroup");
        layout.setValue("layoutDirection", new BrsString("vert"));
        layout.setValue("horizAlignment", new BrsString("bogus"));

        for (const spec of [CHILD_A, CHILD_B]) {
            const child = SGNodeFactory.createNode("Rectangle");
            child.setValue("width", new Float(spec.width));
            child.setValue("height", new Float(spec.height));
            layout.appendChildToParent(child);
        }

        layout.renderNode(fakeInterpreter, [0, 0], 0, 1);
        layout.renderNode(fakeInterpreter, [0, 0], 0, 1);
        expect(layout.lastPassCount).toBe(1);
    });
});
