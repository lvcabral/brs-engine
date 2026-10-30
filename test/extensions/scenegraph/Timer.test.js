const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot, sgClock } = scenegraph;
const { BrsDevice, BrsBoolean, BrsString, Float, Interpreter } = core;

let fakeNow;

beforeEach(() => {
    fakeNow = 10_000;
    sgClock.setSource({ now: () => fakeNow, perfNow: () => fakeNow });
});

afterEach(() => {
    for (const timer of sgRoot.timers.slice()) {
        setControl(timer, "stop");
    }
    sgClock.setSource();
});

function setControl(timer, value) {
    timer.setValue("control", new BrsString(value));
}

function createTimer(duration, repeat = false) {
    const timer = SGNodeFactory.createNode("Timer");
    timer.setValue("duration", new Float(duration));
    timer.setValue("repeat", BrsBoolean.from(repeat));
    timer.fires = 0;
    timer.setCallback(() => timer.fires++);
    return timer;
}

function startTimer(repeat = false) {
    const timer = createTimer(1, repeat);
    setControl(timer, "start");
    return timer;
}

function tick(ms = 1000) {
    fakeNow += ms;
    return sgRoot.processTimers();
}

/**
 * A Timer is in sgRoot.timers only while it runs: from `control = "start"` until `"stop"` or a
 * one-shot fire. sgRoot.timers holds a strong reference, so a Timer left there keeps itself and
 * anything its observers or callback reach alive for the rest of the app.
 */
describe("Timer tracking in sgRoot.timers", () => {
    test("is tracked only once started, and released when stopped", () => {
        const timer = createTimer(1);
        expect(sgRoot.timers).not.toContain(timer);
        setControl(timer, "start");
        expect(sgRoot.timers).toContain(timer);
        setControl(timer, "stop");
        expect(sgRoot.timers).not.toContain(timer);
    });

    test("a one-shot timer is released after it fires and tracked again on restart", () => {
        const timer = startTimer();
        tick();
        expect(timer.fires).toBe(1);
        expect(sgRoot.timers).not.toContain(timer);

        setControl(timer, "start");
        expect(sgRoot.timers).toContain(timer);
        tick();
        expect(timer.fires).toBe(2);
    });

    test("a repeating timer stays tracked and keeps firing", () => {
        const timer = startTimer(true);
        for (let i = 1; i <= 3; i++) {
            tick();
            expect(timer.fires).toBe(i);
            expect(sgRoot.timers).toContain(timer);
        }
    });

    test("a one-shot timer restarted by its own fire stays tracked", () => {
        const timer = createTimer(1);
        timer.setCallback(() => {
            timer.fires++;
            setControl(timer, "start");
        });
        setControl(timer, "start");

        tick();
        expect(timer.fires).toBe(1);
        expect(sgRoot.timers).toContain(timer);
        tick();
        expect(timer.fires).toBe(2);
    });

    test("a timer started by another timer's fire is checked in the same pass", () => {
        const next = createTimer(0);
        const first = createTimer(1);
        first.setCallback(() => setControl(next, "start"));
        setControl(first, "start");

        tick();
        expect(next.fires).toBe(1);
        expect(sgRoot.timers).not.toContain(first);
        expect(sgRoot.timers).not.toContain(next);
    });

    test("stopping another timer from a fire does not skip the rest of the pass", () => {
        const a = createTimer(1, true);
        const b = createTimer(1, true);
        const c = createTimer(1, true);
        a.setCallback(() => {
            a.fires++;
            setControl(b, "stop");
        });
        for (const timer of [a, b, c]) {
            setControl(timer, "start");
        }

        tick();
        expect([a.fires, b.fires, c.fires]).toEqual([1, 0, 1]);
        expect(sgRoot.timers).not.toContain(b);
        expect(sgRoot.timers).toContain(a);
        expect(sgRoot.timers).toContain(c);
    });
});

/**
 * The `control` field as a device reports it, measured by test/simulator/probes/timer-control-probe.
 */
