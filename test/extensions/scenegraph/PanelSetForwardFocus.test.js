const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Node, SGNodeFactory, sgRoot } = scenegraph;
const { BrsBoolean, BrsString, RoMessagePort } = core;

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
});
