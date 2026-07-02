const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Int32 } = core;

describe("Video bufferingBar and retrievingBar fields", () => {
    let originalPostMessage;

    beforeAll(() => {
        // Video builds labels/posters/spinner from the common: volume; mount it once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        // The Video constructor posts control/state messages to the render thread.
        originalPostMessage = global.postMessage;
        global.postMessage = jest.fn();
    });

    afterEach(() => {
        global.postMessage = originalPostMessage;
    });

    test("both fields expose a default ProgressBar node instance (not invalid)", () => {
        const video = SGNodeFactory.createNode("Video");
        const bufferingBar = video.getValue("bufferingBar");
        const retrievingBar = video.getValue("retrievingBar");

        expect(bufferingBar).toBeDefined();
        expect(retrievingBar).toBeDefined();
        expect(bufferingBar.nodeSubtype).toBe("ProgressBar");
        expect(retrievingBar.nodeSubtype).toBe("ProgressBar");
    });

    test("the default ProgressBar sub-fields match the spec", () => {
        const video = SGNodeFactory.createNode("Video");
        const bar = video.getValue("bufferingBar");

        expect(bar.getValueJS("width")).toBe(0);
        expect(bar.getValueJS("height")).toBe(0);
        expect(bar.getValueJS("emptyBarBlendColor") >>> 0).toBe(0xffffffff);
        expect(bar.getValueJS("emptyBarImageUri")).toBe("");
        expect(bar.getValueJS("filledBarBlendColor") >>> 0).toBe(0xffffffff);
        expect(bar.getValueJS("filledBarImageUri")).toBe("");
        expect(bar.getValueJS("trackBlendColor") >>> 0).toBe(0xffffffff);
        expect(bar.getValueJS("trackImageUri")).toBe("");
        expect(bar.getValueJS("percentage")).toBe(0);
    });

    test("customizing a bar's fields round-trips", () => {
        const video = SGNodeFactory.createNode("Video");
        const bar = video.getValue("retrievingBar");

        bar.setValue("filledBarImageUri", new BrsString("pkg:/images/fill.9.png"));
        bar.setValue("percentage", new Int32(42));

        expect(bar.getValueJS("filledBarImageUri")).toBe("pkg:/images/fill.9.png");
        expect(bar.getValueJS("percentage")).toBe(42);
    });

    test("ProgressBar is wired into the factory as its own subtype", () => {
        const bar = SGNodeFactory.createNode("ProgressBar");
        expect(bar).toBeDefined();
        expect(bar.nodeSubtype).toBe("ProgressBar");
    });

    afterAll(() => {
        sgRoot.setVideo();
    });
});
