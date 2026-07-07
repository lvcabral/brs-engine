const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory } = scenegraph;
const { BrsDevice, BrsString, Float, RoMessagePort } = core;

/**
 * Minimal fake interpreter accepted by Node.addObserver for a port observer (mirrors HiddenFields.test.js).
 */
const fakeInterpreter = { environment: {}, inSubEnv: () => {} };

/**
 * Poster load notifications: on a real device bitmapWidth/bitmapHeight read 0 until an image finishes
 * loading, so every load transitions 0 -> N and fires observers. Our loader is synchronous, so without
 * resetting these fields a new image with the SAME loaded dimensions (common when loadWidth/loadHeight
 * are fixed) would set bitmapWidth N -> N — no change, no notification. That silently breaks a very common
 * cross-fade pattern (observe bitmapWidth to start a fade-in when the next background finishes loading).
 */
describe("Poster bitmap load notifications", () => {
    beforeAll(() => {
        // Poster loads images from the common: volume; mount it once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    test("bitmapWidth re-notifies on every load, even when the new image has identical dimensions", () => {
        const poster = SGNodeFactory.createNode("Poster");
        // Force both images to the same loaded dimensions so bitmapWidth would otherwise be unchanged.
        poster.setValue("loadWidth", new Float(48));
        poster.setValue("loadHeight", new Float(48));

        const port = new RoMessagePort();
        const received = [];
        const originalPush = port.pushMessage.bind(port);
        port.pushMessage = (event) => {
            received.push(event);
            originalPush(event);
        };
        poster.addObserver(fakeInterpreter, "unscoped", new BrsString("bitmapWidth"), port);

        poster.setValue("uri", new BrsString("common:/images/icon_options.png"));
        const firstWidth = poster.getValueJS("bitmapWidth");
        expect(firstWidth).toBeGreaterThan(0);
        expect(received.length).toBe(1);

        // A different image that scales to the same dimensions must still fire the observer.
        poster.setValue("uri", new BrsString("common:/images/icon_options_off.png"));
        expect(poster.getValueJS("bitmapWidth")).toBe(firstWidth);
        expect(received.length).toBe(2);
    });
});
