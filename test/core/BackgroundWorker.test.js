import http from "node:http";
import { createCanvas } from "canvas";
import {
    backgroundAvailable,
    handleBackgroundMessage,
    isBackgroundMessage,
    startBackgroundJob,
} from "../../src/core/device/BackgroundWorker.ts";

const { pollUntil } = require("../testUtils/pollUntil");

// These tests drive the helper side in-process, connected like a host connects an interpreter
// thread (a MessageChannel port per thread), and play the thread's part of the protocol by hand:
// post a job, wait for Ready, send a buffer of the announced size, then read the result once
// Delivered.
const Running = 0;
const Ready = 1;
const Delivered = 2;
let nextId = 1000;
let nextThread = 1;

/** Registers a thread port with the helper, returning the thread's end of it. */
function connectThread() {
    const channel = new MessageChannel();
    handleBackgroundMessage({ bg: "port", thread: nextThread++, port: channel.port1 });
    return channel.port2;
}

async function reachesState(control, state) {
    expect(await pollUntil(() => Atomics.load(control, 0) === state)).toBe(true);
}

const thread = connectThread();

async function runJob(params, port = thread, id = nextId++) {
    const control = new Int32Array(new SharedArrayBuffer(8));
    port.postMessage({ bg: "job", id, control: control.buffer, params });
    await reachesState(control, Ready);
    const buffer = new SharedArrayBuffer(control[1]);
    port.postMessage({ bg: "buffer", id, buffer });
    await reachesState(control, Delivered);
    const metaLength = new DataView(buffer).getUint32(0);
    const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, metaLength).slice()));
    return { meta, payload: new Uint8Array(buffer, 4 + metaLength).slice() };
}

function png(width, height) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#00ff00";
    ctx.fillRect(0, 0, width, height);
    return canvas.toBuffer("image/png");
}

function httpParams(url, extra = {}) {
    return { method: "GET", url, headers: [], withCredentials: false, responseType: "text", ...extra };
}

