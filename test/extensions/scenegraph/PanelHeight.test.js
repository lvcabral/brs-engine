const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Float, RoMessagePort } = core;

/**
 * Minimal fake interpreter accepted by Node.addObserver for a port observer.
 * Port observers never enter inSubEnv (they just pushMessage), so the body is
 * irrelevant — only the shape matters.
 */
const fakeInterpreter = { environment: {}, inSubEnv: () => {} };

/**
 * Regression: per the Roku spec a Panel's height defaults to -1 and "will be set by the
 * PanelSet" when the panel is attached. The engine used to bake a fixed default height into
 * the Panel constructor and never write it at attach time, so an app observing its panel's
 * `height` field (the documented way to size panel-local UI, e.g. centering a loading
 * spinner over the panel) never got notified — the UI sized itself from height 0, rendering
 * pinned to the top of the screen.
 */
describe("PanelSet sets attached Panel height", () => {
    beforeAll(() => {
        // ListPanel builds Labels, which resolve fonts from the common: volume; mount it once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    test("a detached Panel reports the documented default height of -1", () => {
        const panel = SGNodeFactory.createNode("Panel");

        expect(panel.getValueJS("height")).toBe(-1);
    });

    test("panelSize sets width and leftPosition but not height", () => {
        const panel = SGNodeFactory.createNode("Panel");

        panel.setValue("panelSize", new BrsString("wide"));

        expect(panel.getValueJS("width")).toBe(645);
        expect(panel.getValueJS("leftPosition")).toBe(112);
        expect(panel.getValueJS("height")).toBe(-1);
    });

    test("appendChild copies the PanelSet height into the panel", () => {
        const panelSet = SGNodeFactory.createNode("PanelSet");
        const panel = SGNodeFactory.createNode("Panel");

        panelSet.appendChildToParent(panel);

        expect(panel.getValueJS("height")).toBe(panelSet.getValueJS("height"));
    });

    test("appendChild fires the panel's height observers", () => {
        const panelSet = SGNodeFactory.createNode("PanelSet");
        const panel = SGNodeFactory.createNode("Panel");
        const port = new RoMessagePort();
        const received = [];
        const originalPush = port.pushMessage.bind(port);
        port.pushMessage = (event) => {
            received.push(event);
            originalPush(event);
        };
        panel.addObserver(fakeInterpreter, "unscoped", new BrsString("height"), port);

        panelSet.appendChildToParent(panel);

        expect(received.length).toBe(1);
        expect(received[0].fieldName.getValue()).toBe("height");
        expect(received[0].fieldValue.getValue()).toBe(panelSet.getValueJS("height"));
    });

    test("the create-next-panel replace path sets the new panel's height", () => {
        const panelSet = SGNodeFactory.createNode("PanelSet");
        const menuPanel = SGNodeFactory.createNode("ListPanel");
        panelSet.appendChildToParent(menuPanel);
        menuPanel.setNodeFocus(true);
        const firstDetail = SGNodeFactory.createNode("Panel");
        menuPanel.nextPanelCallback(firstDetail);
        // With two panels attached, the next callback takes the replace branch.
        const secondDetail = SGNodeFactory.createNode("Panel");
        menuPanel.nextPanelCallback(secondDetail);

        expect(firstDetail.getValueJS("height")).toBe(panelSet.getValueJS("height"));
        expect(secondDetail.getValueJS("height")).toBe(panelSet.getValueJS("height"));
    });

    test("changing the PanelSet height re-applies it to attached panels", () => {
        const panelSet = SGNodeFactory.createNode("PanelSet");
        const panel = SGNodeFactory.createNode("Panel");
        panelSet.appendChildToParent(panel);

        panelSet.setValue("height", new Float(1080));

        expect(panel.getValueJS("height")).toBe(1080);
    });
});
