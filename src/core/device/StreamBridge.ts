import * as fs from "fs";
import { ChildProcessWithoutNullStreams } from "child_process";
import { mapBridgeError, pollQueueFile, requestAck, spawnHelperProcess } from "./HelperProcess";

/**
 * Bridges `roStreamSocket` to real TCP on the Node/CLI build, mirroring `DatagramBridge.ts`'s
 * reasoning: the interpreter's `Wait()`/`RoMessagePort.wait()` is a synchronous busy-spin with no
 * yielding, so a `net.Socket`/`net.Server` living on that same thread could never have its own
 * `'connect'`/`'data'`/`'connection'` callbacks fire. The real sockets instead live in a small
 * persistent helper Node process with its own, unblocked event loop, driven the same way UDP's
 * bridge is: newline-JSON commands over `stdin`, atomic ack-file round trips for one-off requests,
 * and non-blocking size-delta polling of append-only queue files for unsolicited events.
 *
 * TCP adds one wrinkle UDP doesn't have: `Accept()` must hand back an independent `roStreamSocket`
 * for a connection that was born *inside* the listener's own helper process. Spawning a second
 * process per accepted connection would need `sendHandle`-style IPC (both ends need an `'ipc'`
 * channel established at `spawn()` time — the accepted socket isn't on either end of one). Instead,
 * one `StreamBridge`/helper process serves either a **listener** (owns a `net.Server`, multiplexes
 * every accepted connection inside itself via a `connId`) or a **client** (owns the one `net.Socket`
 * from `Connect()`). An accepted connection's `roStreamSocket` never spawns its own bridge — it
 * shares the listener's `StreamBridge` instance, tagging every call with its `connId`.
 */

export interface AcceptedConnection {
    connId: number;
    host: string;
    port: number;
}

export interface StreamReceived {
    data: Buffer;
    ended: boolean;
    errorCode?: number;
}

interface BridgeAck {
    ok: boolean;
    boundPort?: number;
    bytesSent?: number;
    error?: string;
}

const DEFAULT_TIMEOUT_MS = 2000;
/** Real handshakes to a slow/unreachable host need more headroom than a local bind/listen. */
const CONNECT_TIMEOUT_MS = 8000;

export class StreamBridge {
    private child?: ChildProcessWithoutNullStreams;
    // Undefined until `ensureStarted()` succeeds — see DatagramBridge.ts for why `os`/`crypto` must
    // stay inside that method's try/catch rather than running unconditionally at construction time.
    /** For a listener: accept-pending notices only. For a client: that connection's own data. */
    private primaryQueueFile?: string;
    private primaryOffset = 0;
    /** Populated from accept notices; only used by a listener-role bridge. */
    private readonly connections = new Map<number, { queueFile: string; offset: number }>();
    private closed = false;
    private listenerClosed = false;
    /**
     * Set once `listen()`/`connect()` succeeds. Lets `close(undefined)` tell "stop accepting new
     * connections, leave the ones already `Accept()`ed running" (listener) apart from "this is the
     * one and only connection, tear the whole process down" (client) from its own state, instead of
     * the caller having to know which and call a different method.
     */
    private role?: "listener" | "client";

    constructor(private readonly onError?: (message: string) => void) {}

    /** Puts the socket into the listen state, matching `ifSocketConnection.Listen`. */
    listen(
        host: string | undefined,
        port: number,
        backlog: number
    ): { ok: boolean; boundPort?: number; errorCode: number } {
        const ack = this.request("listen", { host, port, backlog }, DEFAULT_TIMEOUT_MS);
        if (ack.ok) {
            this.role = "listener";
        }
        return { ok: ack.ok, boundPort: ack.boundPort, errorCode: ack.ok ? 0 : mapBridgeError(ack.error) };
    }

