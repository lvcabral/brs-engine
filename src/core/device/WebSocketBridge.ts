import * as fs from "fs";
import { ChildProcessWithoutNullStreams } from "child_process";
import { spawnHelperProcess, pollQueueFile } from "./HelperProcess";
import { WebSocketEventPayload, WebSocketOpenParams, WebSocketTransport } from "./WebSocketTransport";

declare const __non_webpack_require__: NodeJS.Require | undefined;

/**
 * Bridges `roWebSocket` to a real WebSocket client on the Node/CLI build, mirroring
 * `StreamBridge.ts`/`DatagramBridge.ts`'s reasoning: the interpreter's `Wait()` loop is a
 * synchronous busy-spin with no yielding, so a WebSocket client created on that same thread could
 * never have its own `'message'`/`'close'`/`'ping'` callbacks fire. The real client instead lives
 * in a small persistent helper Node process with its own, unblocked event loop — same
 * newline-JSON-command / append-only-queue-file transport as the other two bridges.
 *
 * Unlike Stream/DatagramBridge, every command here is fire-and-forget: `roWebSocket`'s own
 * methods are documented as asynchronous (results surface later as `roWebSocketEvent`s), and the
 * one genuinely synchronous case — `Open(wait_time > 0)`/`PingTest()` blocking for a result — is
 * implemented in `RoWebSocket.ts` by busy-polling this bridge's queue, not by a request/ack round
 * trip here. That also means, unlike the other two bridges, there is no ack file to wait on.
 *
 * Uses the `ws` package (already a dependency, used elsewhere for the ECP WebSocket server) inside
 * the helper process for full protocol fidelity — real Ping/Pong control frames, custom headers,
 * and Basic-Auth credentials, none of which a browser's native `WebSocket` exposes to script.
 */

const OPCODE_TEXT = 1;
const OPCODE_BINARY = 2;
const OPCODE_PING = 9;
const OPCODE_PONG = 10;

export class WebSocketBridge implements WebSocketTransport {
    private child?: ChildProcessWithoutNullStreams;
    private queueFile?: string;
    private queueOffset = 0;
    private closed = false;
    private msgSeq = 0;

    constructor(private readonly onError?: (message: string) => void) {}

    open(params: WebSocketOpenParams): boolean {
        if (!this.ensureStarted()) {
            return false;
        }
        this.write({ cmd: "open", ...params });
        return true;
    }

    poll(): WebSocketEventPayload[] {
        if (!this.queueFile) {
            return [];
        }
        const { lines, newOffset } = pollQueueFile(this.queueFile, this.queueOffset);
        this.queueOffset = newOffset;
        const events: WebSocketEventPayload[] = [];
        for (const line of lines) {
            try {
                events.push(JSON.parse(line));
            } catch {
                // Ignore a malformed/partial line rather than losing the rest of the queue.
            }
        }
        return events;
    }

    send(text: string): number {
        return this.sendCommand("send", OPCODE_TEXT, { text });
    }

    sendData(bytes: Uint8Array): number {
        return this.sendCommand("sendData", OPCODE_BINARY, { data: Buffer.from(bytes).toString("base64") });
    }

    sendPing(text?: string, bytes?: Uint8Array): number {
        return this.sendCommand("sendPing", OPCODE_PING, {
            text,
            data: bytes ? Buffer.from(bytes).toString("base64") : undefined,
        });
    }

    sendPong(text?: string, bytes?: Uint8Array): number {
        return this.sendCommand("sendPong", OPCODE_PONG, {
            text,
            data: bytes ? Buffer.from(bytes).toString("base64") : undefined,
        });
    }

    /** Assigns the message id every send-like command echoes back via a `msgSent` event, and writes
     *  the command with it merged in. */
    private sendCommand(cmd: string, opcode: number, extra: Record<string, unknown>): number {
        const msgId = this.nextMsgId();
        this.write({ cmd, opcode, msgId, ...extra });
        return msgId;
    }

    setAutoPingReply(enable: boolean): void {
        this.write({ cmd: "setAutoPingReply", enable });
    }

    close(code: number, reason: string): void {
        this.write({ cmd: "close", code, reason });
    }

