import http from "node:http";
import { Interpreter } from "../../src/core/interpreter/index.ts";
import {
    BrsString,
    RoMessagePort,
    RoTextureManager,
    RoTextureRequest,
    RoURLEvent,
    RoURLTransfer,
} from "../../src/core/brsTypes/index.ts";
import {
    backgroundAvailable,
    backgroundJobsPending,
    handleBackgroundMessage,
} from "../../src/core/device/BackgroundWorker.ts";

// The interpreter side of the components, connected to a helper running in this same process the
// way a host connects them (a MessageChannel port per thread), so the async paths run end to end.
// Kept in its own file: connecting changes this module instance's state for every later test.
const { pollUntil } = require("../testUtils/pollUntil");

describe("background jobs of components", () => {
    let interpreter;
    let server;
    let baseUrl;

    beforeAll(async () => {
        const heartbeat = new SharedArrayBuffer(4);
        handleBackgroundMessage({ bg: "init", heartbeat });
        const channel = new MessageChannel();
        handleBackgroundMessage({ bg: "port", thread: 1, port: channel.port1 });
        handleBackgroundMessage({ bg: "connect", port: channel.port2, heartbeat });
        server = http.createServer((req, res) => {
            const delay = req.url === "/slow" ? 1000 : 0;
            setTimeout(() => {
                res.writeHead(200, { "Content-Type": "text/plain" });
                res.end("ok");
            }, delay);
        });
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    afterAll(async () => {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
    });

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    function newTransfer(url, port) {
        const transfer = new RoURLTransfer();
        transfer.getMethod("setUrl").call(interpreter, new BrsString(url));
        if (port) {
            transfer.getMethod("setMessagePort").call(interpreter, port);
        }
        return transfer;
    }

    it("delivers an async transfer through its port", async () => {
        expect(backgroundAvailable()).toBe(true);
        const port = new RoMessagePort();
        const transfer = newTransfer(`${baseUrl}/text`, port);
        transfer.getMethod("asyncGetToString").call(interpreter);
        expect(backgroundJobsPending()).toBe(true);
        const event = await pollUntil(() => {
            const message = port.getMethod("getMessage").call(interpreter);
            return message instanceof RoURLEvent && message;
        });
        expect(event).toBeInstanceOf(RoURLEvent);
        expect(event.getStatus()).toBe(200);
        expect(event.getMethod("getString").call(interpreter).value).toBe("ok");
        expect(backgroundJobsPending()).toBe(false);
    });

    it("cancels the in-flight transfers of a disposed roUrlTransfer", () => {
        const transfer = newTransfer(`${baseUrl}/slow`, new RoMessagePort());
        transfer.getMethod("asyncGetToString").call(interpreter);
        expect(backgroundJobsPending()).toBe(true);
        transfer.dispose();
        expect(backgroundJobsPending()).toBe(false);
    });

    it("builds a failure event from a result the thread couldn't receive", () => {
        const transfer = newTransfer(`${baseUrl}/text`);
        const event = transfer.asyncTransferEvent({
            job: { result: { failure: "result too large (600000000 bytes)" } },
            options: { method: "GET", responseType: "text", scope: "getToStringEvent", action: "getting" },
            url: `${baseUrl}/text`,
            host: "127.0.0.1",
        });
        expect(event.getStatus()).toBe(-1);
        expect(event.getMethod("getFailureReason").call(interpreter).value).toBe("result too large (600000000 bytes)");
        expect(() => event.getMethod("getResponseHeaders").call(interpreter)).not.toThrow();
    });

    describe("roTextureManager", () => {
        const uri = "http://127.0.0.1:1/image.png";

        it("starts no background job for an async request without a message port", () => {
            const manager = new RoTextureManager();
            manager.getMethod("requestTexture").call(interpreter, new RoTextureRequest(new BrsString(uri)));
            expect(backgroundJobsPending()).toBe(false);
        });

        it("stops the background job when its last request is cancelled", () => {
            const manager = new RoTextureManager();
            manager.getMethod("setMessagePort").call(interpreter, new RoMessagePort());
            const request = new RoTextureRequest(new BrsString(`${baseUrl}/slow`));
            manager.getMethod("requestTexture").call(interpreter, request);
            expect(backgroundJobsPending()).toBe(true);
            manager.getMethod("cancelRequest").call(interpreter, request);
            expect(backgroundJobsPending()).toBe(false);
        });

        it("doesn't cache a decoded result that makes no valid bitmap", () => {
            // The built bundle has the Node canvas a bitmap needs (the sources pick the browser's)
            const brs = require("../../packages/node/bin/brs.node");
            const manager = new brs.types.RoTextureManager();
            const job = { result: { meta: { width: 0, height: 0 }, payload: new Uint8Array(0) } };
            expect(manager.applyJobResult(uri, job)).toBeNull();
            expect(manager.count()).toBe(0);
        });

        it("waits on an in-flight download only when the request headers match", () => {
            const manager = new RoTextureManager();
            const job = {
                wait: () => {
                    throw new Error("waited on the job");
                },
            };
            manager.loadData = () => undefined;
            manager.jobs.set(uri, { job, headers: JSON.stringify([]) });
            expect(manager.loadTexture(uri, new Map([["Authorization", "Bearer x"]]))).toBeUndefined();
            expect(() => manager.loadTexture(uri, new Map())).toThrow("waited on the job");
        });
    });
});
