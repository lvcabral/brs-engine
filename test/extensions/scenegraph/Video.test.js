const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, BrsBoolean, Int32, RoAssociativeArray, DataType, MediaEvent } = core;

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

describe("Video plane is only rendered by the owning, actively-presenting Video", () => {
    let originalPostMessage;

    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        originalPostMessage = global.postMessage;
        global.postMessage = jest.fn();
        sgRoot.setVideo();
    });

    afterEach(() => {
        global.postMessage = originalPostMessage;
        sgRoot.setVideo();
    });

    // The engine shares ONE browser <video> element, but an app can hold several Video node
    // instances (startup logo + preview player). The video plane is a transparent hole cleared
    // into the graphics buffer that the main thread fills with that one element's frames — so only
    // the node that OWNS the element (sgRoot.video) and is actively presenting a frame
    // (playing/paused) may position it and punch the hole. Otherwise a non-owner (or a
    // just-finished) Video resizes the element and leaks its stale last frame as a shrunken
    // picture, or punches a frame-less hole that shows through as a black box.
    function makeDraw2D() {
        const target = {
            cleared: [],
            filled: [],
            doDrawClearedRect(rect) {
                this.cleared.push({ ...rect });
            },
            doDrawRotatedRect(rect, rgba, rotation, center, opacity) {
                this.filled.push({ rect: { ...rect }, rgba, rotation, opacity });
            },
        };
        // A buffering fullscreen Video renders its (now-visible) spinner child, which reaches for
        // other IfDraw2D methods (doDrawScaledObject, …). Return a no-op for anything not tracked.
        return new Proxy(target, {
            get(obj, prop) {
                if (prop in obj) return obj[prop];
                return () => {};
            },
        });
    }

    function fullScreenVideo() {
        const video = SGNodeFactory.createNode("Video");
        video.setValue("width", new core.Float(1920));
        video.setValue("height", new core.Float(1080));
        return video;
    }

    test("the owning, playing Video clears its rect and posts the geometry", () => {
        const video = fullScreenVideo();
        sgRoot.setVideo(video);
        video.setState(MediaEvent.StartStream, 0); // -> "playing"
        video.makeDirty();
        const draw2D = makeDraw2D();
        global.postMessage.mockClear();

        video.renderNode({}, [0, 0], 0, 1, draw2D);

        expect(draw2D.cleared).toHaveLength(1);
        expect(draw2D.cleared[0]).toMatchObject({ x: 0, y: 0, width: 1920, height: 1080 });
        expect(global.postMessage).toHaveBeenCalledWith("video,rect,0,0,1920,1080");
    });

    test("the owning Video does NOT render a plane once it has finished", () => {
        const video = fullScreenVideo();
        sgRoot.setVideo(video);
        video.setState(MediaEvent.Finished, 0); // -> "finished"
        video.makeDirty();
        const draw2D = makeDraw2D();
        global.postMessage.mockClear();

        video.renderNode({}, [0, 0], 0, 1, draw2D);

        expect(draw2D.cleared).toHaveLength(0);
        expect(global.postMessage).not.toHaveBeenCalledWith(expect.stringContaining("video,rect"));
    });

    test("a non-owner Video does NOT render a plane even while playing", () => {
        const owner = fullScreenVideo();
        sgRoot.setVideo(owner);
        // A second instance (e.g. a preview player) that does NOT own the shared element.
        const other = fullScreenVideo();
        other.setState(MediaEvent.StartStream, 0);
        expect(sgRoot.video).toBe(owner);
        const draw2D = makeDraw2D();
        global.postMessage.mockClear();

        other.renderNode({}, [0, 0], 0, 1, draw2D);

        expect(draw2D.cleared).toHaveLength(0);
        expect(global.postMessage).not.toHaveBeenCalledWith(expect.stringContaining("video,rect"));
    });

    test("the owning, playing Video at accumulated opacity 0 does NOT render a plane", () => {
        const video = fullScreenVideo();
        sgRoot.setVideo(video);
        video.setState(MediaEvent.StartStream, 0);
        video.makeDirty();
        const draw2D = makeDraw2D();

        // Ancestor group faded to opacity 0 propagates opacity 0 to the (visible) Video.
        video.renderNode({}, [0, 0], 0, 0, draw2D);

        expect(draw2D.cleared).toHaveLength(0);
    });

    // While buffering (loading, before the first frame), a full-screen owner shows a solid BLACK
    // plane so the busy spinner appears over black — Roku's loading screen. It must NOT clear the
    // transparent hole (the shared <video> element may still hold a stale frame that would leak
    // through) and must NOT post the rect.
    test("the owning full-screen Video paints a solid black plane while buffering", () => {
        const video = fullScreenVideo();
        sgRoot.setVideo(video);
        video.setState(MediaEvent.Loading, 0); // -> "buffering"
        video.makeDirty();
        const draw2D = makeDraw2D();
        global.postMessage.mockClear();

        video.renderNode({}, [0, 0], 0, 1, draw2D);

        expect(video.getValueJS("state")).toBe("buffering");
        expect(draw2D.cleared).toHaveLength(0);
        expect(draw2D.filled).toHaveLength(1);
        expect(draw2D.filled[0].rect).toMatchObject({ x: 0, y: 0, width: 1920, height: 1080 });
        expect(draw2D.filled[0].rgba >>> 0).toBe(0x000000ff);
        expect(global.postMessage).not.toHaveBeenCalledWith(expect.stringContaining("video,rect"));
    });

    test("a non-owner buffering Video paints nothing", () => {
        const owner = fullScreenVideo();
        sgRoot.setVideo(owner);
        const other = fullScreenVideo();
        other.setState(MediaEvent.Loading, 0); // -> "buffering", but not the owner
        expect(sgRoot.video).toBe(owner);
        const draw2D = makeDraw2D();

        other.renderNode({}, [0, 0], 0, 1, draw2D);

        expect(draw2D.cleared).toHaveLength(0);
        expect(draw2D.filled).toHaveLength(0);
    });

    test("a windowed buffering Video paints no black plane", () => {
        const video = SGNodeFactory.createNode("Video");
        video.setValue("width", new core.Float(640));
        video.setValue("height", new core.Float(360));
        sgRoot.setVideo(video);
        video.setState(MediaEvent.Loading, 0); // -> "buffering"
        const draw2D = makeDraw2D();

        video.renderNode({}, [0, 0], 0, 1, draw2D);

        expect(draw2D.cleared).toHaveLength(0);
        expect(draw2D.filled).toHaveLength(0);
    });
});

