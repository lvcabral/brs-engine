const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Node, SGNodeFactory, sgRoot } = scenegraph;
const { BrsBoolean, BrsString, Interpreter, RoMessagePort } = core;

/** Calls the node's `isInFocusChain()` BrightScript method. */
function isInFocusChain(node) {
    const interpreter = new Interpreter();
    return interpreter.call(node.getMethod("isinfocuschain"), [], node.m, interpreter.location).toBoolean();
}

/** Minimal fake interpreter accepted by Field.addObserver for a port observer. */
const fakeInterpreter = { environment: {}, inSubEnv: () => {} };
const focusedChildFieldArg = { getValue: () => "focusedChild", toString: () => "focusedChild" };

/** Whether `node` is `ancestor` or sits inside its subtree. */
function isWithin(node, ancestor) {
    let current = node;
    while (current instanceof Node) {
        if (current === ancestor) {
            return true;
        }
        current = current.getNodeParent();
    }
    return false;
}

/**
 * PanelSet key navigation with a panel that forwards its focus to an inner node — the common app pattern
 * of a details panel whose `focusedChild` observer calls `grid.setFocus(true)` on a gain and tears its UI
 * down when it leaves the focus chain.
 */
describe("PanelSet navigation with a panel that forwards its focus", () => {
    afterEach(() => {
        sgRoot.setFocused();
        sgRoot.setLastFocusTarget();
    });

    function makePanel(id) {
        const panel = SGNodeFactory.createNode("Panel");
        panel.setValue("id", new BrsString(id));
        panel.setValue("focusable", BrsBoolean.True);
        return panel;
    }

    /** A details panel with a nested inner node; its focusedChild observer forwards to it and logs. */
    function forwardingPanel(log) {
        const panel = makePanel("details");
        const wrapper = new Node([], "Group");
        const inner = new Node([], "Group");
        inner.setValue("focusable", BrsBoolean.True, false);
        wrapper.appendChildToParent(inner);
        panel.appendChildToParent(wrapper);
        const port = new RoMessagePort();
        const originalPush = port.pushMessage.bind(port);
        port.pushMessage = (event) => {
            if (panel.getValue("focusedchild") === panel) {
                log.push("gain");
                // A BrightScript setFocus(true): the call becomes the last target once it returns.
                inner.setNodeFocus(true);
                sgRoot.setLastFocusTarget(inner);
            } else if (!isWithin(sgRoot.focused, panel)) {
                log.push("lost");
            }
            originalPush(event);
        };
        panel.fields.get("focusedchild").addObserver("permanent", fakeInterpreter, port, panel, focusedChildFieldArg);
        return { panel, wrapper, inner };
    }

    test("going back clears the forwarded chain, and going forward again re-enters it", () => {
        const log = [];
        const panelSet = SGNodeFactory.createNode("PanelSet");
        const menu = makePanel("menu");
        const { panel: details, wrapper, inner } = forwardingPanel(log);
        panelSet.appendChildToParent(menu);
        menu.setNodeFocus(true);
        sgRoot.setLastFocusTarget(menu);
        panelSet.appendChildToParent(details);

        panelSet.handleKey("right", true);
        expect(sgRoot.focused).toBe(inner);
        expect(log).toEqual(["gain"]);

        // Before the fix the PanelSet unfocused the panel itself, cutting only its link in the middle of
        // the chain: the next setFocus skipped it, so its observer never saw it leave the chain.
        panelSet.handleKey("left", true);
        expect(sgRoot.focused).toBe(menu);
        expect(log).toEqual(["gain", "lost"]);
        expect(details.getValue("focusedchild")).not.toBeInstanceOf(Node);
        expect(inner.getValue("focusedchild")).not.toBeInstanceOf(Node);

        // Before the fix the inner node was still the last setFocus target, so the forward wrote only its
        // self-link and the live focus stayed on the panel: the remote no longer reached the inner node.
        panelSet.handleKey("right", true);
        expect(log).toEqual(["gain", "lost", "gain"]);
        expect(sgRoot.focused).toBe(inner);
        expect(details.getValue("focusedchild")).toBe(wrapper);
        expect(inner.getValue("focusedchild")).toBe(inner);
    });

    /** A details panel whose gain observer bounces the focus to `menu` (optionally unfocusing itself first). */
    function bouncingPanel(menu, unfocusFirst) {
        const panel = makePanel("details");
        const port = new RoMessagePort();
        panel.bounces = 0;
        port.pushMessage = () => {
            if (panel.getValue("focusedchild") !== panel) {
                return;
            }
            panel.bounces++;
            if (unfocusFirst) {
                panel.setNodeFocus(false);
            }
            menu.setNodeFocus(true);
            sgRoot.setLastFocusTarget(menu);
        };
        panel.fields.get("focusedchild").addObserver("permanent", fakeInterpreter, port, panel, focusedChildFieldArg);
        return panel;
    }

    function menuPanelSet() {
        const scene = new Node([], "Group");
        const panelSet = SGNodeFactory.createNode("PanelSet");
        const menu = makePanel("menu");
        scene.appendChildToParent(panelSet);
        panelSet.appendChildToParent(menu);
        menu.setNodeFocus(true);
        sgRoot.setLastFocusTarget(menu);
        return { scene, panelSet, menu };
    }

    test("a panel that bounces the focus back to the menu on its gain leaves the menu focused", () => {
        // panelset-bounce-focus-probe `bounce` (OS 16.0.4): a details panel with nothing to focus yet calls
        // setFocus(false) on itself, then setFocus(true) on the menu. The PanelSet's move writes only the
        // panel's self-link before notifying it, so the menu's call lands on the intact chain and the move
        // doesn't complete. Before, the menu's call wrote only its own subtree and nothing kept the focus.
        const { scene, panelSet, menu } = menuPanelSet();
        const details = bouncingPanel(menu, true);
        panelSet.appendChildToParent(details);

        panelSet.handleKey("right", true);
        expect(details.bounces).toBe(1);
        expect(sgRoot.focused).toBe(menu);
        expect(scene.getValue("focusedchild")).toBe(panelSet);
        expect(panelSet.getValue("focusedchild")).toBe(menu);
        expect(details.getValue("focusedchild")).not.toBeInstanceOf(Node);
    });

    test("the panel reports isInFocusChain() while its gain is notified, so a gated forward lands", () => {
        // panelset-bounce-focus-probe `chainGate` (OS 16.0.4): during the move's first phase the panel's
        // observer sees hasFocus() and isInFocusChain() both true, though the live focus is still on the
        // menu. A handler that forwards only `if m.top.isInFocusChain()` must still reach its list.
        const { panelSet } = menuPanelSet();
        const details = makePanel("details");
        const inner = new Node([], "Group");
        inner.setValue("focusable", BrsBoolean.True, false);
        details.appendChildToParent(inner);
        const seen = [];
        const port = new RoMessagePort();
        port.pushMessage = () => {
            const inChain = isInFocusChain(details);
            seen.push(inChain);
            if (inChain && details.getValue("focusedchild") === details) {
                inner.setNodeFocus(true);
            }
        };
        details.fields
            .get("focusedchild")
            .addObserver("permanent", fakeInterpreter, port, details, focusedChildFieldArg);
        panelSet.appendChildToParent(details);

        panelSet.handleKey("right", true);
        expect(seen[0]).toBe(true);
        expect(sgRoot.focused).toBe(inner);
        expect(sgRoot.pendingPanelFocus).toBeUndefined();
    });

    test("a gain observer that leaves the focus on the menu's chain still completes the move", () => {
        // panelset-bounce-focus-probe `noUnfocus`: the panel keeps its self-link and the menu's setFocus
        // changes nothing, so the PanelSet completes the move: the panel takes the focus and the menu's
        // links are cleared.
        const { panelSet, menu } = menuPanelSet();
        const details = bouncingPanel(menu, false);
        panelSet.appendChildToParent(details);

        panelSet.handleKey("right", true);
        expect(details.bounces).toBe(1);
        expect(sgRoot.focused).toBe(details);
        expect(panelSet.getValue("focusedchild")).toBe(details);
        expect(menu.getValue("focusedchild")).not.toBeInstanceOf(Node);
    });
});
