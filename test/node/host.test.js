const path = require("path");
const brs = require("../../packages/node/bin/brs.node");

// Library-level tests for the worker host API (`executeApp`): the app runs on a
// worker_threads thread (the render thread) and SceneGraph Tasks get their own workers,
// mirroring the browser architecture. Requires `npm run build:cli`.

const deviceData = {
    developerId: "34c6fceca75e456f25e7e99531e2425c6c1de443",
    locale: "en_US",
    displayMode: "1080p",
    customFeatures: [],
    localIps: ["127.0.0.1,lo0"],
    entryPoint: true,
};

describe("worker host (executeApp)", () => {
    jest.setTimeout(30000);

    it("runs a SceneGraph app with a Task thread and delivers events to subscribers", async () => {
        const root = path.join(__dirname, "..", "cli", "resources", "task-app");
        const payload = await brs.createPayloadFromFiles([], deviceData, undefined, root);
        payload.extensions = [brs.SupportedExtension.SceneGraph];
        payload.device.extensions = new Map([[brs.SupportedExtension.SceneGraph, "brs-sg.node.js"]]);

        const messages = [];
        brs.subscribeHost("test", (event, data) => {
            if (event === "message" && typeof data === "string" && data.startsWith("print,")) {
                messages.push(data.slice(6).trimEnd());
            }
        });
        try {
            const result = await brs.executeApp(payload);
            expect(result.exitReason).toEqual("EXIT_USER_NAV");
            expect(messages).toContain("=== Task Thread Repro ===");
            expect(messages).toContain("TASK RESULT: from-task-thread:ping");
            expect(messages).toContain("=== Task Thread Repro Complete ===");
        } finally {
            brs.unsubscribeHost("test");
        }
    });

    it("rejects a second app while one is running and supports terminateApp", async () => {
        const root = path.join(__dirname, "..", "cli", "resources", "task-app");
        const payload = await brs.createPayloadFromFiles([], deviceData, undefined, root);
        payload.extensions = [brs.SupportedExtension.SceneGraph];
        payload.device.extensions = new Map([[brs.SupportedExtension.SceneGraph, "brs-sg.node.js"]]);

        const running = brs.executeApp(payload);
        await expect(brs.executeApp(payload)).rejects.toThrow("already running");
        brs.terminateApp();
        const result = await running;
        expect(typeof result.exitReason).toEqual("string");
    });
});
