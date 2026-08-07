import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { socketErrorCode, GENERIC_SOCKET_ERROR } from "../brsTypes/interfaces/IfSocket";

/**
 * Bridges `roDataGramSocket` to a real UDP socket on the Node/CLI build.
 *
 * The interpreter's `Wait()`/`RoMessagePort.wait()` is a synchronous busy-spin loop on its own
 * thread with no yielding, so a `dgram` socket created on that same thread could never have its
 * `'message'` callback fire (Node's event loop only runs once the JS call stack unwinds, which
 * doesn't happen until the whole app exits). So the real socket instead lives in a small persistent
 * helper Node process — one per `roDataGramSocket` — which has its own, unblocked event loop.
 *
 * This mirrors `RoURLTransfer`'s "synchronous" HTTP methods (`XMLHttpRequest.ts`): spawn
 * `process.argv[0]` with an inline `-e` script (nothing extra to package), and use plain
 * filesystem polling so the busy-spinning interpreter thread can observe results without needing
 * its own event loop. Bind/setBroadcast/send are rare, one-off calls, so a blocking
 * write-request-then-poll-for-an-ack-file round trip is cheap enough. Inbound datagrams are
 * unsolicited and frequent-ish (polled once per `Wait()` iteration via `RoMessagePort`'s
 * `registerCallback`), so that path is a non-blocking size check against an append-only queue file
 * instead — no busy-wait on the read side.
 */

export interface DatagramReceived {
    data: Buffer;
    fromHost: string;
    fromPort: number;
}

interface BridgeAck {
    ok: boolean;
    boundPort?: number;
    bytesSent?: number;
    error?: string;
}

const DEFAULT_TIMEOUT_MS = 2000;

export class DatagramBridge {
    private child?: ChildProcessWithoutNullStreams;
    // Undefined until `ensureStarted()` succeeds — `os`/`crypto` are empty stub modules on the
    // browser build (webpack `resolve.fallback`), so computing this path must stay inside that
    // method's try/catch, not run unconditionally at construction time (crashed every
    // `CreateObject("roDataGramSocket")` in the browser before the "unsupported" fallback ever ran).
    private queueFile?: string;
    private queueOffset = 0;
    private closed = false;

    constructor(private readonly onError?: (message: string) => void) {}

    /** Binds the socket (BSD `bind()`), matching `ifSocket.SetAddress`. Port 0 means "any". */
    bind(port: number = 0, host?: string): { ok: boolean; boundPort?: number; errorCode: number } {
        const ack = this.request("bind", { port, host });
        return { ok: ack.ok, boundPort: ack.boundPort, errorCode: ack.ok ? 0 : this.mapError(ack.error) };
    }

    /** Enables/disables `SO_BROADCAST`, auto-binding first if the socket isn't bound yet. */
    setBroadcast(enable: boolean): { ok: boolean; errorCode: number } {
        const ack = this.request("broadcast", { enable });
        return { ok: ack.ok, errorCode: ack.ok ? 0 : this.mapError(ack.error) };
    }

    /** Sends a datagram to host:port, auto-binding an ephemeral local port first if needed. */
    send(data: Buffer, host: string, port: number): { bytesSent: number; errorCode: number } {
        const ack = this.request("send", { data: data.toString("base64"), host, port });
        return { bytesSent: ack.ok ? ack.bytesSent ?? 0 : 0, errorCode: ack.ok ? 0 : this.mapError(ack.error) };
    }

