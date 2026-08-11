// Same ImageSurface render, run inside a `worker_threads` Worker — mirrors where this engine's
// real interpreter executes (see docs/threading-and-rendezvous.md: the Node build runs the app/Task
// on a worker thread, never the main thread).
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

if (isMainThread) {
    const worker = new Worker(fileURLToPath(import.meta.url));
    worker.on("message", (msg) => {
        console.log(msg);
        if (msg.startsWith("FAIL")) {
            process.exitCode = 1;
        }
        worker.terminate();
    });
    worker.on("error", (err) => {
        console.error("FAIL: worker threw:", err);
        process.exitCode = 1;
    });
} else {
    const domGlobals = ["document", "window"].filter((name) => name in globalThis);
    if (domGlobals.length) {
        parentPort.postMessage(`FAIL: unexpected DOM globals present in worker: ${domGlobals.join(", ")}`);
    } else {
        const { parse, ImageSurface } = await import("lottie.js");
        const json = await readFile(new URL("./sample.json", import.meta.url), "utf8");
        const anim = parse(json);
        const surface = new ImageSurface(anim.width, anim.height);
        const { data, width, height } = surface.render(anim, 0);
        const idx = (60 * width + 60) * 4;
        const pixel = Array.from(data.slice(idx, idx + 4));
        surface.dispose();
        parentPort.postMessage(`PASS: rendered inside worker_threads, ${width}x${height}, pixel rgba(${pixel.join(",")})`);
    }
}
