// Throwaway probe (no brs-engine import): validates lottie.js can render a Lottie/Bodymovin
// document headlessly, with no DOM, in plain Node.
//
// Finding: `CanvasSurface` calls the browser-only global `Path2D` internally (`new Path2D()` in
// `opPath`), which the `canvas` npm package does NOT provide (confirmed: `Object.keys(require('canvas'))`
// has no `Path2D`) — so `CanvasSurface` is NOT usable against this engine's Node `BrsCanvas` backend
// without an extra polyfill dependency (`path2d-polyfill`), which would make the whole stack
// (lottie.js + path2d-polyfill + its own `path2d` dep) the opposite of the "pure-JS, zero-dep"
// philosophy this spike is supposed to preserve.
//
// `ImageSurface`, however, is lottie.js's separate pure-pixel rasterizer (the README's own
// "server-side rendering with no native code and no browser" path) — it returns raw RGBA bytes
// directly, with no canvas/Path2D involved at all. That is also the RIGHT integration shape for
// this engine anyway: `AnimatedFrameSource.renderAt()` just needs RGBA bytes to hand to
// `context.createImageData()`/`putImageAtPos()`, exactly like `RoBitmap`'s existing PNG/JPEG/WebP
// decoders already do — so `decodeLottie` should target `ImageSurface`, not `CanvasSurface`.
import { readFile, writeFile } from "node:fs/promises";
import { parse, ImageSurface } from "lottie.js";

// `navigator`/`fetch` are Node's own built-in globals since v18+, unrelated to any DOM shim —
// `document`/`window` are the real markers of a library reaching for a browser environment.
const domGlobals = ["document", "window"].filter((name) => name in globalThis);
if (domGlobals.length) {
    console.error(`FAIL: unexpected DOM globals present: ${domGlobals.join(", ")}`);
    process.exit(1);
}

const json = await readFile(new URL("./sample.json", import.meta.url), "utf8");
const anim = parse(json);
console.log(`parsed: ${anim.width}x${anim.height}, duration=${anim.duration}, frameRate=${anim.frameRate}`);

const imageSurface = new ImageSurface(anim.width, anim.height);
for (const frame of [0, 15, 30, 45]) {
    const { data, width, height } = imageSurface.render(anim, frame);
    // Sample the pixel at the rect's unrotated top-left-ish corner (60,60) relative to a
    // 200x200 canvas with the shape centered at (100,100), 80x80 — inside the rect pre-rotation.
    const idx = (60 * width + 60) * 4;
    const pixel = Array.from(data.slice(idx, idx + 4));
    console.log(`ImageSurface frame ${frame}: ${width}x${height}, sample pixel rgba(${pixel.join(",")})`);
}
const png = await imageSurface.png(anim, 0);
await writeFile(new URL("./out-image-frame0.png", import.meta.url), Buffer.from(png));
const pngMid = await imageSurface.png(anim, 15);
await writeFile(new URL("./out-image-frame15.png", import.meta.url), Buffer.from(pngMid));
imageSurface.dispose();

console.log("PASS (ImageSurface path): rendered with no DOM globals and no Path2D dependency");
