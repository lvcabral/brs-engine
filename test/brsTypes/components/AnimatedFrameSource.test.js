const fs = require("fs");
const path = require("path");
const brs = require("../../../packages/node/bin/brs.node");
const { decodeAnimatedWebP, decodeLottie, WebPFrameSource } = brs.types;

// 4x4, 3-frame, lossless animated WebP (solid red/green/blue frames, durations 100/150/200ms,
// full-canvas frames with blend=1) generated with Pillow — see git history for the generator script.
const fixture = path.join(__dirname, "../resources/animated.webp");

// 4x4, 2-frame animated WebP where libwebp's own `minimize_size` diffing produced a genuine
// partial-rect frame 1 (2x2 at 0,0, blend=0/alpha-blend) with two of its four pixels transparent
// (unchanged from frame 0's solid red) and two opaque blue — see git history for the generator
// script (Pillow, minimize_size=True). Real encoder output, not synthetic: regression for the
// blend-flag inversion bug below.
const partialDiffFixture = path.join(__dirname, "../resources/animated-partial-diff.webp");

// 200x200, 60-frame @ 30fps Lottie doc (one shape layer, red 80x80 rect at center, keyframed
// 0deg->360deg rotation) — same fixture validated visually in test/simulator/probes/lottie-spike/.
const lottieFixture = path.join(__dirname, "../resources/sample.lottie.json");

// Minimal open-polyline stroke fixture (lc=1/Butt) for the line-cap regression below.
const buttCapFixture = path.join(__dirname, "../resources/sample-lottie-buttcap.json");

describe("decodeAnimatedWebP", () => {
    it("returns undefined for non-WebP data", () => {
        expect(decodeAnimatedWebP(Buffer.from("not a webp"))).toBeUndefined();
    });

    it("decodes canvas size, loop count and total duration from the ANIM/ANMF chunks", () => {
        const source = decodeAnimatedWebP(fs.readFileSync(fixture));

        expect(source).toBeDefined();
        expect(source.width).toBe(4);
        expect(source.height).toBe(4);
        expect(source.loopCount).toBe(0); // 0 = infinite, per the WebP ANIM chunk
        expect(source.durationMs).toBe(450); // 100 + 150 + 200
    });

    it("renders the frame visible at a given elapsed time, looping back to frame 0", () => {
        const source = decodeAnimatedWebP(fs.readFileSync(fixture));

        const pixelAt = (elapsedMs) => {
            const canvas = source.renderAt(elapsedMs);
            const ctx = canvas.getContext("2d");
            return Array.from(ctx.getImageData(0, 0, 1, 1).data);
        };

        expect(pixelAt(0)).toEqual([255, 0, 0, 255]); // frame 0: red, [0, 100)
        expect(pixelAt(99)).toEqual([255, 0, 0, 255]);
        expect(pixelAt(100)).toEqual([0, 255, 0, 255]); // frame 1: green, [100, 250)
        expect(pixelAt(249)).toEqual([0, 255, 0, 255]);
        expect(pixelAt(250)).toEqual([0, 0, 255, 255]); // frame 2: blue, [250, 450)
        expect(pixelAt(449)).toEqual([0, 0, 255, 255]);
        expect(pixelAt(450)).toEqual([255, 0, 0, 255]); // loops back to frame 0
        expect(pixelAt(900)).toEqual([255, 0, 0, 255]); // two full loops later, still frame 0
    });

    it("re-renders correctly when seeking backwards (non-sequential access)", () => {
        const source = decodeAnimatedWebP(fs.readFileSync(fixture));
        const pixelAt = (elapsedMs) => {
            const canvas = source.renderAt(elapsedMs);
            return Array.from(canvas.getContext("2d").getImageData(0, 0, 1, 1).data);
        };

        expect(pixelAt(300)).toEqual([0, 0, 255, 255]); // jump straight to frame 2 (blue)
        expect(pixelAt(0)).toEqual([255, 0, 0, 255]); // seek back to frame 0 (red)
        expect(pixelAt(120)).toEqual([0, 255, 0, 255]); // forward again to frame 1 (green)
    });

    it("alpha-blends a real encoder-produced partial-diff frame, preserving the backdrop under its transparent pixels", () => {
        // Regression: the parsed `blend` flag was inverted relative to the WebP container spec
        // (bit B=0 means "use alpha-blending", B=1 means "do not blend"/overwrite — confirmed
        // against https://developers.google.com/speed/webp/docs/riff_container). This fixture's
        // frame 1 is genuine libwebp encoder output (not synthetic): a 2x2 partial rect at (0,0)
        // with blend=0, where pixels (0,1) and (1,0) are transparent because they're UNCHANGED
        // from frame 0's solid red backdrop — the encoder relies on alpha-blending to reveal them.
        // With the bug, this frame was treated as overwrite: those two pixels cleared to
        // transparent instead of showing red, matching a user's live report of "several frames
        // showing corrupted, making the image transparent in some parts" on small-step frames.
        const source = decodeAnimatedWebP(fs.readFileSync(partialDiffFixture));
        const pixelAt = (elapsedMs, x, y) => {
            const canvas = source.renderAt(elapsedMs);
            return Array.from(canvas.getContext("2d").getImageData(x, y, 1, 1).data);
        };

        expect(pixelAt(0, 0, 0)).toEqual([255, 0, 0, 255]); // frame 0: solid red

        // Frame 1, at elapsed=100: (0,0) and (1,1) are opaque blue (the real change); (0,1) and
        // (1,0) are transparent in the encoded diff and must show frame 0's red through.
        expect(pixelAt(100, 0, 0)).toEqual([0, 0, 255, 255]);
        expect(pixelAt(100, 1, 1)).toEqual([0, 0, 255, 255]);
        expect(pixelAt(100, 0, 1)).toEqual([255, 0, 0, 255]);
        expect(pixelAt(100, 1, 0)).toEqual([255, 0, 0, 255]);
        // Outside the partial rect entirely, still untouched red.
        expect(pixelAt(100, 3, 3)).toEqual([255, 0, 0, 255]);
    });
});

