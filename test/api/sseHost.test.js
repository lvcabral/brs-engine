// Exercises `src/api/sseHost.ts` directly: it is the browser main-thread half of
// roUrlTransfer.AsyncGetSSEvents() (see `src/core/device/SseBridge.ts`) and never reached by the
// `packages/node/bin` bundle. Node 22's global `fetch` stands in for the browser's.
import { isSseCommand, handleSseCommand, disposeSseForRealm } from "../../src/api/sseHost.ts";
import { SharedEventQueue } from "../../src/core/SharedEventQueue.ts";
const { fork } = require("child_process");
const path = require("path");
const { pollUntil } = require("../testUtils/pollUntil");

describe("sseHost", () => {
    let serverProcess;
    let baseUrl;

    beforeAll(async () => {
        serverProcess = fork(path.join(__dirname, "..", "brsTypes", "components", "resources", "sseServer.js"), {
            stdio: "pipe",
        });
        const port = await new Promise((resolve) => serverProcess.once("message", (msg) => resolve(msg.port)));
        baseUrl = `http://127.0.0.1:${port}`;
    });

    afterAll(() => {
        serverProcess.disconnect();
    });

    function start(id, route, realm = 0) {
        const queue = new SharedEventQueue();
        const cmd = {
            sseCommand: "start",
            id,
            realm,
            buffer: queue.getBuffer(),
            url: baseUrl + route,
            method: "GET",
            headers: { "Last-Event-ID": "42" },
        };
        expect(isSseCommand(cmd)).toBe(true);
        handleSseCommand(cmd);
        return queue;
    }

    function collect(queue, collected, predicate) {
        return pollUntil(() => {
            collected.push(...queue.drain());
            return collected.find(predicate);
        });
    }

    it("recognizes only SSE commands", () => {
        expect(isSseCommand({ sseCommand: "abort", id: "x" })).toBe(true);
        expect(isSseCommand({ webSocketCommand: "open", id: "x" })).toBe(false);
        expect(isSseCommand("print")).toBe(false);
        expect(isSseCommand(null)).toBe(false);
    });

    it("streams the response, then ends", async () => {
        const collected = [];
        const queue = start("stream", "/stream");
        await collect(queue, collected, (p) => p.type === "end");
        const response = collected[0];
        expect(response.type).toBe("response");
        expect(response.status).toBe(200);
        expect(response.contentType).toBe("text/event-stream");
        const text = collected
            .filter((p) => p.type === "chunk")
            .map((p) => p.text)
            .join("");
        expect(text).toContain("data: hello");
        expect(text).toContain("data: done");
    });

    it("forwards request headers", async () => {
        const collected = [];
        const queue = start("last-id", "/last-id");
        await collect(queue, collected, (p) => p.type === "end");
        expect(collected.find((p) => p.type === "chunk").text).toBe("data: 42\n\n");
    });

    it("reports connection failures", async () => {
        const collected = [];
        const queue = new SharedEventQueue();
        handleSseCommand({
            sseCommand: "start",
            id: "refused",
            realm: 0,
            buffer: queue.getBuffer(),
            url: "http://127.0.0.1:1/",
            method: "GET",
            headers: {},
        });
        const error = await collect(queue, collected, (p) => p.type === "error");
        expect(error.code).toBe(-7);
    });

    it("waits for the worker to drain a full queue instead of dropping data", async () => {
        const queue = new SharedEventQueue(8 * 1024, 512 * 1024);
        let dropped = false;
        queue.onError = () => {
            dropped = true;
        };
        handleSseCommand({
            sseCommand: "start",
            id: "big",
            realm: 0,
            buffer: queue.getBuffer(),
            url: baseUrl + "/big",
            method: "GET",
            headers: {},
        });
        let length = 0;
        const end = await pollUntil(
            () => {
                for (const p of queue.drain()) {
                    if (p.type === "chunk") {
                        length += p.text.length;
                    } else if (p.type === "end") {
                        return p;
                    }
                }
                return undefined;
            },
            10000,
            25
        );
        expect(end).toBeDefined();
        expect(length).toBe(1024 * 1024);
        expect(dropped).toBe(false);
    });

    it("stops streaming on abort and on realm disposal", async () => {
        for (const stop of [() => handleSseCommand({ sseCommand: "abort", id: "f1" }), () => disposeSseForRealm(3)]) {
            const collected = [];
            const queue = start("f1", "/forever", 3);
            await collect(queue, collected, (p) => p.type === "chunk");
            stop();
            await new Promise((resolve) => setTimeout(resolve, 100));
            collected.push(...queue.drain());
            expect(collected.some((p) => p.type === "end" || p.type === "error")).toBe(false);
        }
    });
});
