const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory } = scenegraph;
const { BrsString, Float, RoArray } = core;

const floatArray = (nums) => new RoArray(nums.map((n) => new Float(n)));

/**
 * Animation target scoping: an interpolator's `fieldToInterp` (e.g. "background.opacity") is resolved
 * among the DESCENDANTS of the animation's component scope, not the component root itself. The root's
 * own `id` is assigned by the parent component (a different scope), so it must not shadow a same-named
 * child — otherwise a `<FadingBackground id="Background">` with a child `<Poster id="background">`
 * would drive the container instead of the inner poster (ids match case-insensitively), so a cross-fade
 * would animate the wrong node and the new image would never become visible.
 */
describe("Animation target resolution", () => {
    test("interpolator targets the child, not a same-named (case-folded) component root", () => {
        // Container id "Background" mirrors the parent-assigned id; inner poster id "background".
        const container = SGNodeFactory.createNode("Rectangle");
        container.setValue("id", new BrsString("Background"));
        const inner = SGNodeFactory.createNode("Poster");
        inner.setValue("id", new BrsString("background"));
        inner.setValue("opacity", new Float(0)); // starts hidden, like the FadingBackground's new poster
        container.appendChildToParent(inner);

        const animation = SGNodeFactory.createNode("Animation");
        animation.setValue("duration", new Float(0.5));
        const interp = SGNodeFactory.createNode("FloatFieldInterpolator");
        interp.setValue("fieldToInterp", new BrsString("background.opacity"));
        interp.setValue("key", floatArray([0.0, 1.0]));
        interp.setValue("keyValue", floatArray([0.0, 0.5])); // distinctive end value (not the default opacity 1)
        animation.appendChildToParent(interp);
        container.appendChildToParent(animation);

        expect(inner.getValueJS("opacity")).toBe(0);
        expect(container.getValueJS("opacity")).toBe(1);

        // Jump to the final frame; this drives the resolved target field to keyValue[1] = 0.5.
        animation.setValue("control", new BrsString("finish"));

        // The INNER poster was animated (0 -> 0.5); the container's opacity is untouched.
        expect(inner.getValueJS("opacity")).toBeCloseTo(0.5, 5);
        expect(container.getValueJS("opacity")).toBe(1);
    });

    test("interpolator resolves to its own enclosing node when no descendant matches", () => {
        // Mirrors LoadingIndicator's fade: an Animation nested inside <Group id="loadingIndicatorGroup">
        // targets "loadingIndicatorGroup.opacity" — its own parent. The target must still resolve.
        const group = SGNodeFactory.createNode("Group");
        group.setValue("id", new BrsString("loadingIndicatorGroup"));

        const animation = SGNodeFactory.createNode("Animation");
        animation.setValue("duration", new Float(0.5));
        const interp = SGNodeFactory.createNode("FloatFieldInterpolator");
        interp.setValue("fieldToInterp", new BrsString("loadingIndicatorGroup.opacity"));
        interp.setValue("key", floatArray([0.0, 1.0]));
        interp.setValue("keyValue", floatArray([1.0, 0.0])); // fade out
        animation.appendChildToParent(interp);
        group.appendChildToParent(animation);

        expect(group.getValueJS("opacity")).toBe(1);
        animation.setValue("control", new BrsString("finish"));
        expect(group.getValueJS("opacity")).toBeCloseTo(0, 5);
    });
});
