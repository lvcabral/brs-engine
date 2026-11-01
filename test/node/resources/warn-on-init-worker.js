// Stand-in background worker for test/node/backgroundHost.test.js: writes a warning the way Node 24
// does for `url.parse()` during HTTP requests, then idles like the real helper's heartbeat.
const { parentPort } = require("node:worker_threads");

parentPort.on("message", (message) => {
    if (message?.bg === "init") {
        process.emitWarning("simulated url.parse() deprecation", "DeprecationWarning", "DEP0169");
        setInterval(() => {}, 250);
    }
});