    /** Establishes a connection, matching `ifSocketConnection.Connect`. */
    connect(host: string, port: number, timeoutMs = CONNECT_TIMEOUT_MS): { ok: boolean; errorCode: number } {
        // The parent's own busy-poll deadline is padded past the helper's internal timeout so the
        // helper's real error (ETIMEDOUT/ECONNREFUSED/etc.) wins the race over a generic parent-side one.
        const ack = this.request("connect", { host, port, timeoutMs }, timeoutMs + 1000);
        if (ack.ok) {
            this.role = "client";
        }
        return { ok: ack.ok, errorCode: ack.ok ? 0 : mapBridgeError(ack.error) };
    }

    /** Sends bytes on the primary connection (client/accepted-with-no-connId) or a specific accepted connection. */
    send(data: Buffer, connId?: number): { bytesSent: number; errorCode: number } {
        const ack = this.request("send", { connId, data: data.toString("base64") });
        return { bytesSent: ack.ok ? ack.bytesSent ?? 0 : 0, errorCode: ack.ok ? 0 : mapBridgeError(ack.error) };
    }

    /** Real pass-through to `net.Socket.setNoDelay()` (TCP_NODELAY). */
    setNoDelay(enable: boolean, connId?: number): { ok: boolean; errorCode: number } {
        const ack = this.request("setOption", { connId, option: "noDelay", value: enable });
        return { ok: ack.ok, errorCode: ack.ok ? 0 : mapBridgeError(ack.error) };
    }

    /** Real pass-through to `net.Socket.setKeepAlive()`. */
    setKeepAlive(enable: boolean, connId?: number): { ok: boolean; errorCode: number } {
        const ack = this.request("setOption", { connId, option: "keepAlive", value: enable });
        return { ok: ack.ok, errorCode: ack.ok ? 0 : mapBridgeError(ack.error) };
    }

    /**
     * Drains any connections pending `Accept()`. Non-blocking, safe every `Wait()` iteration.
     * Only meaningful on a listener-role bridge.
     */
    pollListener(): AcceptedConnection[] {
        if (!this.child || !this.primaryQueueFile) {
            return [];
        }
        const { lines, newOffset } = pollQueueFile(this.primaryQueueFile, this.primaryOffset);
        this.primaryOffset = newOffset;
        const accepted: AcceptedConnection[] = [];
        for (const line of lines) {
            try {
                const parsed = JSON.parse(line);
                if (parsed.type === "accept") {
                    this.connections.set(parsed.connId, { queueFile: parsed.queueFile, offset: 0 });
                    accepted.push({ connId: parsed.connId, host: parsed.host, port: parsed.port });
                }
            } catch {
                // Ignore a malformed/partial line rather than losing the rest of the queue.
            }
        }
        return accepted;
    }

    /**
     * Drains any data/EOF/error events for the primary connection (`connId` omitted) or a specific
     * accepted connection. Non-blocking, safe every `Wait()` iteration.
     */
    pollConnection(connId?: number): StreamReceived[] {
        if (!this.child) {
            return [];
        }
        let queueFile: string | undefined;
        let offset: number;
        const entry = connId === undefined ? undefined : this.connections.get(connId);
        if (connId === undefined) {
            queueFile = this.primaryQueueFile;
            offset = this.primaryOffset;
        } else {
            queueFile = entry?.queueFile;
            offset = entry?.offset ?? 0;
        }
        if (!queueFile) {
            return [];
        }
        const { lines, newOffset } = pollQueueFile(queueFile, offset);
        if (connId === undefined) {
            this.primaryOffset = newOffset;
        } else if (entry) {
            entry.offset = newOffset;
        }
        const received: StreamReceived[] = [];
        for (const line of lines) {
            try {
                const parsed = JSON.parse(line);
                if (parsed.type === "data") {
                    received.push({ data: Buffer.from(parsed.data, "base64"), ended: false });
                } else if (parsed.type === "end") {
                    received.push({ data: Buffer.alloc(0), ended: true });
                } else if (parsed.type === "error") {
                    received.push({ data: Buffer.alloc(0), ended: false, errorCode: mapBridgeError(parsed.error) });
                }
            } catch {
                // Ignore a malformed/partial line rather than losing the rest of the queue.
            }
        }
        return received;
    }

