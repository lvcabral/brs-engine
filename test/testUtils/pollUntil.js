/** Repeatedly calls `fn()` until it returns a truthy value or `timeoutMs` elapses, waiting
 *  `stepMs` between calls. Returns the truthy value, or `fn()`'s own (falsy) result on timeout.
 *  Shared by tests that poll real, asynchronous cross-thread/cross-process I/O (a message port, a
 *  SharedEventQueue) with real timers rather than fake ones. */
async function pollUntil(fn, timeoutMs = 5000, stepMs = 10) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const result = fn();
        if (result) {
            return result;
        }
        await new Promise((resolve) => setTimeout(resolve, stepMs));
    }
    return fn();
}

module.exports = { pollUntil };