describe("BackgroundWorker", () => {
    let server;
    let baseUrl;
    const image = png(6, 3);

    beforeAll(async () => {
        server = http.createServer((req, res) => {
            if (req.url === "/text") {
                res.writeHead(200, { "Content-Type": "text/plain", "X-Probe": "yes" });
                res.end("héllo");
            } else if (req.url === "/echo") {
                let body = "";
                req.on("data", (chunk) => (body += chunk));
                req.on("end", () => {
                    res.writeHead(201, { "Content-Type": "text/plain" });
                    res.end(`${req.method}:${req.headers["x-custom"]}:${body}`);
                });
            } else if (req.url === "/image.png") {
                res.writeHead(200, { "Content-Type": "image/png" });
                res.end(image);
            } else if (req.url === "/slow") {
                setTimeout(() => res.end("late"), 2000);
            } else {
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("missing");
            }
        });
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    afterAll(async () => {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
    });

    it("recognizes background messages", () => {
        expect(isBackgroundMessage({ bg: "cancel", id: 1 })).toBe(true);
        expect(isBackgroundMessage({ bg: 1 })).toBe(false);
        expect(isBackgroundMessage(null)).toBe(false);
        expect(isBackgroundMessage("getVersion")).toBe(false);
    });

    it("is unavailable on a thread that isn't an interpreter worker", () => {
        expect(backgroundAvailable()).toBe(false);
        expect(startBackgroundJob({ kind: "image", image: new Uint8Array(image) })).toBeUndefined();
    });

    it("bumps the heartbeat when it boots, and then periodically", async () => {
        const heartbeat = new Int32Array(new SharedArrayBuffer(4));
        handleBackgroundMessage({ bg: "init", heartbeat: heartbeat.buffer });
        expect(Atomics.load(heartbeat, 0)).toBe(1);
        expect(await pollUntil(() => Atomics.load(heartbeat, 0) > 1, 2000)).toBe(true);
    });

    it("scopes job ids to each thread's port", async () => {
        const ports = [connectThread(), connectThread()];
        const widths = [];
        for (const [index, port] of ports.entries()) {
            // Both threads use the same job id
            const { meta } = await runJob({ kind: "image", image: new Uint8Array(png(index + 1, 1)) }, port, 1);
            widths.push(meta.width);
        }
        expect(widths).toEqual([1, 2]);
    });

    it("drops a released thread's jobs", async () => {
        const id = nextThread;
        const port = connectThread();
        const control = new Int32Array(new SharedArrayBuffer(8));
        port.postMessage({
            bg: "job",
            id: 1,
            control: control.buffer,
            params: { kind: "http", http: httpParams(`${baseUrl}/slow`) },
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
        handleBackgroundMessage({ bg: "release", thread: id });
        // The slow response would have arrived by now; the aborted job never publishes it
        await new Promise((resolve) => setTimeout(resolve, 2300));
        expect(Atomics.load(control, 0)).toBe(Running);
    });

    describe("image jobs", () => {
        it("decodes image bytes into RGBA8 pixels", async () => {
            const { meta, payload } = await runJob({ kind: "image", image: new Uint8Array(image) });
            expect(meta).toEqual({ width: 6, height: 3 });
            expect(payload.length).toBe(6 * 3 * 4);
            expect(Array.from(payload.subarray(0, 4))).toEqual([0, 255, 0, 255]);
        });

        it("reports an invalid image", async () => {
            const { meta, payload } = await runJob({ kind: "image", image: new TextEncoder().encode("nope") });
            expect(meta.error).toBe("Invalid image format");
            expect(payload.length).toBe(0);
        });

        it("downloads and decodes a remote image", async () => {
            const http = httpParams(`${baseUrl}/image.png`, { responseType: "arraybuffer" });
            const { meta } = await runJob({ kind: "image", http });
            expect(meta).toEqual({ width: 6, height: 3 });
        });

        it("reports a failed download", async () => {
            const http = httpParams(`${baseUrl}/missing.png`, { responseType: "arraybuffer" });
            const { meta } = await runJob({ kind: "image", http });
            expect(meta.error).toContain("HTTP Error downloading");
            expect(meta.error).toContain("404");
        });
    });

    describe("http jobs", () => {
        it("returns the status, headers and text body of a GET", async () => {
            const { meta, payload } = await runJob({ kind: "http", http: httpParams(`${baseUrl}/text`) });
            expect(meta.status).toBe(200);
            expect(meta.error).toBeUndefined();
            expect(meta.headers.toLowerCase()).toContain("x-probe: yes");
            expect(new TextDecoder().decode(payload)).toBe("héllo");
        });

        it("sends the method, headers and body of a POST", async () => {
            const params = httpParams(`${baseUrl}/echo`, {
                method: "POST",
                headers: [["X-Custom", "abc"]],
                body: "data",
            });
            const { meta, payload } = await runJob({ kind: "http", http: params });
            expect(meta.status).toBe(201);
            expect(new TextDecoder().decode(payload)).toBe("POST:abc:data");
        });

        it("sends a binary body and returns a binary response", async () => {
            const params = httpParams(`${baseUrl}/echo`, {
                method: "POST",
                responseType: "arraybuffer",
                body: new TextEncoder().encode("bytes"),
            });
            const { payload } = await runJob({ kind: "http", http: params });
            expect(new TextDecoder().decode(payload)).toBe("POST:undefined:bytes");
        });

        it("returns an HTTP error status with its body", async () => {
            const { meta, payload } = await runJob({ kind: "http", http: httpParams(`${baseUrl}/nothing`) });
            expect(meta.status).toBe(404);
            expect(meta.error).toBeUndefined();
            expect(new TextDecoder().decode(payload)).toBe("missing");
        });

        it("reports a network error", async () => {
            const closed = http.createServer();
            await new Promise((resolve) => closed.listen(0, "127.0.0.1", resolve));
            const port = closed.address().port;
            await new Promise((resolve) => closed.close(resolve));
            const { meta } = await runJob({ kind: "http", http: httpParams(`http://127.0.0.1:${port}/`) });
            expect(meta.error).toBeTruthy();
            expect(typeof meta.status).toBe("number");
        });

        it("never publishes a cancelled job", async () => {
            const id = nextId++;
            const control = new Int32Array(new SharedArrayBuffer(8));
            const params = { kind: "http", http: httpParams(`${baseUrl}/slow`) };
            thread.postMessage({ bg: "job", id, control: control.buffer, params });
            thread.postMessage({ bg: "cancel", id });
            await new Promise((resolve) => setTimeout(resolve, 300));
            expect(Atomics.load(control, 0)).toBe(Running);
        });
    });
});
