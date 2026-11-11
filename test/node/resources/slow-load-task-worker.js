// Stand-in Task worker for test/node/workerLoad.test.js with a fixed 200 ms load. Like the engine
// bundle (src/core/index.ts), it attaches its message handler and posts WorkerReady only once loaded,
// so messages posted during the load are handled right after it. On a task payload it prints
// "PAYLOAD <id>", then "ALIVE <id>" every 100 ms like a running task, until terminated.
const { parentPort } = require("node:worker_threads");

setTimeout(() => {
    parentPort.on("message", (message) => {
        const id = message?.taskData?.id;
        if (id !== undefined) {
            parentPort.postMessage(`print,PAYLOAD ${id}`);
            setInterval(() => parentPort.postMessage(`print,ALIVE ${id}`), 100);
        }
    });
    parentPort.postMessage({ workerReady: true });
}, 200);
setInterval(() => {}, 1000);
