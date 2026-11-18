const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { RoSGScreen, SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsInvalid, Interpreter, RoMessagePort } = core;

describe("roSGScreen.close", () => {
    let interpreter;

    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        interpreter = new Interpreter();
        BrsDevice.liveRoScreens = 0;
        sgRoot.takeEndRequest();
    });

    function poll(port) {
        return port.getMethod("getMessage").call(interpreter);
    }

    function drawingScreen() {
        const screen = new RoSGScreen();
        const frames = vi.spyOn(screen, "finishDraw").mockImplementation(() => {});
        sgRoot.setScene(SGNodeFactory.createNode("Scene"));
        return { screen, frames };
    }

    test("a closed screen stops drawing frames through ports registered to it", () => {
        const screen = new RoSGScreen();
        const frames = vi.spyOn(screen, "finishDraw").mockImplementation(() => {});
        sgRoot.setScene(SGNodeFactory.createNode("Scene"));
        const port = new RoMessagePort();
        screen.registerPort(port);

        screen.makeDirty();
        poll(port);
        expect(frames).toHaveBeenCalledTimes(1);

        screen.getMethod("close").call(interpreter);
        screen.makeDirty();
        poll(port);
        expect(frames).toHaveBeenCalledTimes(1);
    });

    test("a second close() posts no second closed event", () => {
        const { screen } = drawingScreen();
        const port = new RoMessagePort();
        screen.getMethod("setMessagePort").call(interpreter, port);
        BrsDevice.liveRoScreens = 1;

        screen.getMethod("close").call(interpreter);
        screen.getMethod("close").call(interpreter);
        expect(poll(port).getMethod("isScreenClosed").call(interpreter).toBoolean()).toBe(true);
        expect(poll(port)).toBe(BrsInvalid.Instance);
    });

    test("an open screen does not draw while an roScreen owns the display", () => {
        const { screen, frames } = drawingScreen();
        const port = new RoMessagePort();
        screen.registerPort(port);

        BrsDevice.liveRoScreens = 1;
        screen.makeDirty();
        poll(port);
        expect(frames).not.toHaveBeenCalled();

        BrsDevice.liveRoScreens = 0;
        poll(port);
        expect(frames).toHaveBeenCalledTimes(1);
    });

    test("a screen created after a close draws through ports registered to the closed one", () => {
        const first = drawingScreen();
        const oldPort = new RoMessagePort();
        first.screen.registerPort(oldPort);
        BrsDevice.liveRoScreens = 1;
        first.screen.getMethod("close").call(interpreter);
        BrsDevice.liveRoScreens = 0;

        const second = drawingScreen();
        second.screen.makeDirty();
        poll(oldPort);
        expect(second.frames).toHaveBeenCalledTimes(1);
        expect(first.frames).not.toHaveBeenCalled();
    });

    test("closing the last screen requests the app end; closing it under an roScreen does not", () => {
        const { screen } = drawingScreen();
        BrsDevice.liveRoScreens = 1;
        screen.getMethod("close").call(interpreter);
        expect(sgRoot.takeEndRequest()).toBe(false);

        const last = drawingScreen();
        BrsDevice.liveRoScreens = 0;
        last.screen.getMethod("close").call(interpreter);
        expect(sgRoot.takeEndRequest()).toBe(true);
        expect(sgRoot.takeEndRequest()).toBe(false);
    });
});
