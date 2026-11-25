const fs = require("fs");
const path = require("path");
const brs = require("../../../packages/node/bin/brs.node");
const { Interpreter } = brs;
const {
    BrsString,
    BrsBoolean,
    BrsInvalid,
    Int32,
    RoAnimatedImage,
    RoAssociativeArray,
    RoMessagePort,
    RoBitmap,
    RoScreen,
    applyLoadSize,
    decodeAnimatedWebP,
} = brs.types;

const { pixel, countReads } = require("../../testUtils/canvas");

// 4x4, 3 frames: red [0, 100), green [100, 250), blue [250, 450) ms.
const fixture = path.join(__dirname, "../resources/animated.webp");

// Full uri-load coverage (SetContent against a real animated WebP served through pkg:/) lives in
// the CLI e2e fixture, matching how RoRegion/RoTextureManager's file-loading is tested — this file
// covers what's reachable without a mounted filesystem: defaults, pretranslation, target state, and
// the message-port ready-event contract on the synchronous-failure path.

describe("RoAnimatedImage", () => {
    let interpreter;

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    it("stringifies as roAnimatedImage", () => {
        const animg = new RoAnimatedImage();
        expect(animg.toString()).toEqual("<Component: roAnimatedImage>");
    });

    it("is invalid at 0x0 before any content is set", () => {
        const animg = new RoAnimatedImage();
        const getWidth = animg.getMethod("getWidth");
        const getHeight = animg.getMethod("getHeight");
        const getState = animg.getMethod("getState");
        const isValid = animg.getMethod("isValid");

        expect(getWidth.call(interpreter)).toEqual(new Int32(0));
        expect(getHeight.call(interpreter)).toEqual(new Int32(0));
        expect(getState.call(interpreter)).toEqual(new BrsString("invalid"));
        expect(isValid.call(interpreter)).toEqual(BrsBoolean.False);
    });

    it("exposes only ifAnimatedImage, as on the device", () => {
        const animg = new RoAnimatedImage();
        for (const name of ["getWidth", "getHeight", "setMessagePort", "getMessagePort", "setContent", "update"]) {
            expect(animg.getMethod(name)).toBeDefined();
        }
        for (const name of ["drawRect", "drawObject", "clear", "getPng", "getByteArray", "setPort", "getPort"]) {
            expect(animg.getMethod(name)).toBeUndefined();
        }
        expect([...animg.interfaces.keys()]).toEqual(["ifanimatedimage"]);
    });

    it("GetID returns a stable, unique id per instance", () => {
        const first = new RoAnimatedImage();
        const second = new RoAnimatedImage();

        const firstId = first.getMethod("getId").call(interpreter);
        const secondId = second.getMethod("getId").call(interpreter);

        expect(firstId).toEqual(first.getMethod("getId").call(interpreter));
        expect(firstId).not.toEqual(secondId);
    });

    describe("SetPretranslation", () => {
        it("stores and reads back the pretranslation offset", () => {
            const animg = new RoAnimatedImage();
            const setPretranslation = animg.getMethod("setPretranslation");
            const getPretranslationX = animg.getMethod("getPretranslationX");
            const getPretranslationY = animg.getMethod("getPretranslationY");

            expect(getPretranslationX.call(interpreter)).toEqual(new Int32(0));
            expect(getPretranslationY.call(interpreter)).toEqual(new Int32(0));

            setPretranslation.call(interpreter, new Int32(-10), new Int32(-20));

            expect(getPretranslationX.call(interpreter)).toEqual(new Int32(-10));
            expect(getPretranslationY.call(interpreter)).toEqual(new Int32(-20));
        });
    });

    function bitmap4x4() {
        return new RoBitmap(
            new RoAssociativeArray([
                { name: new BrsString("width"), value: new Int32(4) },
                { name: new BrsString("height"), value: new Int32(4) },
            ])
        );
    }

    describe("SetContent", () => {
        // Loads from a file (events, sizes, failure messages) are covered by the CLI fixture roAnimatedImage.brs.
        function withPort() {
            const animg = new RoAnimatedImage();
            const port = new RoMessagePort();
            animg.getMethod("setMessagePort").call(interpreter, port);
            return { animg, port };
        }

        it("returns nothing and sends no event without a uri", () => {
            const { animg, port } = withPort();
            const content = new RoAssociativeArray([{ name: new BrsString("uri"), value: new BrsString("") }]);

            expect(animg.getMethod("setContent").call(interpreter, content)).toEqual(BrsInvalid.Instance);
            expect(animg.getMethod("setContent").call(interpreter, BrsInvalid.Instance)).toEqual(BrsInvalid.Instance);
            expect(port.getMethod("getMessage").call(interpreter)).toEqual(BrsInvalid.Instance);
            expect(animg.getMethod("getState").call(interpreter)).toEqual(new BrsString("invalid"));
            expect(animg.getMethod("isValid").call(interpreter)).toEqual(BrsBoolean.False);
        });

        it("drops the earlier content: the image is 0x0 and its draws report false", () => {
            const animg = new RoAnimatedImage();
            animg.setFrameSource(decodeAnimatedWebP(fs.readFileSync(fixture)));
            animg.sgDriven = false;
            const dst = bitmap4x4();
            expect(dst.drawImage(animg, 0, 0)).toBe(true);

            animg.getMethod("setContent").call(interpreter, new RoAssociativeArray([]));
            expect(animg.getMethod("getWidth").call(interpreter)).toEqual(new Int32(0));
            expect(animg.getMethod("getHeight").call(interpreter)).toEqual(new Int32(0));
            expect(dst.drawImage(animg, 0, 0)).toBe(false);
            expect(dst.drawImage(animg, 0, 0, 1, 1, 0xff0000ff)).toBe(false);
        });

        it("releases the tinted copies of the earlier content", () => {
            const animg = new RoAnimatedImage();
            animg.setFrameSource(decodeAnimatedWebP(fs.readFileSync(fixture)));
            animg.sgDriven = false;
            animg.getRgbaCanvas(0xff0000ff);
            const tints = animg.tints;
            animg.getMethod("setContent").call(interpreter, new RoAssociativeArray([]));
            expect(animg.tints).toBeUndefined();
            expect(tints.entries.size).toBe(0);
        });

        it("does not undo the screen's earlier draws when a draw of it fails", () => {
            const screen = new RoScreen(BrsBoolean.False, new Int32(8), new Int32(8));
            const bitmap = bitmap4x4();
            screen.isDirty = false;
            expect(screen.drawImage(bitmap, 0, 0)).toBe(true);
            expect(screen.drawImage(new RoAnimatedImage(), 0, 0)).toBe(false);
            expect(screen.isDirty).toBe(true);
        });
    });

    describe("SetTargetState", () => {
        it("returns false without content, even for the documented values", () => {
            const animg = new RoAnimatedImage();
            const setTargetState = animg.getMethod("setTargetState");

            for (const state of ["loop", "play", "pause", "rewind"]) {
                expect(setTargetState.call(interpreter, new BrsString(state))).toEqual(BrsBoolean.False);
            }
        });

        it("rejects an undocumented value and returns false", () => {
            const animg = new RoAnimatedImage();
            const setTargetState = animg.getMethod("setTargetState");

            expect(setTargetState.call(interpreter, new BrsString("stop"))).toEqual(BrsBoolean.False);
        });
    });

    describe("Update", () => {
        it("is a no-op in automatic mode (no content loaded, no throw)", () => {
            const animg = new RoAnimatedImage();
            const update = animg.getMethod("update");

            expect(() => update.call(interpreter, new Int32(16667))).not.toThrow();
        });
    });

    describe("tinted draws", () => {
        const RED = 0xff0000ff;
        const GREEN = 0x00ff00ff;
        const WHITE_HALF = 0x808080ff;

        /** An image driven by the SceneGraph `AnimatedImage` node's entry points. */
        function nodeDriven(source = decodeAnimatedWebP(fs.readFileSync(fixture))) {
            const animg = new RoAnimatedImage();
            animg.setFrameSource(source);
            animg.renderAtElapsed(0);
            return animg;
        }

        /** An image driven from BrightScript (`DrawObject` and friends), paused on its first frame. */
        function scriptDriven() {
            const animg = nodeDriven();
            animg.sgDriven = false;
            return animg;
        }

        it("reads the frame once when drawn repeatedly with the same tint", () => {
            const animg = scriptDriven();
            const counter = countReads(animg);
            const first = animg.getRgbaCanvas(RED);
            for (let i = 0; i < 10; i++) {
                expect(animg.getRgbaCanvas(RED)).toBe(first);
            }
            expect(counter.reads).toBe(1);
            expect(pixel(first)).toEqual([255, 0, 0, 255]);
        });

        it("keeps both copies when two tints alternate on one frame", () => {
            const animg = scriptDriven();
            const counter = countReads(animg);
            for (let i = 0; i < 5; i++) {
                expect(pixel(animg.getRgbaCanvas(RED))).toEqual([255, 0, 0, 255]);
                expect(pixel(animg.getRgbaCanvas(WHITE_HALF))).toEqual([128, 0, 0, 255]);
            }
            expect(counter.reads).toBe(2);
        });

        it("re-tints when the node moves to another frame, and only then", () => {
            const animg = nodeDriven();
            const counter = countReads(animg);
            expect(pixel(animg.getRgbaCanvas(RED))).toEqual([255, 0, 0, 255]);
            animg.renderAtElapsed(50); // still frame 0
            expect(pixel(animg.getRgbaCanvas(RED))).toEqual([255, 0, 0, 255]);
            expect(counter.reads).toBe(1);
            animg.renderAtElapsed(120); // frame 1, green
            expect(pixel(animg.getRgbaCanvas(RED))).toEqual([0, 0, 0, 255]);
            expect(pixel(animg.getRgbaCanvas(GREEN))).toEqual([0, 255, 0, 255]);
            animg.renderAtElapsed(200); // still frame 1
            expect(pixel(animg.getRgbaCanvas(GREEN))).toEqual([0, 255, 0, 255]);
            expect(counter.reads).toBe(3);
            expect(pixel(animg.getCanvas())).toEqual([0, 255, 0, 255]);
            animg.renderAtElapsed(450); // loops back to frame 0
            expect(pixel(animg.getRgbaCanvas(GREEN))).toEqual([0, 0, 0, 255]);
            expect(pixel(animg.getCanvas())).toEqual([255, 0, 0, 255]);
        });

        it("re-tints a scaled source only when its frame changes", () => {
            const animg = nodeDriven(applyLoadSize(decodeAnimatedWebP(fs.readFileSync(fixture)), 2, 2));
            expect(animg.width).toBe(2);
            const counter = countReads(animg);
            expect(pixel(animg.getRgbaCanvas(RED))).toEqual([255, 0, 0, 255]);
            animg.renderAtElapsed(50);
            expect(pixel(animg.getRgbaCanvas(RED))).toEqual([255, 0, 0, 255]);
            expect(counter.reads).toBe(1);
            animg.renderAtElapsed(300); // frame 2, blue
            expect(pixel(animg.getCanvas())).toEqual([0, 0, 255, 255]);
            expect(pixel(animg.getRgbaCanvas(RED))).toEqual([0, 0, 0, 255]);
        });

        it("shows the new source after SetContent-style replacement", () => {
            const animg = nodeDriven();
            expect(pixel(animg.getRgbaCanvas(RED))).toEqual([255, 0, 0, 255]);
            // Its first frame gets the same version number the old source's frame had.
            const other = decodeAnimatedWebP(fs.readFileSync(fixture));
            animg.setFrameSource(other);
            animg.renderAtElapsed(120);
            expect(pixel(animg.getCanvas())).toEqual([0, 255, 0, 255]);
            expect(pixel(animg.getRgbaCanvas(GREEN))).toEqual([0, 255, 0, 255]);
        });
    });
});