    dispose(): void {
        if (this.closed) {
            return;
        }
        this.closed = true;
        if (this.child) {
            try {
                this.child.stdin.write(`${JSON.stringify({ cmd: "dispose" })}\n`);
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

    private nextMsgId(): number {
        this.msgSeq += 1;
        return this.msgSeq;
    }

    /** Lazily spawns the helper process on first real use. */
    private ensureStarted(): boolean {
        if (this.child) {
            return true;
        }
        if (this.closed) {
            return false;
        }
        const spawned = spawnHelperProcess(
            "brs-ws-queue",
            buildHelperScript,
            "roWebSocket",
            "WebSocket",
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

    private write(command: Record<string, unknown>): void {
        if (!this.ensureStarted() || !this.child) {
            return;
        }
        try {
            this.child.stdin.write(`${JSON.stringify(command)}\n`);
        } catch {
            // The helper is gone; nothing to do — `poll()` simply keeps returning no events.
        }
    }
}

/**
 * Builds the inline script run by the helper process: one real `ws` client, newline-delimited
 * JSON commands read from its own `stdin`, and events appended as newline-delimited JSON to
 * `queueFile`. Runs in its own Node process with its own unblocked event loop.
 * @param queueFile Path the helper appends event JSON lines to.
 * @returns Source text passed to `node -e`.
 */
function buildHelperScript(queueFile: string): string {
    // Resolved from *this* process so the helper loads the exact same `ws` install regardless of
    // the spawned process's own cwd (an inline `-e` script has no module path of its own to
    // resolve `require('ws')` relative to). Must use the *real* Node `require`, not webpack's
    // statically-analyzed one — bundled, `require.resolve("ws")` returns a webpack-internal
    // module id (harmless-looking, but not a real filesystem path), not `ws`'s real disk location,
    // which breaks the standalone `node -e` process's own `require()` of that path. Same escape
    // hatch `src/core/index.ts` already uses for the same reason.
    const nodeRequire = typeof __non_webpack_require__ === "function" ? __non_webpack_require__ : eval("require");
    const wsModulePath = nodeRequire.resolve("ws");
    return String.raw`
        const WebSocket = require(${JSON.stringify(wsModulePath)});
        const fs = require('fs');
        const queueFile = ${JSON.stringify(queueFile)};
        let ws;
        let autoPingReply = true;
        process.on('exit', () => { try { fs.unlinkSync(queueFile); } catch (e) {} });
        function queueEvent(payload) {
            try { fs.appendFileSync(queueFile, JSON.stringify(payload) + '\n'); } catch (e) {}
        }
        function handle(msg) {
            if (msg.cmd === 'open') {
                const options = {
                    rejectUnauthorized: msg.peerVerification !== false,
                    autoPong: false,
                };
                if (msg.hostVerification === false) {
                    options.checkServerIdentity = () => undefined;
                }
                if (msg.headers && Object.keys(msg.headers).length > 0) {
                    options.headers = msg.headers;
                }
                if (msg.user !== undefined || msg.password !== undefined) {
                    options.auth = (msg.user || '') + ':' + (msg.password || '');
                }
                const protocols = typeof msg.protocols === 'string' && msg.protocols.length > 0
                    ? msg.protocols.split(',').map((p) => p.trim()).filter((p) => p.length > 0)
                    : undefined;
                // A local const, not the shared outer 'ws': the same helper process is reused for
                // a reconnect (Open() called again on the same roWebSocket), and event handlers
                // closing over the mutable outer variable would act on whichever connection is
                // *current* by the time a late event from *this* one fires, not the one it was
                // actually registered on (e.g. a Pong auto-reply landing on the new socket instead
                // of the one that received the Ping). Same reasoning for 'socketHadError' below.
                let socket;
                let socketHadError = false;
                try {
                    socket = new WebSocket(msg.url, protocols, options);
                } catch (e) {
                    queueEvent({ type: 'error', error: 1, errorMsg: String(e && e.message ? e.message : e) });
                    return;
                }
                ws = socket;
                socket.on('open', () => {
                    queueEvent({ type: 'opened', protocol: socket.protocol || '', effectiveUrl: socket.url || msg.url });
                });
                socket.on('message', (data, isBinary) => {
                    if (isBinary) {
                        queueEvent({ type: 'data', dataBase64: Buffer.from(data).toString('base64') });
                    } else {
                        queueEvent({ type: 'text', text: data.toString('utf8') });
                    }
                });
                socket.on('ping', (data) => {
                    queueEvent({ type: 'ping', dataBase64: Buffer.from(data).toString('base64') });
                    if (autoPingReply) {
                        try { socket.pong(data); } catch (e) {}
                    }
                });
                socket.on('pong', (data) => {
                    queueEvent({ type: 'pong', dataBase64: Buffer.from(data).toString('base64') });
                });
                socket.on('error', (err) => {
                    socketHadError = true;
                    queueEvent({ type: 'error', error: 1, errorMsg: (err && err.message) || String(err) });
                });
                socket.on('close', (code, reasonBuf) => {
                    queueEvent({
                        type: 'closed',
                        code: code || 1000,
                        reason: reasonBuf ? reasonBuf.toString('utf8') : '',
                        error: socketHadError ? 1 : 0,
                        errorMsg: '',
                    });
                });
            } else if (!ws) {
                return; // Every other command needs an open() first.
            } else if (msg.cmd === 'send') {
                ws.send(msg.text, (err) => {
                    if (!err) {
                        queueEvent({ type: 'msgSent', opcode: msg.opcode, msgId: msg.msgId, size: Buffer.byteLength(msg.text, 'utf8') });
                    }
                });
            } else if (msg.cmd === 'sendData') {
                const buf = Buffer.from(msg.data, 'base64');
                ws.send(buf, { binary: true }, (err) => {
                    if (!err) {
                        queueEvent({ type: 'msgSent', opcode: msg.opcode, msgId: msg.msgId, size: buf.length });
                    }
                });
            } else if (msg.cmd === 'sendPing' || msg.cmd === 'sendPong') {
                const payload = msg.data ? Buffer.from(msg.data, 'base64') : (msg.text ? Buffer.from(msg.text, 'utf8') : undefined);
                const sendControl = msg.cmd === 'sendPing' ? ws.ping.bind(ws) : ws.pong.bind(ws);
                sendControl(payload, undefined, (err) => {
                    if (!err) {
                        queueEvent({ type: 'msgSent', opcode: msg.opcode, msgId: msg.msgId, size: payload ? payload.length : 0 });
                    }
                });
            } else if (msg.cmd === 'setAutoPingReply') {
                autoPingReply = !!msg.enable;
            } else if (msg.cmd === 'close') {
                try { ws.close(msg.code || 1000, msg.reason || ''); } catch (e) {}
            } else if (msg.cmd === 'dispose') {
                try { ws.terminate(); } catch (e) {}
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
        process.stdin.on('end', () => {
            try { if (ws) ws.terminate(); } catch (e) {}
            process.exit(0);
        });
    `;
}