describe("Video asyncStopSemantics stopping->stopped transition", () => {
    let originalPostMessage;

    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        originalPostMessage = global.postMessage;
        global.postMessage = jest.fn();
        sgRoot.setVideo();
    });

    afterEach(() => {
        global.postMessage = originalPostMessage;
        sgRoot.setVideo();
    });

    test("a stop while playing reports 'stopping' immediately, then 'stopped' when the stop lands", () => {
        // Roku OS 12.5+ async stop: control="stop" is non-blocking and surfaces its progress through
        // the state field so an app can serialize a following play behind the stop. Without the
        // "stopping" edge the app never learns the stop began and its queued play is dropped.
        const video = SGNodeFactory.createNode("Video");
        sgRoot.setVideo(video);
        video.setValue("asyncStopSemantics", BrsBoolean.from(true));

        // Drive it to playing, then async-stop.
        video.setState(MediaEvent.StartStream, 0);
        expect(video.getValueJS("state")).toBe("playing");

        video.setValue("control", new BrsString("stop"));
        // The stop is in progress; the state reflects that synchronously.
        expect(video.getValueJS("state")).toBe("stopping");

        // The main thread confirms the stop (Partial); the node then settles to stopped.
        video.setState(MediaEvent.Partial, 0);
        expect(video.getValueJS("state")).toBe("stopped");
    });

    test("a stop when already stopped settles synchronously (no hang in 'stopping')", () => {
        const video = SGNodeFactory.createNode("Video");
        sgRoot.setVideo(video);
        video.setValue("asyncStopSemantics", BrsBoolean.from(true));

        // Fresh node is in "none"; an async stop must not strand it in "stopping" (no event will come).
        video.setValue("control", new BrsString("stop"));
        expect(video.getValueJS("state")).toBe("stopped");
    });

    test("without asyncStopSemantics a stop does NOT enter 'stopping'", () => {
        const video = SGNodeFactory.createNode("Video");
        sgRoot.setVideo(video);
        video.setState(MediaEvent.StartStream, 0);

        video.setValue("control", new BrsString("stop"));
        // Synchronous stop semantics: state is unchanged by the control write itself.
        expect(video.getValueJS("state")).not.toBe("stopping");
    });
});
