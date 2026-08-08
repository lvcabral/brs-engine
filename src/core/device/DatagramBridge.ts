import * as fs from "fs";
import { ChildProcessWithoutNullStreams } from "child_process";
import { mapBridgeError, pollQueueFile, requestAck, spawnHelperProcess } from "./HelperProcess";

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
        return { ok: ack.ok, boundPort: ack.boundPort, errorCode: ack.ok ? 0 : mapBridgeError(ack.error) };
    }

    /** Enables/disables `SO_BROADCAST`, auto-binding first if the socket isn't bound yet. */
    setBroadcast(enable: boolean): { ok: boolean; errorCode: number } {
        const ack = this.request("broadcast", { enable });
        return { ok: ack.ok, errorCode: ack.ok ? 0 : mapBridgeError(ack.error) };
    }

    /** Sends a datagram to host:port, auto-binding an ephemeral local port first if needed. */
    send(data: Buffer, host: string, port: number): { bytesSent: number; errorCode: number } {
        const ack = this.request("send", { data: data.toString("base64"), host, port });
        return { bytesSent: ack.ok ? ack.bytesSent ?? 0 : 0, errorCode: ack.ok ? 0 : mapBridgeError(ack.error) };
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
        const { lines, newOffset } = pollQueueFile(this.queueFile, this.queueOffset);
        this.queueOffset = newOffset;
        const received: DatagramReceived[] = [];
        for (const line of lines) {
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
        const spawned = spawnHelperProcess(
            "brs-udp-queue",
            buildHelperScript,
            "roDataGramSocket",
            "UDP",
            this.onError,
            () => {
                this.child = undefined;
            }
        );
        if (!spawned) {
            this.child = undefined;
            this.queueFile = undefined;
            return false;
        }
        this.child = spawned.child;
        this.queueFile = spawned.queueFile;
        return true;
    }

    /** Writes a command and busy-polls for its ack file, mirroring XMLHttpRequest.ts's sync-XHR trick. */
    private request(cmd: string, extra: Record<string, unknown>, timeoutMs = DEFAULT_TIMEOUT_MS): BridgeAck {
        if (!this.ensureStarted() || !this.child) {
            return { ok: false, error: "ENOTCONN" };
        }
        return requestAck(this.child, "brs-udp-ack", { cmd, ...extra }, timeoutMs);
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
    return String.raw`
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
            const line = JSON.stringify({ data: msg.toString('base64'), host: rinfo.address, port: rinfo.port }) + '\n';
            try { fs.appendFileSync(queueFile, line); } catch (e) {}
        });
        socket.on('error', (err) => {
            process.stderr.write('socket error: ' + (err && err.message ? err.message : err) + '\n');
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
        function ensureBound(port, host, cb, onError) {
            if (bound) { cb(); return; }
            let settled = false;
            const onListening = () => {
                if (settled) return;
                settled = true;
                socket.removeListener('error', onErr);
                bound = true;
                cb();
            };
            const onErr = (err) => {
                if (settled) return;
                settled = true;
                socket.removeListener('listening', onListening);
                onError(err);
            };
            socket.once('listening', onListening);
            socket.once('error', onErr);
            try {
                socket.bind(port || 0, host || undefined);
            } catch (e) {
                if (!settled) {
                    settled = true;
                    socket.removeListener('listening', onListening);
                    socket.removeListener('error', onErr);
                    onError(e);
                }
            }
        }
        function handle(msg) {
            if (msg.cmd === 'bind') {
                ensureBound(msg.port, msg.host, () => {
                    const addr = socket.address();
                    ack(msg.ackFile, { ok: true, boundPort: addr.port });
                }, (err) => {
                    ack(msg.ackFile, { ok: false, error: (err && err.code) || String(err) });
                });
            } else if (msg.cmd === 'broadcast') {
                ensureBound(0, undefined, () => {
                    try {
                        socket.setBroadcast(!!msg.enable);
                        ack(msg.ackFile, { ok: true });
                    } catch (e) {
                        ack(msg.ackFile, { ok: false, error: (e && e.code) || String(e) });
                    }
                }, (err) => {
                    ack(msg.ackFile, { ok: false, error: (err && err.code) || String(err) });
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
            while ((idx = carry.indexOf('\n')) >= 0) {
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
