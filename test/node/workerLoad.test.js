// Regression test for stopping a Task worker that is still loading its native modules.
// `worker.terminate()` landing while node-canvas initializes aborts the whole process with
// "FATAL ERROR: Error::ThrowAsJavaScriptException napi_throw" (see src/node/workerLoad.ts), which
// here would take down the test runner's fork. Drives src/node/task.ts with a worker that loads
// canvas the way the engine bundle does, stopping it the instant it launches, over and over.
import path from "node:path";
import { initTaskModule, handleTaskData, resetTasks } from "../../src/node/task.ts";
import { TaskState } from "../../src/core/common.ts";
const { pollUntil } = require("../testUtils/pollUntil");

const workerEntry = path.join(__dirname, "resources", "load-canvas-worker.js");
const slowLoadEntry = path.join(__dirname, "resources", "slow-load-task-worker.js");
// Each launch hits the window only now and then, so launch many: without the fix, 100 launches
// aborted the process on every run on a local machine. Tasks start and stop in batches, like an app
// running several tasks at once, which keeps the run short.
const BATCHES = 10;
const BATCH_SIZE = 10;

function makeAppPayload() {
    return {
        device: {},
        launchTime: 0,
        manifest: new Map(),
        deepLink: new Map(),
        paths: [],
        source: [],
    };
}

function runTask(id) {
    handleTaskData(
        { id, name: "LoadCanvasTask", state: TaskState.RUN, m: { top: { functionname: "run" } } },
        makeAppPayload()
    );
}

function stopTask(id) {
    handleTaskData({ id, name: "LoadCanvasTask", state: TaskState.STOP }, makeAppPayload());
}

async function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function batchIds(batch) {
    return Array.from({ length: BATCH_SIZE }, (_, i) => batch * BATCH_SIZE + i + 1);
}

describe("stopping a task worker that is still loading", () => {
    it("waits for the worker to load before terminating it (STOP)", async () => {
        const stopped = new Map();
        initTaskModule(new SharedArrayBuffer(4), workerEntry, (event, data) => {
            const match = event === "debug" && /^\[task:host\] Task worker stopped: (\d+)/.exec(String(data));
            if (match) {
                stopped.get(Number(match[1]))?.();
            }
        });
        for (let batch = 0; batch < BATCHES; batch++) {
            const ids = batchIds(batch);
            const allStopped = Promise.all(ids.map((id) => new Promise((resolve) => stopped.set(id, resolve))));
            for (const id of ids) {
                runTask(id);
                // Mirrors a different thread's `task.control = "stop"` the instant the task launched
                stopTask(id);
            }
            await allStopped;
        }
        // Reaching this point means the process survived every launch
        expect(stopped.size).toBe(BATCHES * BATCH_SIZE);
    }, 60000);

    it("waits for every worker to load before tearing them down (resetTasks)", async () => {
        initTaskModule(new SharedArrayBuffer(4), workerEntry, () => {});
        let launched = 0;
        for (let batch = 0; batch < BATCHES; batch++) {
            for (const id of batchIds(batch)) {
                runTask(id);
                launched++;
            }
            // Mirrors the app ending the instant its tasks launched (host.ts's cleanupApp)
            await resetTasks();
        }
        // Reaching this point means the process survived every launch
        expect(launched).toBe(BATCHES * BATCH_SIZE);
    }, 60000);
});

describe("a task stopped while its worker is loading", () => {
    let events;
    const count = (text) => events.filter((event) => event.includes(text)).length;

    beforeEach(() => {
        events = [];
        initTaskModule(new SharedArrayBuffer(4), slowLoadEntry, (event, data) => events.push(`${event}: ${data}`));
    });

    afterEach(async () => {
        await resetTasks();
    });

    it("never starts", async () => {
        runTask(1);
        stopTask(1);
        expect(await pollUntil(() => count("Task worker stopped: 1") > 0)).toBe(true);
        await delay(150);
        expect(count("PAYLOAD 1")).toBe(0);
        expect(count("Task worker stopped: 1")).toBe(1);
    });

    it("lets a new run of the same task start while it is torn down", async () => {
        runTask(1);
        stopTask(1);
        // Mirrors `task.control = "run"` again right after the stop
        runTask(1);
        expect(await pollUntil(() => count("Task worker stopped: 1") > 0)).toBe(true);
        expect(count("already running")).toBe(0);
        expect(count("PAYLOAD 1")).toBe(1);
        // The new run outlives the stopped run's teardown
        const alive = count("ALIVE 1");
        await delay(300);
        expect(count("ALIVE 1")).toBeGreaterThan(alive);
    });

    it("is torn down by resetTasks along with a task launched while it waits", async () => {
        runTask(1);
        const reset = resetTasks();
        // Mirrors the app worker launching a task while the host tears the app down
        runTask(2);
        await reset;
        await delay(300);
        expect(count("PAYLOAD")).toBe(0);
        expect(count("Task worker stopped: 2")).toBe(1);
    });
});