describe("decodeLottie", () => {
    it("returns undefined for invalid JSON", () => {
        expect(decodeLottie("not json")).toBeUndefined();
    });

    it("decodes canvas size and total duration from the Lottie document", () => {
        const source = decodeLottie(fs.readFileSync(lottieFixture, "utf8"));

        expect(source).toBeDefined();
        expect(source.width).toBe(200);
        expect(source.height).toBe(200);
        expect(source.durationMs).toBe(2000); // 60 frames @ 30fps = 2s
    });

    it("renders the red rect at t=0 (unrotated, inside the shape's bounds)", () => {
        const source = decodeLottie(fs.readFileSync(lottieFixture, "utf8"));

        const canvas = source.renderAt(0);
        const pixel = Array.from(canvas.getContext("2d").getImageData(60, 60, 1, 1).data);
        expect(pixel).toEqual([255, 0, 0, 255]);
    });

    it("loops back to the same frame after a full duration", () => {
        const source = decodeLottie(fs.readFileSync(lottieFixture, "utf8"));

        const pixelAt = (elapsedMs) => {
            const canvas = source.renderAt(elapsedMs);
            return Array.from(canvas.getContext("2d").getImageData(60, 60, 1, 1).data);
        };

        expect(pixelAt(0)).toEqual(pixelAt(2000));
        expect(pixelAt(0)).toEqual(pixelAt(4000));
    });

    it("respects a Butt (lc=1) line cap instead of rendering it rounded", () => {
        // Regression for a real lottie.js bug (patched locally — see patches/lottie.js+0.4.0.patch
        // and test/simulator/probes/lottie-spike/LOTTIE-JS-ISSUE-stroke-cap.md): its pure-pixel
        // stroke rasterizer draws a full-radius round "join" disk at every polyline vertex near a
        // path endpoint, even when the endpoint's cap is Butt (flat) or Square, not Round. When an
        // endpoint-adjacent segment is shorter than the stroke's half-width (common on
        // tightly-sampled curves — the reported symptom was an animated Trim Path "growing circle"
        // border rendering with rounded ends despite a flat-capped stroke), those disks bulge past
        // the intended flat cap plane, rendering a round end regardless of `lc`.
        //
        // A first fix only clipped the single nearest vertex to each endpoint, which was
        // insufficient on curves finely-tessellated enough that SEVERAL consecutive vertices sit
        // within the half-width (each with its own protruding disk) — a real device comparison
        // caught the residual rounding, since a bezier-flattened ellipse arc has exactly this
        // point density. Fixed by clipping every disk whose cumulative PATH distance to an
        // endpoint is under the half-width, not just the nearest one.
        //
        // Fixture: an open 4-point straight polyline [[5,10],[6,10],[7,10],[8,10]] on a 20x20
        // canvas, stroke width 6 (half-width 3), lc=1 (Butt). Both vertex 1 (path-distance 1 from
        // the start) and vertex 2 (path-distance 2) are under the half-width of 3 — the disk at
        // vertex 2 alone (centered at x=7, radius 3) reaches back to x=4, past the endpoint's flat
        // cap plane at x=5, and was the exact case the single-nearest-vertex fix missed.
        const source = decodeLottie(fs.readFileSync(buttCapFixture, "utf8"));
        const canvas = source.renderAt(0);
        const ctx = canvas.getContext("2d");
        const pixelAt = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data);

        expect(pixelAt(3, 10)).toEqual([0, 0, 0, 0]); // behind the flat cap plane: transparent
        expect(pixelAt(4, 10)).toEqual([0, 0, 0, 0]); // vertex 2's disk reach — the missed case
        expect(pixelAt(7, 10)).toEqual([255, 0, 0, 255]); // inside the stroke body: opaque red
    });
});