describe("Timer control field", () => {
    test("a one-shot timer reads stop after it fires, so a guarded restart runs", () => {
        const timer = startTimer();
        tick();
        expect(timer.getValueJS("control")).toBe("stop");

        if (timer.getValueJS("control") !== "start") {
            setControl(timer, "start");
        }
        tick();
        expect(timer.fires).toBe(2);
    });

    test("a one-shot timer still reads start inside its fire, and a restart there keeps it running", () => {
        const timer = startTimer();
        timer.setCallback(() => {
            timer.fires++;
            timer.controlAtFire = timer.getValueJS("control");
            if (timer.fires === 1) {
                setControl(timer, "start");
            }
        });
        tick();
        expect(timer.controlAtFire).toBe("start");
        expect(timer.getValueJS("control")).toBe("start");

        tick();
        expect(timer.fires).toBe(2);
        expect(timer.getValueJS("control")).toBe("stop");
    });

    test("a repeating timer keeps reading start", () => {
        const timer = startTimer(true);
        tick();
        expect(timer.getValueJS("control")).toBe("start");
    });

    test.each([
        ["none", "none"],
        ["foo", ""],
    ])("control = %j stops a running timer and reads %j", (value, expected) => {
        const timer = startTimer();
        setControl(timer, value);
        expect(timer.getValueJS("control")).toBe(expected);
        expect(sgRoot.timers).not.toContain(timer);
        tick();
        expect(timer.fires).toBe(0);
    });

    test("control is matched case-insensitively and reads back lowercase", () => {
        const timer = startTimer();
        setControl(timer, "STOP");
        expect(timer.getValueJS("control")).toBe("stop");
        setControl(timer, "START");
        expect(timer.getValueJS("control")).toBe("start");
        expect(sgRoot.timers).toContain(timer);
    });
});

/**
 * Video and Overhang show a clock. It is refreshed on a paint after sgRoot.processClock moves to a
 * new minute, so neither node puts anything in a global list that would keep it alive.
 */
describe("node clocks", () => {
    let originalPostMessage;
    let interpreter;
    const draw2D = new Proxy({}, { get: () => () => {} });

    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        // The Video constructor posts control/state messages to the render thread.
        originalPostMessage = global.postMessage;
        global.postMessage = vi.fn();
        interpreter = new Interpreter();
        sgRoot.processClock();
    });

    afterEach(() => {
        sgRoot.setVideo();
        global.postMessage = originalPostMessage;
    });

    test("processClock reports only a change of minute", () => {
        fakeNow = 60_000;
        sgRoot.processClock();
        expect(sgRoot.processClock()).toBe(false);
        fakeNow += 59_000;
        expect(sgRoot.processClock()).toBe(false);
        fakeNow += 1000;
        expect(sgRoot.processClock()).toBe(true);
        expect(sgRoot.processClock()).toBe(false);
    });

    describe.each(["Overhang", "Video"])("%s", (nodeType) => {
        test("does not track a Timer", () => {
            const before = sgRoot.timers.length;
            const node = SGNodeFactory.createNode(nodeType);
            node.renderNode(interpreter, [0, 0], 0, 1, draw2D);
            expect(sgRoot.timers).toHaveLength(before);
            expect(node.getNodeChildren().some((child) => child.nodeSubtype === "Timer")).toBe(false);
        });

        test("refreshes its clock on the first paint of a new minute, not on a layout pass", () => {
            const node = SGNodeFactory.createNode(nodeType);
            node.renderNode(interpreter, [0, 0], 0, 1, draw2D);
            node.clockText.setValue("text", new BrsString("stale"));

            node.renderNode(interpreter, [0, 0], 0, 1, draw2D);
            expect(node.clockText.getValueJS("text")).toBe("stale");

            fakeNow += 60_000;
            expect(sgRoot.processClock()).toBe(true);
            node.layoutNode(interpreter, [0, 0], 0, 1);
            expect(node.clockText.getValueJS("text")).toBe("stale");

            node.renderNode(interpreter, [0, 0], 0, 1, draw2D);
            expect(node.clockText.getValueJS("text")).toBe(BrsDevice.getTime());
        });
    });

    test("an Overhang with a custom clockText keeps it across a new minute", () => {
        const overhang = SGNodeFactory.createNode("Overhang");
        overhang.setValue("clockText", new BrsString("custom"));
        overhang.renderNode(interpreter, [0, 0], 0, 1, draw2D);
        expect(overhang.clockText.getValueJS("text")).toBe("custom");

        fakeNow += 60_000;
        sgRoot.processClock();
        overhang.renderNode(interpreter, [0, 0], 0, 1, draw2D);
        expect(overhang.clockText.getValueJS("text")).toBe("custom");
    });
});
