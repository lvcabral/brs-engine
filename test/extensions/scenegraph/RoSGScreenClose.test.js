const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { RoSGScreen, SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, Interpreter, RoMessagePort } = core;

describe("roSGScreen.close", () => {
    let interpreter;

    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    function poll(port) {
        port.getMethod("getMessage").call(interpreter);
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
});
