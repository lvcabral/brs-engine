const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory } = scenegraph;
const { BrsString, Float, Int32, RoArray } = core;

const floatArray = (nums) => new RoArray(nums.map((n) => new Float(n)));

/**
 * DEVICE-MEASURED (Streaming Stick, Roku OS 15.2) via `out/animation-control-probe`.
 *
 * `ParallelAnimation`/`SequentialAnimation` used to forward only `start` and `stop` to their
 * children. Since a container's `updateAnimation` is a no-op, `control = "finish"` flipped the
 * container's own `state` and touched no animated field at all — contradicting the reference ("All
 * animated fields will be immediately set to their final values as if the animation had completed")
 * and, as the probe confirmed, a real device. `pause` likewise left the children running while the
 * container reported `paused`.
 *
 * `control = "none"` (the reference's "initial state with no associated action") used to route to
 * `stop()`. On a device it is inert: a running animation keeps running and its fields keep advancing.
 */
describe("Animation control conformance", () => {
    /** target > animation(interpolator) — the animation drives `target.opacity` 0 → 1. */
    function makeLeaf(id, targetId) {
        const target = SGNodeFactory.createNode("Rectangle");
        target.setValue("id", new BrsString(targetId));
        target.setValue("opacity", new Float(0));

        const anim = SGNodeFactory.createNode("Animation");
        anim.setValue("id", new BrsString(id));
        anim.setValue("duration", new Float(10));
        const interp = SGNodeFactory.createNode("FloatFieldInterpolator");
        interp.setValue("fieldToInterp", new BrsString(`${targetId}.opacity`));
        interp.setValue("key", floatArray([0.0, 1.0]));
        interp.setValue("keyValue", floatArray([0.0, 1.0]));
        anim.appendChildToParent(interp);
        target.appendChildToParent(anim);
        return { target, anim };
    }

    /** A container holding `count` leaf animations, each driving its own target. */
    function makeContainer(type, count) {
        const container = SGNodeFactory.createNode(type);
        const targets = [];
        for (let i = 0; i < count; i++) {
            const { target, anim } = makeLeaf(`child${i}`, `t${type}${i}`);
            // The animation has to live under the container to be a child animation, but its
            // interpolator resolves its target by id within its own subtree — so nest the target
            // under the animation rather than the other way round.
            target.removeChildByReference(anim);
            anim.appendChildToParent(target);
            container.appendChildToParent(anim);
            targets.push(target);
        }
        return { container, targets };
    }

    const opacityOf = (node) => node.getValueJS("opacity");

    test("control='none' does not stop a running animation", () => {
        const { target, anim } = makeLeaf("a", "tNone");
        anim.setValue("control", new BrsString("start"));
        expect(anim.getValueJS("state")).toBe("running");

        anim.setValue("control", new BrsString("none"));

        // Inert: still running, and still scheduled so it keeps advancing.
        expect(anim.getValueJS("state")).toBe("running");
        expect(opacityOf(target)).toBe(0);
    });

    test("control='stop' still stops a running animation", () => {
        // Guard against over-correcting: only `none` changed, `stop` must be untouched.
        const { anim } = makeLeaf("a", "tStop");
        anim.setValue("control", new BrsString("start"));
        anim.setValue("control", new BrsString("stop"));
        expect(anim.getValueJS("state")).toBe("stopped");
    });

    test("ParallelAnimation finish sets EVERY child's target to its final value", () => {
        const { container, targets } = makeContainer("ParallelAnimation", 2);
        container.setValue("control", new BrsString("start"));
        expect(targets.every((t) => opacityOf(t) === 0)).toBe(true);

        container.setValue("control", new BrsString("finish"));

        for (const target of targets) {
            expect(opacityOf(target)).toBeCloseTo(1, 5);
        }
        expect(container.getValueJS("state")).toBe("stopped");
    });

    test("ParallelAnimation pause propagates to the children", () => {
        const { container } = makeContainer("ParallelAnimation", 2);
        container.setValue("control", new BrsString("start"));
        container.setValue("control", new BrsString("pause"));

        expect(container.getValueJS("state")).toBe("paused");
        for (const child of container.getNodeChildren()) {
            expect(child.getValueJS("state")).toBe("paused");
        }
    });

    test("ParallelAnimation resume continues the children rather than restarting them", () => {
        const { container } = makeContainer("ParallelAnimation", 2);
        container.setValue("control", new BrsString("start"));
        container.setValue("control", new BrsString("pause"));
        // Assert the precondition, or this passes vacuously: without pause propagation the children
        // were never paused, so "they are running after resume" would be trivially true.
        for (const child of container.getNodeChildren()) {
            expect(child.getValueJS("state")).toBe("paused");
        }

        container.setValue("control", new BrsString("resume"));

        expect(container.getValueJS("state")).toBe("running");
        for (const child of container.getNodeChildren()) {
            expect(child.getValueJS("state")).toBe("running");
        }
    });

    test("SequentialAnimation finish fast-forwards children that never ran", () => {
        // The headline case: finishing during child 0 must still land children 1 and 2 on their
        // final values, even though the sequence never reached them.
        const { container, targets } = makeContainer("SequentialAnimation", 3);
        container.setValue("control", new BrsString("start"));
        expect(opacityOf(targets[1])).toBe(0);
        expect(opacityOf(targets[2])).toBe(0);

        container.setValue("control", new BrsString("finish"));

        for (const target of targets) {
            expect(opacityOf(target)).toBeCloseTo(1, 5);
        }
        expect(container.getValueJS("state")).toBe("stopped");
    });

    test("SequentialAnimation pause pauses only the child that is running", () => {
        const { container } = makeContainer("SequentialAnimation", 3);
        container.setValue("control", new BrsString("start"));
        container.setValue("control", new BrsString("pause"));

        expect(container.getValueJS("state")).toBe("paused");
        const children = container.getNodeChildren();
        expect(children[0].getValueJS("state")).toBe("paused");
        // The ones the sequence has not reached stay stopped — they were never started.
        expect(children[1].getValueJS("state")).toBe("stopped");
        expect(children[2].getValueJS("state")).toBe("stopped");
    });

    test("an animation with a pending delay reports state 'stopped' until the delay elapses", () => {
        const { anim } = makeLeaf("a", "tDelay");
        anim.setValue("delay", new Float(10));

        anim.setValue("control", new BrsString("start"));

        // Publicly not running yet, even though it is scheduled and counting the delay down.
        expect(anim.getValueJS("state")).toBe("stopped");
    });

    test("an animation with no delay reports 'running' as soon as it starts", () => {
        // Control for the case above: the delay is what withholds "running", not the start itself.
        const { anim } = makeLeaf("a", "tNoDelay");
        anim.setValue("control", new BrsString("start"));
        expect(anim.getValueJS("state")).toBe("running");
    });

    /**
     * The delay-pending state lag above publishes `state = "stopped"` on an animation that is still
     * live. Containers poll their children for completion, so they must NOT read that public field —
     * `isSettled()` reports the internal state instead. Polling the field made a container treat a
     * delayed child as already finished and tear the whole group down before it ran.
     */
    describe("a pending delay must not read as completion to a container", () => {
        /** A container whose children all sit behind a delay. */
        function makeDelayedContainer(type, count, delaySeconds) {
            const container = SGNodeFactory.createNode(type);
            const targets = [];
            for (let i = 0; i < count; i++) {
                const { target, anim } = makeLeaf(`dc${i}`, `d${type}${i}`);
                anim.setValue("delay", new Float(delaySeconds));
                target.removeChildByReference(anim);
                anim.appendChildToParent(target);
                container.appendChildToParent(anim);
                targets.push(target);
            }
            return { container, targets };
        }

        test("ParallelAnimation does not stop itself when every child is still delaying", () => {
            const { container, targets } = makeDelayedContainer("ParallelAnimation", 2, 10);
            container.setValue("control", new BrsString("start"));

            container.tick();

            expect(container.getValueJS("state")).toBe("running");
            // And it did not tear the children down on the way past.
            for (const child of container.getNodeChildren()) {
                expect(child.isSettled()).toBe(false);
            }
            expect(targets.every((t) => opacityOf(t) === 0)).toBe(true);
        });

        test("SequentialAnimation waits for a delayed child instead of skipping it", () => {
            const { container } = makeDelayedContainer("SequentialAnimation", 2, 10);
            container.setValue("control", new BrsString("start"));

            container.tick();

            // The cursor must still be on child 0 — child 1 has not been started.
            const children = container.getNodeChildren();
            expect(children[0].isSettled()).toBe(false);
            expect(children[1].getValueJS("state")).toBe("stopped");
            expect(children[1].isSettled()).toBe(true);
        });

        test("a container with its own delay still reports 'running'", () => {
            // The containers override tick() and never decrement their own delay, so the state lag
            // must not apply to them — nothing would ever flip it back to "running".
            for (const type of ["ParallelAnimation", "SequentialAnimation"]) {
                const { container } = makeDelayedContainer(type, 1, 0);
                container.setValue("delay", new Float(10));
                container.setValue("control", new BrsString("start"));
                expect(container.getValueJS("state")).toBe("running");
            }
        });
    });

    test("resume does not restart a child that had already completed before the pause", () => {
        // `resume` on an animation that is not paused restarts it from the beginning, so a completed
        // child must not receive it — otherwise a mixed-duration group replays its settled part.
        const { container, targets } = makeContainer("ParallelAnimation", 2);
        container.setValue("control", new BrsString("start"));

        // Complete the first child while the group is running.
        const children = container.getNodeChildren();
        children[0].setValue("control", new BrsString("finish"));
        expect(opacityOf(targets[0])).toBeCloseTo(1, 5);
        expect(children[0].getValueJS("state")).toBe("stopped");

        container.setValue("control", new BrsString("pause"));
        container.setValue("control", new BrsString("resume"));

        // The finished child stays finished; only the one that was actually paused resumes.
        expect(children[0].getValueJS("state")).toBe("stopped");
        expect(opacityOf(targets[0])).toBeCloseTo(1, 5);
        expect(children[1].getValueJS("state")).toBe("running");
    });

    test("a non-string control write is ignored rather than throwing", () => {
        // AnimationBase guards with isBrsString; the container overrides read `control` themselves
        // and have to guard too, or a BrightScript `anim.control = 5` throws a JS TypeError out of
        // the interpreter.
        for (const type of ["ParallelAnimation", "SequentialAnimation", "Animation"]) {
            const node = SGNodeFactory.createNode(type);
            expect(() => node.setValue("control", new Int32(5))).not.toThrow();
        }
    });
});