    /**
     * Closes one accepted connection (`connId` given — the listener process and its other
     * connections stay alive), or handles the bridge's own primary reference (`connId` omitted):
     * on a listener that stops it accepting new connections without touching ones already
     * `Accept()`ed (the shared process decides for itself when it's finally safe to exit — see
     * `stopListening`); on a client, the primary connection is the only thing this bridge owns, so
     * the whole process tears down. Safe to call more than once.
     */
    close(connId?: number): void {
        if (connId !== undefined) {
            const entry = this.connections.get(connId);
            if (!entry) {
                return; // Already closed (or never tracked) — nothing left to do.
            }
            if (this.child) {
                try {
                    this.child.stdin.write(`${JSON.stringify({ cmd: "close", connId })}\n`);
                } catch {
                    // Helper likely already gone; nothing left to notify.
                }
            }
            try {
                fs.unlinkSync(entry.queueFile);
            } catch {
                // Helper's own exit-path cleanup is the backstop for this file.
            }
            this.connections.delete(connId);
            return;
        }
        if (this.role === "listener") {
            this.stopListening();
            return;
        }
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
        if (this.primaryQueueFile) {
            try {
                fs.unlinkSync(this.primaryQueueFile);
            } catch {
                // Never created, or already removed.
            }
        }
        for (const { queueFile } of this.connections.values()) {
            try {
                fs.unlinkSync(queueFile);
            } catch {
                // Never created, or already removed.
            }
        }
        this.connections.clear();
    }

