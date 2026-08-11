// Module Worker: renders via lottie.js's ImageSurface (no OffscreenCanvas needed for our actual
// integration shape — see node-spike.mjs's finding on `CanvasSurface` requiring `Path2D`) and
// reports back whether any DOM globals leaked into the worker's own scope.
import { parse, ImageSurface } from "./lottie.esm.js";

async function run() {
    const domGlobals = ["document", "window"].filter((name) => name in self);
    if (domGlobals.length) {
        postMessage({ ok: false, message: `unexpected DOM globals in worker: ${domGlobals.join(", ")}` });
        return;
    }
    const json = await (await fetch("./sample.json")).text();
    const anim = parse(json);
    const surface = new ImageSurface(anim.width, anim.height);
    const { data, width, height } = surface.render(anim, 0);
    const idx = (60 * width + 60) * 4;
    const pixel = Array.from(data.slice(idx, idx + 4));
    surface.dispose();
    postMessage({ ok: true, message: `rendered ${width}x${height}, pixel rgba(${pixel.join(",")})` });
}

run().catch((err) => postMessage({ ok: false, message: `threw: ${err?.message ?? err}` }));
