const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsString, Float } = core;

describe("Timer", () => {
    function startTimer() {
        const timer = SGNodeFactory.createNode("Timer");
        timer.setValue("duration", new Float(0));
        expect(sgRoot.timers).not.toContain(timer);
        timer.setValue("control", new BrsString("start"));
        expect(sgRoot.timers).toContain(timer);
        return timer;
    }

    test("is released from sgRoot.timers when stopped", () => {
        const timer = startTimer();
        timer.setValue("control", new BrsString("stop"));
        expect(sgRoot.timers).not.toContain(timer);
    });

    test("is released after a one-shot fire and tracked again on restart", () => {
        const timer = startTimer();
        expect(sgRoot.processTimers()).toBe(true);
        expect(sgRoot.timers).not.toContain(timer);
        timer.setValue("control", new BrsString("start"));
        expect(sgRoot.timers).toContain(timer);
        timer.setValue("control", new BrsString("stop"));
    });
});
