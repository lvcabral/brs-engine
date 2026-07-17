const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, DataType, MediaEvent, RoVideoPlayer, RoVideoPlayerEvent } = core;

// The main thread publishes media events by storing MediaEvent values into the shared
// array's VDO slot (VDX carries the event index). A consumer that dedupes on a snapshot
// of the last-seen value drops the second of two same-type events published between two
// ticks (e.g. a stale StartStream from the previous item followed by the real one), and
// the slot then sticks at that value forever — the app never sees the real "playing".
// These suites pin the exactly-once consume (compareExchange) on both consumers.
describe("SGRoot.processVideo exactly-once event consumption", () => {
    let originalPostMessage;
    let originalSharedArray;
    let sharedArray;

    beforeAll(() => {
        // Video builds labels/posters/spinner from the common: volume; mount it once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
        originalSharedArray = BrsDevice.sharedArray;
        sharedArray = new Int32Array(new SharedArrayBuffer(4096 * Int32Array.BYTES_PER_ELEMENT));
        BrsDevice.setSharedArray(sharedArray);
    });

    beforeEach(() => {
        // The Video constructor posts control/state messages to the render thread.
        originalPostMessage = global.postMessage;
        global.postMessage = jest.fn();
        sharedArray.fill(-1);
        sgRoot.setVideo();
    });

    afterEach(() => {
        global.postMessage = originalPostMessage;
        sgRoot.setVideo();
    });

    afterAll(() => {
        BrsDevice.setSharedArray(originalSharedArray);
    });

    function publishEvent(eventType, eventIndex = 0) {
        // VDX must be stored before VDO — VDO is the publish flag the worker consumes.
        Atomics.store(sharedArray, DataType.VDX, eventIndex);
        Atomics.store(sharedArray, DataType.VDO, eventType);
    }

    test("a same-type event republished before the next tick is still delivered (poster-over-video regression)", () => {
        const video = SGNodeFactory.createNode("Video");
        sgRoot.setVideo(video);

        // A stale/premature StartStream (e.g. from the previously focused item) is consumed.
        publishEvent(MediaEvent.StartStream);
        sgRoot.processVideo();
        expect(video.getValueJS("state")).toBe("playing");
        expect(Atomics.load(sharedArray, DataType.VDO)).toBe(-1);

        // Before the next worker tick, the new item's load reports buffering progress (the
        // separate VLP slot) AND the real StartStream lands in VDO. A snapshot dedupe reads
        // StartStream === last-seen StartStream, drops it, and the state sticks at
        // "buffering" — the app never hides its poster over the playing video.
        Atomics.store(sharedArray, DataType.VLP, 330);
        publishEvent(MediaEvent.StartStream);
        sgRoot.processVideo();

        expect(video.getValueJS("state")).toBe("playing");
        expect(Atomics.load(sharedArray, DataType.VDO)).toBe(-1);
    });

    test("the VDO slot never sticks after a same-type republish", () => {
        const video = SGNodeFactory.createNode("Video");
        sgRoot.setVideo(video);

        publishEvent(MediaEvent.StartStream);
        sgRoot.processVideo();
        publishEvent(MediaEvent.StartStream);
        sgRoot.processVideo();
        // With the snapshot dedupe the slot stayed at StartStream forever; it must be cleared.
        expect(Atomics.load(sharedArray, DataType.VDO)).toBe(-1);

        // And a subsequent different event still lands normally.
        publishEvent(MediaEvent.Paused);
        sgRoot.processVideo();
        expect(video.getValueJS("state")).toBe("paused");
        expect(Atomics.load(sharedArray, DataType.VDO)).toBe(-1);
    });

    test("distinct event transitions are consumed one per tick", () => {
        const video = SGNodeFactory.createNode("Video");
        sgRoot.setVideo(video);

        publishEvent(MediaEvent.StartStream);
        sgRoot.processVideo();
        expect(video.getValueJS("state")).toBe("playing");

        publishEvent(MediaEvent.Partial);
        sgRoot.processVideo();
        expect(video.getValueJS("state")).toBe("stopped");

        publishEvent(MediaEvent.StartStream);
        sgRoot.processVideo();
        expect(video.getValueJS("state")).toBe("playing");
        expect(Atomics.load(sharedArray, DataType.VDO)).toBe(-1);
    });
});

describe("roVideoPlayer getNewEvents exactly-once event consumption", () => {
    let originalPostMessage;
    let originalSharedArray;
    let sharedArray;

    beforeAll(() => {
        originalSharedArray = BrsDevice.sharedArray;
        sharedArray = new Int32Array(new SharedArrayBuffer(4096 * Int32Array.BYTES_PER_ELEMENT));
        BrsDevice.setSharedArray(sharedArray);
    });

    beforeEach(() => {
        // The roVideoPlayer constructor posts player-reset messages to the render thread.
        originalPostMessage = global.postMessage;
        global.postMessage = jest.fn();
        sharedArray.fill(-1);
    });

    afterEach(() => {
        global.postMessage = originalPostMessage;
    });

    afterAll(() => {
        BrsDevice.setSharedArray(originalSharedArray);
    });

    test("two consecutive events with identical type and index both produce an event", () => {
        const videoPlayer = new RoVideoPlayer();

        Atomics.store(sharedArray, DataType.VDX, 5);
        Atomics.store(sharedArray, DataType.VDO, MediaEvent.StartStream);
        let events = videoPlayer.getNewEvents();
        expect(events.length).toBe(1);
        expect(events[0]).toBeInstanceOf(RoVideoPlayerEvent);
        expect(Atomics.load(sharedArray, DataType.VDO)).toBe(-1);

        // Republish the identical event before the next poll: the old type+index snapshot
        // dedupe dropped it and left VDO stuck at StartStream.
        Atomics.store(sharedArray, DataType.VDX, 5);
        Atomics.store(sharedArray, DataType.VDO, MediaEvent.StartStream);
        events = videoPlayer.getNewEvents();
        expect(events.length).toBe(1);
        expect(events[0]).toBeInstanceOf(RoVideoPlayerEvent);
        expect(Atomics.load(sharedArray, DataType.VDO)).toBe(-1);
    });

    test("an empty slot produces no event and does not clear a later publish", () => {
        const videoPlayer = new RoVideoPlayer();

        expect(videoPlayer.getNewEvents().length).toBe(0);

        Atomics.store(sharedArray, DataType.VDX, 0);
        Atomics.store(sharedArray, DataType.VDO, MediaEvent.Paused);
        const events = videoPlayer.getNewEvents();
        expect(events.length).toBe(1);
        expect(Atomics.load(sharedArray, DataType.VDO)).toBe(-1);
    });
});
