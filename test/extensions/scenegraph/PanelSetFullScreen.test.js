const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsBoolean, BrsDevice, Float, Interpreter } = core;

/**
 * Regression: a Panel with isFullScreen=true assigned as a menu panel's nextPanel (the
 * create-next-panel preview flow) was immediately given the full-screen layout — placed at its
 * own leftPosition (the left side of the PanelSet) with the left menu panel not rendered — so
 * the preview covered the menu list. Per the Roku Panel.isFullScreen contract, a full-screen
 * panel "takes up both the left and right positions" only once it is the displayed (focused)
 * panel; as an unfocused preview it sits on the right like any other panel. The preview append
 * must also not move focus off the menu panel.
 */
describe("PanelSet full-screen panel as a nextPanel preview", () => {
    let interpreter;

    beforeAll(() => {
        // ListPanel builds Labels, which resolve fonts from the common: volume; mount it once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    function buildPanelSet() {
        const panelSet = SGNodeFactory.createNode("PanelSet");
        const menuPanel = SGNodeFactory.createNode("ListPanel");
        menuPanel.setValue("leftPosition", new Float(0));
        menuPanel.setValue("width", new Float(437));
        menuPanel.setValue("leftOnly", BrsBoolean.True);
        panelSet.appendChildToParent(menuPanel);
        menuPanel.setNodeFocus(true);
        const fullPanel = SGNodeFactory.createNode("Panel");
        fullPanel.setValue("isFullScreen", BrsBoolean.True);
        // Simulate the app assigning nextPanel during createNextPanelIndex dispatch: the
        // PanelSet wires this callback on the menu panel at append time.
        menuPanel.nextPanelCallback(fullPanel);
        return { panelSet, menuPanel, fullPanel };
    }

    test("an unfocused full-screen preview renders on the right of the menu panel", () => {
        const { panelSet, menuPanel, fullPanel } = buildPanelSet();

        panelSet.renderNode(interpreter, [0, 0], 0, 1);

        // 0 (menu leftPosition) + 437 (menu width) + 30 (HD gap) — NOT the panel's own
        // leftPosition (narrow default 105), and the menu stays where it was.
        expect(menuPanel.getValueJS("translation")[0]).toBe(0);
        expect(fullPanel.getValueJS("translation")[0]).toBe(467);
    });

    test("appending the preview keeps focus on the menu panel", () => {
        const { menuPanel } = buildPanelSet();

        expect(sgRoot.focused).toBe(menuPanel);
    });

    test("the full-screen panel takes over both positions once focused", () => {
        const { panelSet, fullPanel } = buildPanelSet();

        panelSet.handleKey("right", true);
        panelSet.renderNode(interpreter, [0, 0], 0, 1);

        expect(sgRoot.focused).toBe(fullPanel);
        // Focused full-screen panel keeps the existing behavior: its own leftPosition.
        expect(fullPanel.getValueJS("translation")[0]).toBe(105);
    });

    test("appending a next panel keeps focus inside the already-focused panel", () => {
        // Mirrors the multi-account settings flow: after moving right onto the (full-screen)
        // selector panel, the app's focusedChild observer forwards focus to a list nested inside
        // it (not assigned to the ListPanel's `list` field), and that list's itemFocused observer
        // appends the third detail panel. refreshFocus used to re-focus the selector panel itself,
        // stealing focus from the inner list — leaving the panel without a visibly focused list
        // until a second right press.
        const { panelSet, fullPanel } = buildPanelSet();
        const offsetGroup = SGNodeFactory.createNode("Group");
        const innerList = SGNodeFactory.createNode("MarkupGrid");
        offsetGroup.appendChildToParent(innerList);
        fullPanel.appendChildToParent(offsetGroup);

        panelSet.handleKey("right", true);
        expect(sgRoot.focused).toBe(fullPanel);
        // The app forwards focus into the nested list...
        innerList.setNodeFocus(true);
        // ...and appends the next detail panel; focus must stay on the inner list.
        const detailPanel = SGNodeFactory.createNode("Panel");
        panelSet.appendChildToParent(detailPanel);
        expect(sgRoot.focused).toBe(innerList);

        // A further right press still moves focus to the detail panel.
        panelSet.handleKey("right", true);
        expect(sgRoot.focused).toBe(detailPanel);
    });

    test("going back from the last panel keeps it as the right panel (left/right round trip)", () => {
        // With three panels [menu, selector, detail] and focus on the detail panel, pressing left
        // must NOT remove the detail panel: it did not slide off the right edge — it remains the
        // right panel of the visible pair, so a following right press reaches it again. goBack
        // used to pop the trailing panel unconditionally whenever more than two panels existed,
        // making the detail panel vanish on the first left press.
        const { panelSet, fullPanel } = buildPanelSet();
        panelSet.handleKey("right", true);
        const detailPanel = SGNodeFactory.createNode("Panel");
        panelSet.appendChildToParent(detailPanel);
        panelSet.handleKey("right", true);
        expect(sgRoot.focused).toBe(detailPanel);

        // Left: back to the selector panel; the detail panel must survive as the right panel.
        panelSet.handleKey("left", true);
        expect(sgRoot.focused).toBe(fullPanel);
        expect(detailPanel.getNodeParent()).toBe(panelSet);

        // Right again: the detail panel is still there and regains focus.
        panelSet.handleKey("right", true);
        expect(sgRoot.focused).toBe(detailPanel);
    });

    test("going back to the first panel removes panels that slid off the right edge", () => {
        // From [menu, selector, detail] focused on the selector, pressing left slides the pair to
        // [menu, selector]: the detail panel goes past the right edge and is auto-removed (Roku
        // contract: panels that slide fully offscreen to the right are removed as children).
        const { panelSet, menuPanel, fullPanel } = buildPanelSet();
        panelSet.handleKey("right", true);
        const detailPanel = SGNodeFactory.createNode("Panel");
        panelSet.appendChildToParent(detailPanel);
        panelSet.handleKey("right", true);

        panelSet.handleKey("left", true);
        panelSet.handleKey("left", true);
        expect(sgRoot.focused).toBe(menuPanel);
        expect(detailPanel.getNodeParent()).not.toBe(panelSet);
        expect(fullPanel.getNodeParent()).toBe(panelSet);
    });

    test("a full-screen panel added via direct appendChild still takes over immediately", () => {
        const panelSet = SGNodeFactory.createNode("PanelSet");
        const menuPanel = SGNodeFactory.createNode("ListPanel");
        menuPanel.setValue("leftPosition", new Float(0));
        panelSet.appendChildToParent(menuPanel);
        menuPanel.setNodeFocus(true);
        const fullPanel = SGNodeFactory.createNode("Panel");
        fullPanel.setValue("isFullScreen", BrsBoolean.True);
        panelSet.appendChildToParent(fullPanel);

        panelSet.renderNode(interpreter, [0, 0], 0, 1);

        expect(sgRoot.focused).toBe(fullPanel);
        expect(fullPanel.getValueJS("translation")[0]).toBe(105);
    });
});
