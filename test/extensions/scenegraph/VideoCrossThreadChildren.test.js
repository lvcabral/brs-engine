const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot, fromSGNode, updateSGNode } = scenegraph;
const { BrsDevice, BrsBoolean, MediaEvent } = core;

// Regression: PlayUSB (SGDEX) starts a FilePositionHandler Task that references the Video node.
// The render thread serialized the Video's internal overlay children (trick-play bar, header,
// spinner, …) to that Task; when the Task synced back, updateSGNode reconciled and replaced those
// children with fresh copies, while the Video's private field references (this.trickPlayBar) kept
// pointing at the originals. showUI updated the field, renderChildren painted the swapped copy, and
// the on-screen overlay (progress bar, header, pause icon) never appeared during playback.
//
// Fix: Video.serializesChildren() === false, so its internal children never cross a thread and the
// field references stay identical to the rendered children.
describe("Video internal children survive cross-thread serialization", () => {
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

    test("a Video does not serialize its internal children", () => {
        const video = SGNodeFactory.createNode("Video");
        const serialized = fromSGNode(video, true);
        // Internal overlay children (trickPlayBar, spinner, header labels, …) must not cross threads.
        expect(serialized._children_).toBeUndefined();
    });

    test("the trick-play bar stays linked to the render children after a Task round-trip", () => {
        const video = SGNodeFactory.createNode("Video");
        sgRoot.setVideo(video);
        const trickPlayBar = video.getValue("trickPlayBar");

        // The field reference and the rendered child are the same instance to start with.
        expect(video.getNodeChildren().includes(trickPlayBar)).toBe(true);

        // Simulate the Task sync-back: serialize the Video (as sent to the Task) and reconcile it
        // back onto the render-thread node (as updateSGNode does when the Task's update arrives).
        const serialized = JSON.parse(JSON.stringify(fromSGNode(video, true)));
        updateSGNode(serialized, video);

        // Regression: before the fix, reconciliation replaced the child with a fresh copy, so the
        // field reference was no longer in the render children.
        expect(video.getValue("trickPlayBar")).toBe(trickPlayBar);
        expect(video.getNodeChildren().includes(trickPlayBar)).toBe(true);
    });

    test("the trick-play bar's own child posters survive the round-trip (bar renders, not just icons)", () => {
        const video = SGNodeFactory.createNode("Video");
        sgRoot.setVideo(video);
        const trickPlayBar = video.getValue("trickPlayBar");
        // The bar builds its track/fill/ticker/label posters internally; capture them.
        const barChildren = trickPlayBar.getNodeChildren().slice();
        expect(barChildren.length).toBeGreaterThan(0);

        // The Video exposes the bar as its `trickPlayBar` field, so the bar is serialized even though
        // the Video no longer serializes its own children.
        const serializedBar = fromSGNode(trickPlayBar, true);
        expect(serializedBar._children_).toBeUndefined();

        // A full Video round-trip must not replace the bar's internal children with fresh copies.
        const serialized = JSON.parse(JSON.stringify(fromSGNode(video, true)));
        updateSGNode(serialized, video);

        const barAfter = video.getValue("trickPlayBar");
        expect(barAfter).toBe(trickPlayBar);
        expect(barAfter.getNodeChildren()).toEqual(barChildren);
    });

    test("pausing after a Task round-trip makes the trick-play bar visible in the render tree", () => {
        const video = SGNodeFactory.createNode("Video");
        sgRoot.setVideo(video);
        // Match SGDEX's HD full-screen Video so uiVisible() is true.
        video.setValue("width", new core.Float(1280));
        video.setValue("height", new core.Float(720));

        // Task round-trip happens while the video is set up, before playback.
        const serialized = JSON.parse(JSON.stringify(fromSGNode(video, true)));
        updateSGNode(serialized, video);

        video.setState(MediaEvent.StartStream, 0); // playing
        video.setState(MediaEvent.Paused, 0); // arms the trick-play window
        // A render pass runs showUI(), which sets the trick-play bar visible while the window is open.
        const draw2D = new Proxy(
            {},
            {
                get() {
                    return () => {};
                },
            }
        );
        video.makeDirty();
        video.renderNode({}, [0, 0], 0, 1, draw2D);

        const trickPlayBar = video.getValue("trickPlayBar");
        // showUI set visible=true on the field reference; that same instance must be the rendered child.
        expect(trickPlayBar.getValueJS("visible")).toBe(true);
        expect(video.getNodeChildren().includes(trickPlayBar)).toBe(true);
        // And no stale, still-hidden TrickPlayBar copy is left in the children list.
        const bars = video.getNodeChildren().filter((c) => c && c.nodeSubtype === "TrickPlayBar");
        expect(bars).toHaveLength(1);
        expect(bars[0]).toBe(trickPlayBar);
    });

    afterAll(() => {
        sgRoot.setVideo();
        void BrsBoolean;
    });
});
