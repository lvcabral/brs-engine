// Regression: the Node host's background worker writing anything (Node 24 emits a DEP0169 warning
// for `url.parse()` during HTTP requests) to its piped stderr kept the CLI process alive after the
// app ended, so every CLI run that used it hung. Its output must reach the host as events, and the
// host must terminate it when the app ends.
import path from "node:path";
import { connectBackground, stopBackground } from "../../src/node/backgroundHost.ts";
const { pollUntil } = require("../testUtils/pollUntil");

const workerEntry = path.join(__dirname, "resources", "warn-on-init-worker.js");

describe("Node background host", () => {
    it("forwards the helper's output and terminates it when the app ends", async () => {
        const output = [];
        const thread = { postMessage: () => {} };
        connectBackground(thread, workerEntry, (stream, text) => output.push(`${stream}: ${text}`));
        expect(await pollUntil(() => output.some((line) => line.includes("simulated url.parse()")))).toBe(true);
        expect(output.find((line) => line.includes("simulated"))).toMatch(/^stderr: /);
        await expect(stopBackground()).resolves.toBeUndefined();
    });

    it("starts a new helper for the next app run", async () => {
        const output = [];
        connectBackground({ postMessage: () => {} }, workerEntry, (stream, text) => output.push(text));
        expect(await pollUntil(() => output.length > 0)).toBe(true);
        await stopBackground();
    });
});
