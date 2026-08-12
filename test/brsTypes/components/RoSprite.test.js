const brs = require("../../../packages/node/bin/brs.node");
const { Interpreter } = brs;
const { RoAssociativeArray, RoBitmap, RoRegion, RoCompositor, RoArray, BrsString, Int32 } = brs.types;

// Regression coverage for a bug where a sprite created via roCompositor.NewAnimatedSprite kept
// auto-advancing through its original frame array after an explicit SetRegion() call, silently
// overwriting the manually-set region on the next AnimationTick(). On a real Roku device,
// SetRegion() detaches the sprite from automatic frame animation; the engine must match that.

describe("RoSprite", () => {
    let interpreter;
    let bitmap;

    beforeEach(() => {
        interpreter = new Interpreter();
        const fields = new RoAssociativeArray([
            { name: new BrsString("width"), value: new Int32(100) },
            { name: new BrsString("height"), value: new Int32(100) },
        ]);
        bitmap = new RoBitmap(fields);
    });

    function region(x) {
        const rgn = new RoRegion(bitmap, new Int32(x), new Int32(0), new Int32(10), new Int32(10));
        rgn.getMethod("setTime").call(interpreter, new Int32(50));
        return rgn;
    }

    it("auto-advances through the frame array on AnimationTick", () => {
        const compositor = new RoCompositor();
        const frame0 = region(0);
        const frame1 = region(10);
        const sprite = compositor
            .getMethod("newAnimatedSprite")
            .call(interpreter, new Int32(0), new Int32(0), new RoArray([frame0, frame1]), new Int32(0));

        expect(sprite.getMethod("getRegion").call(interpreter)).toBe(frame0);

        compositor.getMethod("animationTick").call(interpreter, new Int32(60));

        expect(sprite.getMethod("getRegion").call(interpreter)).toBe(frame1);
    });

    it("keeps a manually-set region after SetRegion(), even across later AnimationTick() calls", () => {
        const compositor = new RoCompositor();
        const frame0 = region(0);
        const frame1 = region(10);
        const pointsRegion = region(20);
        const sprite = compositor
            .getMethod("newAnimatedSprite")
            .call(interpreter, new Int32(0), new Int32(0), new RoArray([frame0, frame1]), new Int32(0));

        sprite.getMethod("setRegion").call(interpreter, pointsRegion);
        expect(sprite.getMethod("getRegion").call(interpreter)).toBe(pointsRegion);

        // Enough elapsed time to have advanced multiple rolling-animation frames, were the sprite
        // still driven by the original frame array.
        compositor.getMethod("animationTick").call(interpreter, new Int32(200));

        expect(sprite.getMethod("getRegion").call(interpreter)).toBe(pointsRegion);
    });
});
