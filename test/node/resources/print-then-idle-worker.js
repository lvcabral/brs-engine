// Minimal stand-in for a SceneGraph Task worker: mirrors what `OutputProxy.write()` does for a
// real BrightScript `print` (postMessage a "print,<text>" string, see src/core/device/
// OutputProxy.ts), then idles like a Task parked in a `wait()` loop until force-terminated.
// Used to drive `src/node/task.ts`'s real runTask/endTask/resetTasks against a controlled worker
// without needing a full BrightScript payload.
const { parentPort } = require("worker_threads");

parentPort.postMessage("print,TASK_PRINT_MARKER");
parentPort.on("message", () => {});
setInterval(() => {}, 1000);
