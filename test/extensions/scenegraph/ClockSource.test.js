const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgClock } = scenegraph;
const { BrsString, Float, RoArray } = core;

const floatArray = (nums) => new RoArray(nums.map((n) => new Float(n)));

/**
 * The SceneGraph clock is injectable (SGClock.ts): time-driven state reads `sgClock` instead of
 * `Date.now()`/`performance.now()` so tests can substitute a deterministic source through the
 * built bundle. This also pins the animation-timing property the layout/paint split relies on:
 * animations advance in `tick()` (driven by the frame loop via sgRoot.processAnimations), NOT
 * inside renderNode — see docs/scenegraph-layout-passes.md.
 */
describe("sgClock injectable time source", () => {
    afterEach(() => {
        sgClock.setSource();
    });

    test("AnimationBase.tick interpolates against the injected clock", () => {
        let fakeNow = 10_000;
        sgClock.setSource({ now: () => fakeNow, perfNow: () => fakeNow });

        const poster = SGNodeFactory.createNode("Poster");
        poster.setValue("id", new BrsString("target"));
        poster.setValue("opacity", new Float(0));

        const animation = SGNodeFactory.createNode("Animation");
        animation.setValue("duration", new Float(2)); // seconds
        const interp = SGNodeFactory.createNode("FloatFieldInterpolator");
        interp.setValue("fieldToInterp", new BrsString("target.opacity"));
        interp.setValue("key", floatArray([0.0, 1.0]));
        interp.setValue("keyValue", floatArray([0.0, 1.0]));
        animation.appendChildToParent(interp);
        poster.appendChildToParent(animation);

        // Linear easing so the eased fraction equals the raw fraction at the midpoint.
        animation.setValue("easeFunction", new BrsString("linear"));
        animation.setValue("control", new BrsString("start"));

        // Fraction 0: no time has passed.
        animation.tick();
        expect(poster.getValueJS("opacity")).toBeCloseTo(0, 5);

        // Fraction 0.5: half the 2s duration.
        fakeNow += 1000;
        animation.tick();
        expect(poster.getValueJS("opacity")).toBeCloseTo(0.5, 5);

        // Fraction 1: full duration reached; the animation stops at the end value.
        fakeNow += 1000;
        animation.tick();
        expect(poster.getValueJS("opacity")).toBeCloseTo(1, 5);
        expect(animation.getValueJS("state")).toBe("stopped");
    });

    test("setSource() with no argument restores the real clock", () => {
        sgClock.setSource({ now: () => 42, perfNow: () => 42 });
        expect(sgClock.now()).toBe(42);

        sgClock.setSource();

        const realNow = Date.now();
        expect(Math.abs(sgClock.now() - realNow)).toBeLessThan(1000);
    });
});
