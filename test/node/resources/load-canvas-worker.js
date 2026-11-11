// Stand-in for a Task worker's startup: spends a random 0-100 ms loading "the rest of the bundle",
// then loads node-canvas, the native module the engine bundle imports (src/core/index.ts), posts
// WorkerReady and idles like a Task parked in a `wait()` loop. Terminating a worker while canvas is
// still initializing aborts the whole process (FATAL ERROR: Error::ThrowAsJavaScriptException
// napi_throw), which src/node/workerLoad.ts prevents. The random delay moves canvas's load across the
// moment a host that doesn't wait for WorkerReady would terminate the worker.
const { parentPort } = require("worker_threads");

parentPort.on("message", () => {});
setTimeout(() => {
    require("canvas");
    parentPort.postMessage({ workerReady: true });
}, Math.random() * 100);
setInterval(() => {}, 1000);