    /**
     * Stops accepting new connections without touching already-accepted ones or killing the
     * process — closing a listener must not take down connections other `roStreamSocket` instances
     * still hold through this same shared bridge. The helper process itself decides when it's
     * finally safe to exit (once its server is closed and every connection has been individually
     * closed too), so this is fire-and-forget on the parent side.
     */
    private stopListening(): void {
        if (this.listenerClosed) {
            return;
        }
        this.listenerClosed = true;
        if (this.child) {
            try {
                this.child.stdin.write(`${JSON.stringify({ cmd: "closeListener" })}\n`);
            } catch {
                // Helper likely already gone; nothing left to notify.
            }
        }
        // No more accept notices will arrive on this file — safe to drop our own reference to it.
        if (this.primaryQueueFile) {
            try {
                fs.unlinkSync(this.primaryQueueFile);
            } catch {
                // Helper's own exit-path cleanup is the backstop for this file.
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
            "brs-tcp-queue",
            buildHelperScript,
            "roStreamSocket",
            "TCP",
            this.onError,
            () => {
                this.child = undefined;
            }
        );
        if (!spawned) {
            this.child = undefined;
            this.primaryQueueFile = undefined;
            return false;
        }
        this.child = spawned.child;
        this.primaryQueueFile = spawned.queueFile;
        return true;
    }

    /** Writes a command and busy-polls for its ack file, mirroring DatagramBridge's sync-XHR-style trick. */
    private request(cmd: string, extra: Record<string, unknown>, timeoutMs = DEFAULT_TIMEOUT_MS): BridgeAck {
        if (!this.ensureStarted() || !this.child) {
            return { ok: false, error: "ENOTCONN" };
        }
        return requestAck(this.child, "brs-tcp-ack", { cmd, ...extra }, timeoutMs);
    }
}

/**
 * Builds the inline script run by the helper process: a `net.Server` (listen role) or a single
 * `net.Socket` (connect role), newline-delimited JSON commands read from its own `stdin`, and
 * data/accept/EOF/error events appended as newline-delimited JSON to per-connection queue files.
 * Runs in its own Node process with its own unblocked event loop.
 * @param queueFile Primary queue file — accept notices for a listener, or connection data for a client.
 * @returns Source text passed to `node -e`.
 */
function buildHelperScript(queueFile: string): string {
    return String.raw`
        const net = require('net');
        const fs = require('fs');
        const os = require('os');
        const path = require('path');
        const crypto = require('crypto');
        const queueFile = ${JSON.stringify(queueFile)};
        let server;
        let primaryConnection;
        let nextConnId = 1;
        const connections = new Map();
        const connFiles = new Map();
        // The parent-side dispose()/close() path only runs on graceful BrightScript GC, which a
        // Task/App worker torn down via Worker.terminate() never reaches — so every queue file must
        // be removed by the process that owns it, on any exit path (explicit close, stdin end, crash).
        process.on('exit', () => {
            try { fs.unlinkSync(queueFile); } catch (e) {}
            for (const f of connFiles.values()) { try { fs.unlinkSync(f); } catch (e) {} }
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
        function appendEvent(file, payload) {
            try { fs.appendFileSync(file, JSON.stringify(payload) + '\n'); } catch (e) {}
        }
        function wireConnection(socket, file) {
            socket.on('data', (chunk) => {
                appendEvent(file, { type: 'data', data: chunk.toString('base64') });
            });
            socket.on('end', () => {
                appendEvent(file, { type: 'end' });
            });
            socket.on('error', (err) => {
                appendEvent(file, { type: 'error', error: (err && err.code) || String(err) });
            });
        }
        function socketFor(connId) {
            return connId !== undefined ? connections.get(connId) : primaryConnection;
        }
        // Both handleListen/handleConnect race a 'listening'/'connect' event against an 'error'
        // event (plus, for connect, a timeout) — only the first should act. onceGuard() returns a
        // function that answers true exactly once, so each branch can gate both its ack AND any
        // side effect (clearing the timer, destroying the socket) behind the same check.
        function onceGuard() {
            let done = false;
            return () => {
                if (done) return false;
                done = true;
                return true;
            };
        }
        function handleListen(msg) {
            if (server || primaryConnection) {
                ack(msg.ackFile, { ok: false, error: 'EALREADY' });
                return;
            }
            server = net.createServer((socket) => {
                const connId = nextConnId++;
                const connFile = path.join(os.tmpdir(), 'brs-tcp-conn-' + crypto.randomUUID());
                connections.set(connId, socket);
                connFiles.set(connId, connFile);
                wireConnection(socket, connFile);
                appendEvent(queueFile, {
                    type: 'accept',
                    connId,
                    queueFile: connFile,
                    host: socket.remoteAddress,
                    port: socket.remotePort,
                });
            });
            const settleOnce = onceGuard();
            server.once('listening', () => {
                if (!settleOnce()) return;
                const addr = server.address();
                ack(msg.ackFile, { ok: true, boundPort: addr && addr.port });
            });
            server.once('error', (err) => {
                if (!settleOnce()) return;
                ack(msg.ackFile, { ok: false, error: (err && err.code) || String(err) });
            });
            try {
                server.listen(msg.port || 0, msg.host || undefined, msg.backlog || 511);
            } catch (e) {
                if (settleOnce()) {
                    ack(msg.ackFile, { ok: false, error: (e && e.code) || String(e) });
                }
            }
        }
        function handleConnect(msg) {
            if (server || primaryConnection) {
                ack(msg.ackFile, { ok: false, error: 'EALREADY' });
                return;
            }
            const socket = new net.Socket();
            const settleOnce = onceGuard();
            const timer = setTimeout(() => {
                if (!settleOnce()) return;
                socket.destroy();
                ack(msg.ackFile, { ok: false, error: 'ETIMEDOUT' });
            }, msg.timeoutMs || 8000);
            socket.once('connect', () => {
                if (!settleOnce()) return;
                clearTimeout(timer);
                primaryConnection = socket;
                wireConnection(socket, queueFile);
                ack(msg.ackFile, { ok: true });
            });
            socket.once('error', (err) => {
                if (!settleOnce()) return;
                clearTimeout(timer);
                ack(msg.ackFile, { ok: false, error: (err && err.code) || String(err) });
            });
            try {
                socket.connect(msg.port, msg.host);
            } catch (e) {
                if (settleOnce()) {
                    clearTimeout(timer);
                    ack(msg.ackFile, { ok: false, error: (e && e.code) || String(e) });
                }
            }
        }
        function handleSend(msg) {
            const socket = socketFor(msg.connId);
            if (!socket || socket.destroyed || !socket.writable) {
                ack(msg.ackFile, { ok: false, error: 'ENOTCONN' });
                return;
            }
            const buf = Buffer.from(msg.data, 'base64');
            try {
                socket.write(buf, (err) => {
                    if (err) {
                        ack(msg.ackFile, { ok: false, error: (err && err.code) || String(err) });
                    } else {
                        ack(msg.ackFile, { ok: true, bytesSent: buf.length });
                    }
                });
            } catch (e) {
                ack(msg.ackFile, { ok: false, error: (e && e.code) || String(e) });
            }
        }
        function handleSetOption(msg) {
            const socket = socketFor(msg.connId);
            if (!socket) {
                ack(msg.ackFile, { ok: false, error: 'ENOTCONN' });
                return;
            }
            try {
                if (msg.option === 'noDelay') {
                    socket.setNoDelay(!!msg.value);
                } else if (msg.option === 'keepAlive') {
                    socket.setKeepAlive(!!msg.value);
                }
                ack(msg.ackFile, { ok: true });
            } catch (e) {
                ack(msg.ackFile, { ok: false, error: (e && e.code) || String(e) });
            }
        }
        // The process must stay alive as long as ANYTHING still references this bridge (the
        // listener and every accepted connection can each close independently) — stdin's own
        // 'data' listener keeps the event loop alive forever otherwise, so exit is explicit,
        // only once nothing is left.
        function maybeExit() {
            if (!server && !primaryConnection && connections.size === 0) {
                // One tick of headroom lets a just-issued socket.end()'s FIN actually flush before
                // the process (and its sockets) go away, instead of exiting synchronously mid-call.
                setImmediate(() => process.exit(0));
            }
        }
        function handleCloseListener() {
            try { server && server.close(); } catch (e) {}
            server = null;
            maybeExit();
        }
        function handleClose(msg) {
            if (msg.connId !== undefined) {
                const socket = connections.get(msg.connId);
                try { socket && socket.end(); } catch (e) {}
                connections.delete(msg.connId);
                const f = connFiles.get(msg.connId);
                connFiles.delete(msg.connId);
                if (f) { try { fs.unlinkSync(f); } catch (e) {} }
                maybeExit();
                return;
            }
            try { server && server.close(); } catch (e) {}
            server = null;
            try { for (const s of connections.values()) s.end(); } catch (e) {}
            connections.clear();
            try { primaryConnection && primaryConnection.end(); } catch (e) {}
            primaryConnection = null;
            setImmediate(() => process.exit(0));
        }
        function handle(msg) {
            if (msg.cmd === 'listen') handleListen(msg);
            else if (msg.cmd === 'connect') handleConnect(msg);
            else if (msg.cmd === 'send') handleSend(msg);
            else if (msg.cmd === 'setOption') handleSetOption(msg);
            else if (msg.cmd === 'closeListener') handleCloseListener();
            else if (msg.cmd === 'close') handleClose(msg);
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
            try { server && server.close(); } catch (e) {}
            try { for (const s of connections.values()) s.destroy(); } catch (e) {}
            try { primaryConnection && primaryConnection.destroy(); } catch (e) {}
            process.exit(0);
        });
    `;
}
