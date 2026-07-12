const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Int32, RoAssociativeArray } = core;

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

    test("captionRenderArea accepts and reads back an associative array (Roku OS 15.3)", () => {
        const video = SGNodeFactory.createNode("Video");

        const area = new RoAssociativeArray([
            { name: new BrsString("mode"), value: new BrsString("override") },
            { name: new BrsString("x"), value: new Int32(100) },
            { name: new BrsString("y"), value: new Int32(200) },
            { name: new BrsString("width"), value: new Int32(1280) },
            { name: new BrsString("height"), value: new Int32(120) },
        ]);

        video.setValue("captionRenderArea", area);
        const result = video.getValueJS("captionRenderArea");

        expect(result.mode).toBe("override");
        expect(result.x).toBe(100);
        expect(result.y).toBe(200);
        expect(result.width).toBe(1280);
        expect(result.height).toBe(120);
    });

    test("setting captionRenderArea forwards it to the render thread (Roku OS 15.3)", () => {
        const video = SGNodeFactory.createNode("Video");
        // Ignore the messages posted during construction (control/caption defaults).
        global.postMessage.mockClear();

        const area = new RoAssociativeArray([
            { name: new BrsString("mode"), value: new BrsString("override") },
            { name: new BrsString("x"), value: new Int32(100) },
            { name: new BrsString("y"), value: new Int32(200) },
            { name: new BrsString("width"), value: new Int32(1280) },
            { name: new BrsString("height"), value: new Int32(120) },
        ]);

        video.setValue("captionRenderArea", area);

        expect(global.postMessage).toHaveBeenCalledWith({
            captionRenderArea: { mode: "override", x: 100, y: 200, width: 1280, height: 120 },
        });
    });

    afterAll(() => {
        sgRoot.setVideo();
    });
});

describe("Video cross-thread deserialization guard", () => {
    let originalPostMessage;

    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        originalPostMessage = global.postMessage;
        global.postMessage = jest.fn();
        sgRoot.deserializing = false;
        sgRoot.setVideo();
    });

    afterEach(() => {
        global.postMessage = originalPostMessage;
        sgRoot.deserializing = false;
        sgRoot.setVideo();
    });

    test("a normally-created Video registers as the root video", () => {
        const video = SGNodeFactory.createNode("Video");
        expect(sgRoot.video).toBe(video);
    });

    test("a Video rebuilt while deserializing does NOT hijack the root video or reset the player", () => {
        // Mirrors the regression: applying a task's cross-thread update re-deserializes the Video
        // (toSGNode -> new Video). Before the guard, its constructor called setVideo + posted player
        // resets, so processVideo drove an observer-less proxy and 'finished' never triggered close.
        const real = SGNodeFactory.createNode("Video");
        expect(sgRoot.video).toBe(real);
        global.postMessage.mockClear();

        sgRoot.deserializing = true;
        const proxy = SGNodeFactory.createNode("Video");
        sgRoot.deserializing = false;

        expect(proxy.nodeSubtype).toBe("Video");
        expect(sgRoot.video).toBe(real); // root video unchanged
        expect(sgRoot.video).not.toBe(proxy);
        expect(global.postMessage).not.toHaveBeenCalledWith("video,loop,false");
    });

    test("a newly created Video does NOT steal the root from an already-active Video", () => {
        // Regression: the single shared player's events are routed by processVideo to sgRoot.video.
        // A Video created while another is still playing (e.g. an app building its player UI during
        // a startup video) must not hijack that routing in its constructor, or the playing Video's
        // 'state' would never reach 'finished'/'stopped' and its observers would be stranded.
        const active = SGNodeFactory.createNode("Video");
        expect(sgRoot.video).toBe(active);

        const other = SGNodeFactory.createNode("Video");
        expect(other.nodeSubtype).toBe("Video");
        expect(sgRoot.video).toBe(active); // routing stays with the active Video
        expect(sgRoot.video).not.toBe(other);
    });

    test("a Video claims the root when it starts playback (play/prebuffer/resume/replay)", () => {
        for (const control of ["play", "prebuffer", "resume", "replay"]) {
            sgRoot.setVideo();
            const active = SGNodeFactory.createNode("Video");
            const other = SGNodeFactory.createNode("Video");
            expect(sgRoot.video).toBe(active);

            other.setValue("control", new BrsString(control));
            expect(sgRoot.video).toBe(other); // playback command takes over routing
        }
    });

    test("a non-playback control (pause/stop) does not steal the root", () => {
        sgRoot.setVideo();
        const active = SGNodeFactory.createNode("Video");
        const other = SGNodeFactory.createNode("Video");
        expect(sgRoot.video).toBe(active);

        other.setValue("control", new BrsString("stop"));
        expect(sgRoot.video).toBe(active); // stop/pause don't hijack routing
    });
});
