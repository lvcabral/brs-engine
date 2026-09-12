const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory } = scenegraph;
const { BrsString, Float, RoArray } = core;

const floatArray = (nums) => new RoArray(nums.map((n) => new Float(n)));
const nestedFloatArray = (rows) => new RoArray(rows.map(floatArray));

/**
 * FloatArrayFieldInterpolator (Roku OS 16) animates fields that hold arrays of floats, such as
 * `Effect.borderRadius`. Each keyValue entry is itself an array of floats, interpolated piecewise
 * against the corresponding entry in the adjacent keyframe.
 */
describe("FloatArrayFieldInterpolator", () => {
    test("blends each array entry independently between two keyframes", () => {
        // The Effect and the Animation driving it must both be part of the same visible tree for
        // the interpolator's "id.field" lookup to resolve - confirmed on a real device, where a
        // node only reachable via a scalar field reference (e.g. `poster.effect = effect`, never
        // appended as a child anywhere) is NOT found ("Could not find node ... to update the
        // interpolator field on"). A common parent Group is enough to make it resolvable.
        const container = SGNodeFactory.createNode("Group");
        const effect = SGNodeFactory.createNode("Effect");
        effect.setValue("id", new BrsString("itemEffect"));
        effect.setValue("borderRadius", floatArray([8, 8, 8, 32]));

        const animation = SGNodeFactory.createNode("Animation");
        animation.setValue("duration", new Float(0.4));
        const interp = SGNodeFactory.createNode("FloatArrayFieldInterpolator");
        interp.setValue("fieldToInterp", new BrsString("itemEffect.borderRadius"));
        interp.setValue("key", floatArray([0.0, 1.0]));
        interp.setValue(
            "keyValue",
            nestedFloatArray([
                [8, 8, 8, 32],
                [8, 8, 8, 8],
            ])
        );
        animation.appendChildToParent(interp);
        container.appendChildToParent(effect);
        container.appendChildToParent(animation);

        // Halfway through, each entry should be halfway between its start and end value.
        interp.setValue("fraction", new Float(0.5));
        expect(interp.interpolate(0.5).elements.map((el) => el.getValue())).toEqual([8, 8, 8, 20]);

        animation.setValue("control", new BrsString("finish"));
        const end = effect.getValueJS("borderRadius");
        end.forEach((value, i) => expect(value).toBeCloseTo([8, 8, 8, 8][i], 5));
    });

    test("a single keyframe holds its value for any fraction", () => {
        const interp = SGNodeFactory.createNode("FloatArrayFieldInterpolator");
        interp.setValue("keyValue", nestedFloatArray([[1, 2, 3]]));

        expect(interp.getValueJS("keyValue")).toEqual([[1, 2, 3]]);
        const result = interp.interpolate(0.25);
        expect(result.elements.map((el) => el.getValue())).toEqual([1, 2, 3]);
    });

    test("mismatched array lengths between keyframes are skipped, like a type mismatch", () => {
        const interp = SGNodeFactory.createNode("FloatArrayFieldInterpolator");
        interp.setValue("key", floatArray([0.0, 1.0]));
        interp.setValue(
            "keyValue",
            nestedFloatArray([
                [1, 2, 3],
                [1, 2],
            ])
        );

        expect(interp.interpolate(0.5)).toBeUndefined();
    });
});