describe("WebPFrameSource compositing (blend/dispose)", () => {
    // Pillow (the fixture generator used above) doesn't expose control over the raw ANMF
    // blend/dispose bits, so this exercises the compositing algorithm directly with synthetic
    // frames — regression for a real bug: the parsed `blend` flag was inverted relative to the
    // WebP container spec (bit B=0 means "alpha-blend", B=1 means "do not blend"/overwrite;
    // https://developers.google.com/speed/webp/docs/riff_container). A partial-rect frame with
    // blend=true (alpha-blend, the common case for a "small step" update) previously had its rect
    // cleared to transparent first, punching a transparent hole through to the background wherever
    // that small frame was itself transparent — a symptom a user reported live: "several frames
    // are showing corrupted, making the image transparent in some parts" on small-step frames.
    const RED = [255, 0, 0, 255];
    const TRANSPARENT = [0, 0, 0, 0];
    const BLUE = [0, 0, 255, 255];
    const GREEN = [0, 255, 0, 255];

    function solidRgba(color, width, height) {
        const data = new Uint8Array(width * height * 4);
        for (let i = 0; i < width * height; i++) {
            data.set(color, i * 4);
        }
        return data;
    }

    function pixelAt(source, elapsedMs, x, y) {
        const canvas = source.renderAt(elapsedMs);
        return Array.from(canvas.getContext("2d").getImageData(x, y, 1, 1).data);
    }

    it("blend=true (alpha-blend) preserves the prior frame under a transparent partial-rect update", () => {
        const source = new WebPFrameSource(4, 4, 0, [
            // Frame 0: full-canvas opaque red.
            { data: solidRgba(RED, 4, 4), x: 0, y: 0, w: 4, h: 4, durationMs: 100, dispose: false, blend: false },
            // Frame 1: a small 2x2 "step" at the corner, entirely transparent (nothing actually
            // changed there) — must NOT punch a hole through to reveal the canvas background;
            // frame 0's red must still show through.
            {
                data: solidRgba(TRANSPARENT, 2, 2),
                x: 0,
                y: 0,
                w: 2,
                h: 2,
                durationMs: 100,
                dispose: false,
                blend: true,
            },
        ]);

        expect(pixelAt(source, 100, 0, 0)).toEqual(RED);
        expect(pixelAt(source, 100, 3, 3)).toEqual(RED); // outside the partial rect, untouched
    });

    it("blend=false (overwrite) clears to transparent under a transparent partial-rect update", () => {
        const source = new WebPFrameSource(4, 4, 0, [
            { data: solidRgba(RED, 4, 4), x: 0, y: 0, w: 4, h: 4, durationMs: 100, dispose: false, blend: false },
            {
                data: solidRgba(TRANSPARENT, 2, 2),
                x: 0,
                y: 0,
                w: 2,
                h: 2,
                durationMs: 100,
                dispose: false,
                blend: false,
            },
        ]);

        expect(pixelAt(source, 100, 0, 0)).toEqual(TRANSPARENT);
        expect(pixelAt(source, 100, 3, 3)).toEqual(RED); // outside the partial rect, untouched
    });

    it("dispose=true clears the previous frame's rect before the next (non-overlapping) frame draws", () => {
        const source = new WebPFrameSource(4, 4, 0, [
            { data: solidRgba(BLUE, 2, 2), x: 0, y: 0, w: 2, h: 2, durationMs: 100, dispose: true, blend: false },
            { data: solidRgba(GREEN, 2, 2), x: 2, y: 2, w: 2, h: 2, durationMs: 100, dispose: false, blend: false },
        ]);

        expect(pixelAt(source, 100, 0, 0)).toEqual(TRANSPARENT); // frame 0's rect, disposed
        expect(pixelAt(source, 100, 2, 2)).toEqual(GREEN);
    });

    it("dispose=false leaves the previous frame's rect intact for the next (non-overlapping) frame", () => {
        const source = new WebPFrameSource(4, 4, 0, [
            { data: solidRgba(BLUE, 2, 2), x: 0, y: 0, w: 2, h: 2, durationMs: 100, dispose: false, blend: false },
            { data: solidRgba(GREEN, 2, 2), x: 2, y: 2, w: 2, h: 2, durationMs: 100, dispose: false, blend: false },
        ]);

        expect(pixelAt(source, 100, 0, 0)).toEqual(BLUE); // frame 0's rect, NOT disposed
        expect(pixelAt(source, 100, 2, 2)).toEqual(GREEN);
    });
});