    /**
     * Drains any datagrams that arrived since the last poll. Non-blocking: a cheap `statSync`
     * size check against the queue file, only reading the delta when it grew. Safe to call every
     * `Wait()` loop iteration.
     */
    poll(): DatagramReceived[] {
        if (!this.child || !this.queueFile) {
            return [];
        }
        let size: number;
        try {
            size = fs.statSync(this.queueFile).size;
        } catch {
            return [];
        }
        if (size <= this.queueOffset) {
            return [];
        }
        const length = size - this.queueOffset;
        const buffer = Buffer.alloc(length);
        const fd = fs.openSync(this.queueFile, "r");
        try {
            fs.readSync(fd, buffer, 0, length, this.queueOffset);
        } finally {
            fs.closeSync(fd);
        }
        this.queueOffset = size;
        const received: DatagramReceived[] = [];
        for (const line of buffer.toString("utf8").split("\n")) {
            if (!line.trim()) {
                continue;
            }
            try {
                const parsed = JSON.parse(line);
                received.push({
                    data: Buffer.from(parsed.data, "base64"),
                    fromHost: parsed.host,
                    fromPort: parsed.port,
                });
            } catch {
                // Ignore a malformed/partial line rather than losing the rest of the queue.
            }
        }
        return received;
    }

    /** Closes the socket and stops the helper process. Safe to call more than once. */
    close(): void {
        if (this.closed) {
            return;
        }
        this.closed = true;
        if (this.child) {
            try {
                this.child.stdin.write(`${JSON.stringify({ cmd: "close" })}\n`);
            } catch {
                // Process may already be gone; the kill() below is the backstop.
            }
            try {
                this.child.kill();
            } catch {
                // Already exited.
            }
            this.child = undefined;
        }
        if (this.queueFile) {
            try {
                fs.unlinkSync(this.queueFile);
            } catch {
                // Never created, or already removed.
            }
        }
    }

    /** Lazily spawns the helper process on first real use. Returns false if it can't start. */
    private ensureStarted(): boolean {
        if (this.child) {
            return true;
        }
        if (this.closed) {
            return false;
        }
        try {
            const queueFile = path.join(os.tmpdir(), `brs-udp-queue-${crypto.randomUUID()}`);
            // stdout is left unconsumed on purpose: the helper never writes to it, only to stderr
            // (diagnostics) — an unread but never-written-to pipe never fills/blocks.
            this.child = spawn(process.argv[0], ["-e", buildHelperScript(queueFile)]);
            this.queueFile = queueFile;
            this.child.unref();
            this.child.stderr?.on("data", (chunk: Buffer) => {
                this.onError?.(`[roDataGramSocket] helper: ${chunk.toString().trim()}`);
            });
            this.child.on("error", (err: Error) => {
                this.onError?.(`[roDataGramSocket] helper process error: ${err.message}`);
                this.child = undefined;
            });
            return true;
        } catch (err: any) {
            this.onError?.(`[roDataGramSocket] failed to start UDP helper: ${err?.message ?? err}`);
            this.child = undefined;
            this.queueFile = undefined;
            return false;
        }
    }

    /** Writes a command and busy-polls for its ack file, mirroring XMLHttpRequest.ts's sync-XHR trick. */
    private request(cmd: string, extra: Record<string, unknown>, timeoutMs = DEFAULT_TIMEOUT_MS): BridgeAck {
        if (!this.ensureStarted() || !this.child) {
            return { ok: false, error: "ENOTCONN" };
        }
        const ackFile = path.join(os.tmpdir(), `brs-udp-ack-${crypto.randomUUID()}`);
        try {
            this.child.stdin.write(`${JSON.stringify({ cmd, ackFile, ...extra })}\n`);
        } catch (err: any) {
            return { ok: false, error: err?.code ?? "EPIPE" };
        }
        const deadline = performance.now() + timeoutMs;
        while (!fs.existsSync(ackFile)) {
            if (performance.now() > deadline) {
                return { ok: false, error: "ETIMEDOUT" };
            }
        }
        try {
            const ack = JSON.parse(fs.readFileSync(ackFile, "utf8"));
            fs.unlinkSync(ackFile);
            return ack;
        } catch (err: any) {
            return { ok: false, error: err?.code ?? "EIO" };
        }
    }

    /** Reuses `ifSocket`'s host-error-name mapping so status codes stay consistent across sockets. */
    private mapError(error?: string): number {
        if (!error) {
            return GENERIC_SOCKET_ERROR;
        }
        return socketErrorCode({ code: error });
    }
}

