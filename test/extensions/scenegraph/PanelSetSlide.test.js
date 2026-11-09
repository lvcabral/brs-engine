const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot, sgClock } = scenegraph;
const { BrsBoolean, BrsString, Float, RoMessagePort } = core;

/**
 * PanelSet slide transition, pinned to a device trace (Roku Express 4K+, OS 16.0,
 * test/simulator/probes/panelset-slide-probe/device-trace-os16.0.txt).
 *
 * The device moves every panel with its own quintic ease-out lasting `slideDuration`, staggered by
 * role (leading edge +5 ms, slot-changing panel +80 ms, arriving panel +115 ms), writes `translation`
 * every frame, keeps `slidingStatus` true until all panels are within 0.1 px of their slot, and only
 * removes a panel that slid off the right once the slide ends. Checkpoint x values below are read
 * off the device trace; the tolerance absorbs frame-phase differences.
 */
describe("PanelSet slide transition", () => {
    const fakeInterpreter = { environment: {}, inSubEnv: () => {} };
    const tolerance = 20;
    let now;
    let log;

    beforeEach(() => {
        now = 100_000;
        sgClock.setSource({ now: () => now, perfNow: () => now });
        sgRoot.uiTransitionsEnabled = true;
        log = [];
    });

    afterEach(() => {
        sgClock.setSource();
        sgRoot.uiTransitionsEnabled = false;
        sgRoot.setFocused();
    });

    /** Advances the fake clock in ~60 fps steps, ticking the render loop's transitions each frame. */
    function advance(ms, step = 16) {
        const end = now + ms;
        while (now < end) {
            now = Math.min(end, now + step);
            sgRoot.processTransitions();
        }
    }

    function observe(node, label, fields) {
        const port = new RoMessagePort();
        const originalPush = port.pushMessage.bind(port);
        port.pushMessage = (event) => {
            const value = event.fieldValue?.getValue?.();
            log.push(`${label}.${event.fieldName.getValue()}=${value}`);
            originalPush(event);
        };
        for (const field of fields) {
            node.addObserver(fakeInterpreter, "unscoped", new BrsString(field), port);
        }
    }

    function makePanel(id, size) {
        const panel = SGNodeFactory.createNode("Panel");
        panel.setValue("id", new BrsString(id));
        panel.setValue("panelSize", new BrsString(size));
        return panel;
    }

    const x = (panel) => panel.getValueJS("translation")[0];

    /** A (narrow) + B (wide), focus on A, initial placement settled — the probe's starting state. */
    function buildPair() {
        const panelSet = SGNodeFactory.createNode("PanelSet");
        const a = makePanel("A", "narrow");
        const b = makePanel("B", "wide");
        panelSet.appendChildToParent(a);
        a.setNodeFocus(true);
        panelSet.appendChildToParent(b);
        advance(700);
        return { panelSet, a, b };
    }

    test("the second panel is placed straight into the right slot", () => {
        const { panelSet, a, b } = buildPair();
        expect(x(a)).toBe(104);
        // 104 (A leftPosition) + 388 (A width) + 40 (HD gap)
        expect(x(b)).toBe(532);
        expect(panelSet.getValueJS("slidingStatus")).toBe(false);
    });

    test("forward slide: staggered quintic ease-out to the new pair", () => {
        const { panelSet, a, b } = buildPair();
        observe(panelSet, "ps", ["slidingStatus", "numPanels"]);
        observe(a, "A", ["isOffscreenLeft"]);

        expect(panelSet.handleKey("right", true)).toBe(true);
        expect(sgRoot.focused).toBe(b);
        // The app's focusedChild observer appends the next panel.
        const c = makePanel("C", "narrow");
        panelSet.appendChildToParent(c);
        // Placed just past the right edge at append time; the slide starts on the next frame.
        expect(x(c)).toBe(1280);
        expect(log).toEqual(["ps.numPanels=3"]);
        expect(panelSet.getValueJS("leftPanelIndex")).toBe(1);
        expect(panelSet.getValueJS("slidingStatus")).toBe(false);

        advance(16);
        expect(panelSet.getValueJS("slidingStatus")).toBe(true);
        // The slide starts on the frame that raises slidingStatus — the device trace's time origin.
        const start = now;
        // Device trace slide 1 (status true at 3065): +109 ms A=-240.4 B=413.7 C=2320 (not moving).
        advance(start + 109 - now);
        expect(Math.abs(x(a) - -240.4)).toBeLessThan(tolerance);
        expect(Math.abs(x(b) - 413.7)).toBeLessThan(tolerance);
        expect(x(c)).toBe(1280);
        // +209 ms: A=-354 B=202.7 C=1308.7 (from 2320 on the device; ours enters from 1280).
        advance(start + 209 - now);
        expect(Math.abs(x(a) - -354)).toBeLessThan(tolerance);
        expect(Math.abs(x(b) - 202.7)).toBeLessThan(tolerance);
        expect(x(c)).toBeLessThan(1100);
        expect(panelSet.getValueJS("slidingStatus")).toBe(true);

        advance(start + 700 - now);
        expect(x(a)).toBe(-388);
        expect(x(b)).toBe(112);
        // 112 (B leftPosition) + 645 (B width) + 40
        expect(x(c)).toBe(797);
        // slidingStatus falls once every panel settles, then A is flagged offscreen.
        expect(log).toEqual([
            "ps.numPanels=3",
            "ps.slidingStatus=true",
            "ps.slidingStatus=false",
            "A.isOffscreenLeft=true",
        ]);
    });

    test("back slide: isGoingBack pulses, numPanels drops at once, the exiting panel leaves at the end", () => {
        const { panelSet, a, b } = buildPair();
        panelSet.handleKey("right", true);
        const c = makePanel("C", "narrow");
        panelSet.appendChildToParent(c);
        advance(700);
        observe(panelSet, "ps", ["isGoingBack", "numPanels", "slidingStatus", "leftPanelIndex"]);
        observe(a, "A", ["isOffscreenLeft"]);

        expect(panelSet.handleKey("left", true)).toBe(true);
        expect(sgRoot.focused).toBe(a);
        // DEVICE order: isGoingBack=true, numPanels, slidingStatus=true, leftPanelIndex, isGoingBack=false.
        expect(log).toEqual([
            "ps.isGoingBack=true",
            "ps.numPanels=2",
            "ps.slidingStatus=true",
            "ps.leftPanelIndex=0",
            "ps.isGoingBack=false",
        ]);
        // C slides off the right before it is removed.
        expect(c.getNodeParent()).toBe(panelSet);

        advance(16);
        // A's right edge is already at x = 0: isOffscreenLeft clears on the first frame.
        expect(log.at(-1)).toBe("A.isOffscreenLeft=false");
        advance(700);
        expect(x(a)).toBe(104);
        expect(x(b)).toBe(532);
        expect(c.getNodeParent()).not.toBe(panelSet);
        expect(log.at(-1)).toBe("ps.slidingStatus=false");
    });

    test("a panel re-appended while it slides off stays a child and is listed once", () => {
        const { panelSet } = buildPair();
        panelSet.handleKey("right", true);
        const c = makePanel("C", "narrow");
        panelSet.appendChildToParent(c);
        advance(700);
        panelSet.handleKey("left", true);
        advance(100);
        panelSet.appendChildToParent(c);
        advance(1500);
        expect(c.getNodeParent()).toBe(panelSet);
        expect(panelSet.panels.filter((panel) => panel === c)).toHaveLength(1);
        expect(panelSet.getValueJS("numPanels")).toBe(3);
    });

    test("a key mid-slide retargets from the current positions within one slidingStatus pulse", () => {
        const { panelSet, a, b } = buildPair();
        observe(panelSet, "ps", ["slidingStatus"]);
        panelSet.handleKey("right", true);
        const c = makePanel("C", "narrow");
        panelSet.appendChildToParent(c);
        advance(225);
        const midA = x(a);
        expect(midA).toBeLessThan(-300);

        panelSet.handleKey("left", true);
        advance(16);
        // No snap: A is still near where the forward slide left it (it trails the back slide).
        expect(Math.abs(x(a) - midA)).toBeLessThan(1);
        advance(800);
        expect(x(a)).toBe(104);
        expect(x(b)).toBe(532);
        expect(c.getNodeParent()).not.toBe(panelSet);
        expect(log).toEqual(["ps.slidingStatus=true", "ps.slidingStatus=false"]);
    });

    test("a full-screen panel counts twice, takes over, and going back focuses the panel before it", () => {
        const { panelSet, a, b } = buildPair();
        observe(panelSet, "ps", ["numPanels"]);
        const f = makePanel("F", "full");
        f.setValue("isFullScreen", BrsBoolean.True);
        panelSet.appendChildToParent(f);
        expect(log).toEqual(["ps.numPanels=3", "ps.numPanels=4"]);
        expect(sgRoot.focused).toBe(f);
        expect(x(f)).toBe(1280);

        advance(700);
        expect(x(f)).toBe(170);
        expect(x(b)).toBe(-645);
        // 645 + 40 + 388 to the left of B
        expect(x(a)).toBe(-1073);
        expect(a.getValueJS("isOffscreenLeft")).toBe(true);
        expect(b.getValueJS("isOffscreenLeft")).toBe(true);

        panelSet.handleKey("left", true);
        expect(sgRoot.focused).toBe(b);
        expect(panelSet.getValueJS("numPanels")).toBe(2);
        advance(800);
        expect(x(a)).toBe(104);
        expect(x(b)).toBe(532);
        expect(f.getNodeParent()).not.toBe(panelSet);
    });

    test("slideDuration is in seconds and stretches each panel's motion", () => {
        const { panelSet, a } = buildPair();
        panelSet.setValue("slideDuration", new Float(1.5));
        panelSet.handleKey("right", true);
        panelSet.appendChildToParent(makePanel("C", "narrow"));
        advance(700);
        // Still moving at 0.7 s of a 1.5 s slide.
        expect(panelSet.getValueJS("slidingStatus")).toBe(true);
        expect(x(a)).toBeGreaterThan(-388);
        advance(900);
        expect(x(a)).toBe(-388);
        expect(panelSet.getValueJS("slidingStatus")).toBe(false);
    });

    test("arrows hide while sliding", () => {
        const { panelSet, b } = buildPair();
        b.setValue("hasNextPanel", BrsBoolean.True);
        const interpreter = new core.Interpreter();
        panelSet.renderNode(interpreter, [0, 0], 0, 1);
        const rightArrow = panelSet.getNodeChildren()[1];
        expect(rightArrow.getValueJS("visible")).toBe(true);

        panelSet.handleKey("right", true);
        panelSet.appendChildToParent(makePanel("C", "narrow"));
        advance(16);
        rightArrow.setValueSilent("visible", BrsBoolean.False);
        panelSet.renderNode(interpreter, [0, 0], 0, 1);
        expect(rightArrow.getValueJS("visible")).toBe(false);
    });

    test("with transitions off the layout jumps and slidingStatus pulses once", () => {
        sgRoot.uiTransitionsEnabled = false;
        const panelSet = SGNodeFactory.createNode("PanelSet");
        const a = makePanel("A", "narrow");
        const b = makePanel("B", "wide");
        panelSet.appendChildToParent(a);
        a.setNodeFocus(true);
        panelSet.appendChildToParent(b);
        const interpreter = new core.Interpreter();
        panelSet.renderNode(interpreter, [0, 0], 0, 1);
        observe(panelSet, "ps", ["slidingStatus"]);

        panelSet.handleKey("right", true);
        const c = makePanel("C", "narrow");
        panelSet.appendChildToParent(c);
        panelSet.renderNode(interpreter, [0, 0], 0, 1);
        expect(x(a)).toBe(-388);
        expect(x(b)).toBe(112);
        expect(x(c)).toBe(797);
        expect(log).toEqual(["ps.slidingStatus=true", "ps.slidingStatus=false"]);

        panelSet.handleKey("left", true);
        // Removed at once: there is no slide to wait for.
        expect(c.getNodeParent()).not.toBe(panelSet);
    });

    test("with transitions off a navigation settles inside the call, even on a PanelSet never drawn", () => {
        // Not from the next paint: observers would run mid-frame, and a hidden PanelSet never paints.
        sgRoot.uiTransitionsEnabled = false;
        const panelSet = SGNodeFactory.createNode("PanelSet");
        const a = makePanel("A", "narrow");
        const b = makePanel("B", "wide");
        panelSet.appendChildToParent(a);
        a.setNodeFocus(true);
        panelSet.appendChildToParent(b);
        observe(panelSet, "ps", ["slidingStatus"]);

        panelSet.handleKey("right", true);
        const c = makePanel("C", "narrow");
        panelSet.appendChildToParent(c);
        expect(x(a)).toBe(-388);
        expect(x(c)).toBe(797);
        expect(log).toEqual(["ps.slidingStatus=true", "ps.slidingStatus=false"]);
        panelSet.handleKey("left", true);
        expect(c.getNodeParent()).not.toBe(panelSet);
        expect(log.filter((entry) => entry === "ps.slidingStatus=false")).toHaveLength(2);
    });
});
