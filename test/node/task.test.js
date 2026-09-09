// Exercises `src/node/task.ts` directly (not a compiled bundle), driving a real worker_threads
// worker through the same functions the Node host uses (initTaskModule/handleTaskData/
// resetTasks), instead of a full BrightScript payload. This lets the test control the exact race
// this suite regresses: a task's `print` (delivered via `postMessage`, see OutputProxy.write() in
// src/core/device/OutputProxy.ts) racing an unrelated thread's decision to tear the task down.
import path from "node:path";
import { initTaskModule, handleTaskData, resetTasks } from "../../src/node/task.ts";
import { TaskState } from "../../src/core/common.ts";

const workerEntry = path.join(__dirname, "resources", "print-then-idle-worker.js");

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

function startTask(id, notify) {
    initTaskModule(new SharedArrayBuffer(4), workerEntry, notify);
    handleTaskData(
        { id, name: "PrintThenIdleTask", state: TaskState.RUN, m: { top: { functionname: "run" } } },
        makeAppPayload()
    );
}

describe("task worker teardown does not drop an in-flight print", () => {
    it("captures a task's print when another thread stops it with zero elapsed time (STOP)", async () => {
        const events = [];
        startTask(1, (event, data) => events.push({ event, data }));
        // Mirrors a different thread's `task.control = "stop"` landing the instant the task
        // launched, with no guaranteed gap after its print -- the regression this suite covers.
        handleTaskData({ id: 1, name: "PrintThenIdleTask", state: TaskState.STOP }, makeAppPayload());
        // endTask() is async (it awaits the drain); give its microtask/timer chain a turn.
        await new Promise((resolve) => setTimeout(resolve, 750));

        const printed = events.some((e) => e.event === "message" && String(e.data).includes("TASK_PRINT_MARKER"));
        expect(printed).toBe(true);
    });

    it("captures a task's print when the app ends and tears down all tasks (resetTasks)", async () => {
        const events = [];
        startTask(2, (event, data) => events.push({ event, data }));
        // Mirrors the app worker's "end" landing the instant the task launched -- resetTasks()
        // is what host.ts's cleanupApp() calls on every app termination.
        await resetTasks();

        const printed = events.some((e) => e.event === "message" && String(e.data).includes("TASK_PRINT_MARKER"));
        expect(printed).toBe(true);
    });
});