/**
 * Builds the inline script run by the helper process: one real `dgram` socket, newline-delimited
 * JSON commands read from its own `stdin`, and datagrams appended as newline-delimited JSON to
 * `queueFile`. Runs in its own Node process with its own unblocked event loop.
 * @param queueFile Path the helper appends received-datagram JSON lines to.
 * @returns Source text passed to `node -e`.
 */
function buildHelperScript(queueFile: string): string {
    return `
        const dgram = require('dgram');
        const fs = require('fs');
        const queueFile = ${JSON.stringify(queueFile)};
        const socket = dgram.createSocket('udp4');
        let bound = false;
        // The parent-side dispose()/close() path only runs on graceful BrightScript GC, which a
        // Task/App worker torn down via Worker.terminate() never reaches — so the queue file must be
        // removed by the process that owns it, on any exit path (explicit close, stdin end, crash).
        process.on('exit', () => { try { fs.unlinkSync(queueFile); } catch (e) {} });
        socket.on('message', (msg, rinfo) => {
            const line = JSON.stringify({ data: msg.toString('base64'), host: rinfo.address, port: rinfo.port }) + '\\n';
            try { fs.appendFileSync(queueFile, line); } catch (e) {}
        });
        socket.on('error', (err) => {
            process.stderr.write('socket error: ' + (err && err.message ? err.message : err) + '\\n');
        });
        function ack(ackFile, payload) {
            // Write to a temp file then rename into place: the parent busy-polls for ackFile to
            // *appear*, and a plain writeFileSync makes the (still-empty/partial) file visible
            // before its content is flushed, racing the parent's read. rename() is atomic.
            try {
                const tmp = ackFile + '.tmp';
                fs.writeFileSync(tmp, JSON.stringify(payload));
                fs.renameSync(tmp, ackFile);
            } catch (e) {}
        }
        function ensureBound(port, host, cb) {
            if (bound) { cb(); return; }
            socket.once('listening', () => { bound = true; cb(); });
            socket.once('error', () => {});
            try { socket.bind(port || 0, host || undefined); } catch (e) { cb(); }
        }
        function handle(msg) {
            if (msg.cmd === 'bind') {
                ensureBound(msg.port, msg.host, () => {
                    const addr = socket.address();
                    ack(msg.ackFile, { ok: true, boundPort: addr.port });
                });
            } else if (msg.cmd === 'broadcast') {
                ensureBound(0, undefined, () => {
                    try {
                        socket.setBroadcast(!!msg.enable);
                        ack(msg.ackFile, { ok: true });
                    } catch (e) {
                        ack(msg.ackFile, { ok: false, error: (e && e.code) || String(e) });
                    }
                });
            } else if (msg.cmd === 'send') {
                const buf = Buffer.from(msg.data, 'base64');
                try {
                    socket.send(buf, msg.port, msg.host, (err) => {
                        if (err) {
                            ack(msg.ackFile, { ok: false, error: (err && err.code) || String(err) });
                        } else {
                            ack(msg.ackFile, { ok: true, bytesSent: buf.length });
                        }
                    });
                } catch (e) {
                    ack(msg.ackFile, { ok: false, error: (e && e.code) || String(e) });
                }
            } else if (msg.cmd === 'close') {
                try { socket.close(); } catch (e) {}
                process.exit(0);
            }
        }
        let carry = '';
        process.stdin.on('data', (chunk) => {
            carry += chunk.toString('utf8');
            let idx;
            while ((idx = carry.indexOf('\\n')) >= 0) {
                const line = carry.slice(0, idx);
                carry = carry.slice(idx + 1);
                if (!line.trim()) continue;
                try { handle(JSON.parse(line)); } catch (e) {}
            }
        });
        // Cleanup safety net: the parent's Node process/worker thread going away closes this pipe,
        // which is the primary cleanup path for a socket an app never explicitly Close()s.
        process.stdin.on('end', () => {
            try { socket.close(); } catch (e) {}
            process.exit(0);
        });
    `;
}
