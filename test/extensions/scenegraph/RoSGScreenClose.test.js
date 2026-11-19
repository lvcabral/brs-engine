const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { RoSGScreen, SGNodeFactory, pollCurrentScreen, sgRoot } = scenegraph;
const { BrsDevice, BrsInvalid, Interpreter, RoMessagePort, RoScreen } = core;

describe("roSGScreen.close", () => {
    let interpreter;

    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        interpreter = new Interpreter();
        BrsDevice.resetDisplay();
    });

    function poll(port) {
        return port.getMethod("getMessage").call(interpreter);
    }

    function close(screen) {
        screen.getMethod("close").call(interpreter);
    }

    /** A port Main created, which drives the current screen (as the extension's roMessagePort factory does). */
    function mainPort() {
        const port = new RoMessagePort();
        port.registerCallback("roSGScreen", pollCurrentScreen);
        return port;
    }

    function drawingScreen() {
        const screen = new RoSGScreen();
        const frames = vi.spyOn(screen, "finishDraw").mockImplementation(() => {});
        sgRoot.setScene(SGNodeFactory.createNode("Scene"));
        return { screen, frames };
    }

    /** An roScreen held by a variable, as `rs = CreateObject("roScreen")` leaves it. */
    function heldRoScreen() {
        const rs = new RoScreen();
        rs.addReference();
        return rs;
    }

    test("a closed screen stops drawing frames through ports registered to it", () => {
        const { screen, frames } = drawingScreen();
        const port = mainPort();

        screen.makeDirty();
        poll(port);
        expect(frames).toHaveBeenCalledTimes(1);

        heldRoScreen();
        close(screen);
        screen.makeDirty();
        poll(port);
        expect(frames).toHaveBeenCalledTimes(1);
    });

    test("a second close() posts no second closed event", () => {
        const { screen } = drawingScreen();
        const port = new RoMessagePort();
        screen.getMethod("setMessagePort").call(interpreter, port);
        heldRoScreen();

        close(screen);
        close(screen);
        expect(poll(port).getMethod("isScreenClosed").call(interpreter).toBoolean()).toBe(true);
        expect(poll(port)).toBe(BrsInvalid.Instance);
    });

    test("an roScreen created over the Scene suspends it; the Scene repaints once it is released", () => {
        const { screen, frames } = drawingScreen();
        const port = mainPort();
        screen.makeDirty();
        poll(port);
        expect(frames).toHaveBeenCalledTimes(1);

        const rs = heldRoScreen();
        screen.makeDirty();
        poll(port);
        expect(frames).toHaveBeenCalledTimes(1);

        rs.removeReference();
        poll(port);
        expect(frames).toHaveBeenCalledTimes(2);
    });

    test("an roScreen that was never stored does not suspend the Scene", () => {
        const { screen, frames } = drawingScreen();
        const port = mainPort();

        new RoScreen();
        screen.makeDirty();
        poll(port);
        expect(frames).toHaveBeenCalledTimes(1);
    });

    test("a screen created over an roScreen draws while the roScreen is still held", () => {
        heldRoScreen();
        const { screen, frames } = drawingScreen();
        const port = mainPort();

        screen.makeDirty();
        poll(port);
        expect(frames).toHaveBeenCalledTimes(1);
    });

    test("a screen created after a close draws through ports registered to the closed one", () => {
        const first = drawingScreen();
        const oldPort = mainPort();
        const rs = heldRoScreen();
        close(first.screen);
        rs.removeReference();

        const second = drawingScreen();
        second.screen.makeDirty();
        poll(oldPort);
        expect(second.frames).toHaveBeenCalledTimes(1);
        expect(first.frames).not.toHaveBeenCalled();
    });

    test("closing the last screen ends the app at the next message loop; closing it under an roScreen does not", () => {
        const { screen } = drawingScreen();
        heldRoScreen();
        close(screen);
        BrsDevice.onMessageLoop();
        expect(BrsDevice.appEndDue()).toBe(false);

        BrsDevice.resetDisplay();
        const last = drawingScreen();
        close(last.screen);
        expect(BrsDevice.appEndDue()).toBe(false);
        BrsDevice.onMessageLoop();
        expect(BrsDevice.appEndDue()).toBe(true);
    });

    test("closing a screen that is not the current one leaves the current Scene running", () => {
        const older = drawingScreen();
        const current = drawingScreen();
        const timer = SGNodeFactory.createNode("Timer");
        sgRoot.trackTimer(timer);

        close(older.screen);
        expect(sgRoot.timers).toContain(timer);
        BrsDevice.onMessageLoop();
        expect(BrsDevice.appEndDue()).toBe(false);

        close(current.screen);
        expect(sgRoot.timers).not.toContain(timer);
    });

    test("the app end falls due after a delay when Main reaches no message loop", () => {
        const now = vi.spyOn(performance, "now");
        now.mockReturnValue(1000);
        const { screen } = drawingScreen();
        close(screen);
        expect(BrsDevice.appEndDue()).toBe(false);

        now.mockReturnValue(2000);
        expect(BrsDevice.appEndDue()).toBe(true);
        now.mockRestore();
    });

    test("an roScreen below a Scene takes no keys, even when Main reads its port first", () => {
        const rs = heldRoScreen();
        const rsPort = new RoMessagePort();
        rs.getMethod("setMessagePort").call(interpreter, rsPort);
        const keys = vi.spyOn(BrsDevice, "updateKeysBuffer");

        const { screen } = drawingScreen();
        poll(rsPort);
        expect(keys).not.toHaveBeenCalled();

        close(screen);
        poll(rsPort);
        expect(keys).toHaveBeenCalledTimes(1);
        keys.mockRestore();
    });

    test("closing the Scene on top shows the roScreen's last frame again", () => {
        const rs = heldRoScreen();
        const restore = vi.spyOn(rs, "restoreDisplay").mockImplementation(() => {});
        const older = drawingScreen();
        const top = drawingScreen();

        close(older.screen);
        expect(restore).not.toHaveBeenCalled();
        close(top.screen);
        expect(restore).toHaveBeenCalledTimes(1);
    });
});
