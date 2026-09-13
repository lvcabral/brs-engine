// Exercises `src/api/webSocketHost.ts` directly (not a compiled bundle) because this module's
// logic lives on the browser main-thread side of the roWebSocket bridge (see
// `src/core/device/WebSocketBrowserBridge.ts` for the worker-side half) and is never reached by
// the `packages/node/bin` bundle the rest of the suite imports for `roXxx` component behavior.
// Node 22's global `WebSocket`/`atob`/`btoa` stand in for the browser's — same API surface this
// module actually calls.
import { isWebSocketCommand, handleWebSocketCommand, disposeSocketsForRealm } from "../../src/api/webSocketHost.ts";
import { SharedEventQueue } from "../../src/core/SharedEventQueue.ts";
import { WebSocketServer } from "ws";
const { pollUntil } = require("../testUtils/pollUntil");

// `SharedEventQueue.drain()` is destructive (it empties the queue), so a helper that drains fresh
// on every poll would silently lose any event of a type the caller wasn't looking for that
// happened to arrive in the same batch. Accumulate everything drained into `collected` instead,
// and match against the running list.
function waitForEvent(queue, collected, predicate, timeoutMs = 5000) {
    return pollUntil(() => {
        collected.push(...queue.drain());
        return collected.find(predicate);
    }, timeoutMs);
}

describe("webSocketHost", () => {
    let server;
    let serverUrl;
    let nextId = 1;

    function newId() {
        return `sock-${nextId++}`;
    }

    beforeAll(async () => {
        server = new WebSocketServer({ port: 0 });
        await new Promise((resolve) => server.once("listening", resolve));
        serverUrl = `ws://127.0.0.1:${server.address().port}`;
    });

    afterAll(async () => {
        await new Promise((resolve) => server.close(resolve));
    });

    afterEach(() => {
        server.clients.forEach((client) => client.close());
    });

    describe("isWebSocketCommand", () => {
        it("recognizes a well-formed command and rejects everything else", () => {
            expect(isWebSocketCommand({ webSocketCommand: "open", id: "abc" })).toBe(true);
            expect(isWebSocketCommand({ webSocketCommand: "open" })).toBe(false);
            expect(isWebSocketCommand({ webSocketCommand: "open", id: 1 })).toBe(false);
            expect(isWebSocketCommand({ id: "abc" })).toBe(false);
            expect(isWebSocketCommand("open")).toBe(false);
            expect(isWebSocketCommand(null)).toBe(false);
            expect(isWebSocketCommand(undefined)).toBe(false);
        });
    });

    describe("open/send/close against a real server", () => {
        it("delivers opened, msgSent, text, and closed events through the shared queue", async () => {
            const id = newId();
            const queue = new SharedEventQueue();
            const collected = [];

            let serverReceived;
            server.once("connection", (ws) => {
                ws.on("message", (msg) => {
                    serverReceived = msg.toString("utf8");
                    ws.send("reply from server");
                });
            });

            handleWebSocketCommand({
                webSocketCommand: "open",
                id,
                realm: 0,
                buffer: queue.getBuffer(),
                url: serverUrl,
            });

            const opened = await waitForEvent(queue, collected, (e) => e.type === "opened");
            expect(opened).not.toBeUndefined();

            handleWebSocketCommand({ webSocketCommand: "send", id, text: "hello", msgId: 42 });

            const sent = await waitForEvent(
                queue,
                collected,
                (e) => e.type === "msgSent" && e.msgId === 42 && e.opcode === 1
            );
            expect(sent).not.toBeUndefined();

            // `msgSent` only confirms the socket accepted the write, not that the server has
            // processed it yet — poll separately for the server's own side effect.
            const deadline = Date.now() + 2000;
            while (serverReceived === undefined && Date.now() < deadline) {
                await new Promise((resolve) => setTimeout(resolve, 10));
            }
            expect(serverReceived).toEqual("hello");

            const reply = await waitForEvent(queue, collected, (e) => e.type === "text");
            expect(reply?.text).toEqual("reply from server");

            handleWebSocketCommand({ webSocketCommand: "close", id, code: 1000, reason: "bye" });
            const closed = await waitForEvent(queue, collected, (e) => e.type === "closed");
            expect(closed).not.toBeUndefined();
        }, 10000);

        it("delivers a binary message as a base64 data event", async () => {
            const id = newId();
            const queue = new SharedEventQueue();
            const collected = [];

            server.once("connection", (ws) => {
                ws.send(Buffer.from([9, 8, 7]));
            });

            handleWebSocketCommand({
                webSocketCommand: "open",
                id,
                realm: 0,
                buffer: queue.getBuffer(),
                url: serverUrl,
            });

            const dataEvent = await waitForEvent(queue, collected, (e) => e.type === "data");
            expect(dataEvent).not.toBeUndefined();
            expect(Buffer.from(dataEvent.dataBase64, "base64")).toEqual(Buffer.from([9, 8, 7]));

            handleWebSocketCommand({ webSocketCommand: "dispose", id });
        }, 10000);

        it("reports an error event when the URL cannot be opened", async () => {
            const id = newId();
            const queue = new SharedEventQueue();
            const collected = [];

            handleWebSocketCommand({
                webSocketCommand: "open",
                id,
                realm: 0,
                buffer: queue.getBuffer(),
                url: "not a url",
            });

            const errorEvent = await waitForEvent(queue, collected, (e) => e.type === "error");
            expect(errorEvent).not.toBeUndefined();
        });

        it("ignores sendPing/sendPong/unknown commands without throwing", () => {
            const id = newId();
            const queue = new SharedEventQueue();
            expect(() => {
                handleWebSocketCommand({ webSocketCommand: "sendPing", id });
                handleWebSocketCommand({ webSocketCommand: "sendPong", id });
                handleWebSocketCommand({ webSocketCommand: "send", id: "nobody-home", text: "nobody home", msgId: 1 });
            }).not.toThrow();
            expect(queue.drain()).toEqual([]);
        });
    });

    describe("disposeSocketsForRealm", () => {
        it("closes only sockets owned by the given realm, leaving others untouched", async () => {
            const appId = newId();
            const taskId = newId();
            const appQueue = new SharedEventQueue();
            const taskQueue = new SharedEventQueue();
            const appCollected = [];
            const taskCollected = [];

            server.on("connection", (ws) => {}); // accept both connections silently

            handleWebSocketCommand({
                webSocketCommand: "open",
                id: appId,
                realm: 0,
                buffer: appQueue.getBuffer(),
                url: serverUrl,
            });
            handleWebSocketCommand({
                webSocketCommand: "open",
                id: taskId,
                realm: 7,
                buffer: taskQueue.getBuffer(),
                url: serverUrl,
            });

            await waitForEvent(appQueue, appCollected, (e) => e.type === "opened");
            await waitForEvent(taskQueue, taskCollected, (e) => e.type === "opened");

            disposeSocketsForRealm(7);
            const taskClosed = await waitForEvent(taskQueue, taskCollected, (e) => e.type === "closed");
            expect(taskClosed).not.toBeUndefined();

            // The app-realm socket must still be usable — disposing realm 7 must not have touched it.
            handleWebSocketCommand({ webSocketCommand: "send", id: appId, text: "still alive", msgId: 1 });
            const stillSent = await waitForEvent(appQueue, appCollected, (e) => e.type === "msgSent" && e.msgId === 1);
            expect(stillSent).not.toBeUndefined();

            handleWebSocketCommand({ webSocketCommand: "dispose", id: appId });
        }, 10000);
    });
});
