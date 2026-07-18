const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsBoolean, Float, Interpreter } = core;

/**
 * Regression: PanelSet right-panel spacing. Per the Roku spec, when two panels are onscreen the
 * right panel's origin is (leftPosition + leftWidth + spacing), where leftPosition and leftWidth
 * are the LEFT panel's fields (spacing: 30 px HD). The engine used the RIGHT panel's own
 * leftPosition instead, so an app that sets leftPosition = 0 only on its left menu panel (the
 * right panel keeping the "narrow" default of 105) rendered the right panel ~105 px (HD) too far
 * right — a visibly larger gap than a real device.
 */
describe("PanelSet positions the right panel from the left panel's fields", () => {
    let interpreter;

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    function buildPanelSet() {
        const panelSet = SGNodeFactory.createNode("PanelSet");
        const leftPanel = SGNodeFactory.createNode("Panel");
        leftPanel.setValue("leftPosition", new Float(0));
        leftPanel.setValue("width", new Float(437));
        leftPanel.setValue("leftOnly", BrsBoolean.True);
        const rightPanel = SGNodeFactory.createNode("Panel");
        // rightPanel keeps the Panel defaults: panelSize "narrow" -> leftPosition 105 (HD).
        panelSet.appendChildToParent(leftPanel);
        panelSet.appendChildToParent(rightPanel);
        return { panelSet, leftPanel, rightPanel };
    }

    test("right panel x = left leftPosition + left width + default gap", () => {
        const { panelSet, leftPanel, rightPanel } = buildPanelSet();

        panelSet.renderNode(interpreter, [0, 0], 0, 1);

        expect(leftPanel.getValueJS("translation")[0]).toBe(0);
        // 0 (left leftPosition) + 437 (left width) + 30 (HD gap) — NOT 105 + 437 + 30.
        expect(rightPanel.getValueJS("translation")[0]).toBe(467);
    });

    test("the right panel's own leftPosition does not shift it", () => {
        const { panelSet, rightPanel } = buildPanelSet();
        rightPanel.setValue("leftPosition", new Float(300));

        panelSet.renderNode(interpreter, [0, 0], 0, 1);

        expect(rightPanel.getValueJS("translation")[0]).toBe(467);
    });

    test("a lone left panel sits at its own leftPosition", () => {
        const panelSet = SGNodeFactory.createNode("PanelSet");
        const leftPanel = SGNodeFactory.createNode("Panel");
        leftPanel.setValue("leftPosition", new Float(60));
        panelSet.appendChildToParent(leftPanel);

        panelSet.renderNode(interpreter, [0, 0], 0, 1);

        expect(leftPanel.getValueJS("translation")[0]).toBe(60);
    });
});
