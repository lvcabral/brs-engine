import * as fs from "node:fs";
import { ChildProcessWithoutNullStreams } from "node:child_process";
import { spawnHelperProcess, pollQueueFile } from "./HelperProcess";
import {
    SSE_CONNECT_ERROR,
    SSE_RECV_ERROR,
    SseEventPayload,
    SseRequestParams,
    SseTransport,
    curlErrorCode,
} from "./SseTransport";

/**
 * Streams `roUrlTransfer.AsyncGetSSEvents()` responses on the Node/CLI build. The interpreter's
 * `Wait()` loop is a synchronous busy-spin, so the HTTP request runs in a small persistent helper
 * Node process with its own event loop (same pattern as `WebSocketNodeBridge.ts`), which appends
 * response payloads to a queue file this bridge drains without blocking.
 *
 * Every request is tagged with a request id so payloads of an aborted request still in the queue
 * are never mistaken for the current one's.
 */
export class SseNodeBridge implements SseTransport {
    private child?: ChildProcessWithoutNullStreams;
    private queueFile?: string;
    private queueOffset = 0;
    private closed = false;
    private requestSeq = 0;
    private currentRequest = 0;
    private gotResponse = false;

    constructor(private readonly onError?: (message: string) => void) {}

    start(params: SseRequestParams): boolean {
        if (!this.ensureStarted()) {
            return false;
        }
        this.requestSeq += 1;
        this.currentRequest = this.requestSeq;
        this.gotResponse = false;
        return this.write({ cmd: "start", rid: this.currentRequest, ...params });
    }

    poll(): SseEventPayload[] {
        if (!this.queueFile || this.currentRequest === 0) {
            return [];
        }
        const { lines, newOffset } = pollQueueFile(this.queueFile, this.queueOffset);
        this.queueOffset = newOffset;
        const payloads = this.parseLines(lines);
        if (this.currentRequest !== 0 && this.helperExited()) {
            this.currentRequest = 0;
            this.child = undefined;
            payloads.push({
                type: "error",
                code: this.gotResponse ? SSE_RECV_ERROR : SSE_CONNECT_ERROR,
                message: "HTTP helper process exited unexpectedly",
            });
        }
        return payloads;
    }

    private helperExited(): boolean {
        return !this.child || this.child.exitCode !== null || this.child.signalCode !== null;
    }

    private parseLines(lines: string[]): SseEventPayload[] {
        const payloads: SseEventPayload[] = [];
        for (const line of lines) {
            let raw: any;
            try {
                raw = JSON.parse(line);
            } catch {
                continue;
            }
            if (raw.rid !== this.currentRequest) {
                continue;
            }
            if (raw.type === "error") {
                const fallback = raw.midStream ? SSE_RECV_ERROR : undefined;
                payloads.push({ type: "error", code: curlErrorCode(raw.errName, fallback), message: raw.message });
            } else {
                delete raw.rid;
                payloads.push(raw);
                this.gotResponse ||= raw.type === "response";
            }
            if (raw.type === "error" || raw.type === "end") {
                this.currentRequest = 0;
            }
        }
        return payloads;
    }

    abort(): void {
        if (this.currentRequest !== 0) {
            this.currentRequest = 0;
            this.write({ cmd: "abort" });
        }
    }

    dispose(): void {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this.currentRequest = 0;
        if (this.child) {
            this.write({ cmd: "dispose" });
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

    /** Lazily spawns the helper process on first use. */
    private ensureStarted(): boolean {
        if (this.child) {
            return true;
        }
        if (this.closed) {
            return false;
        }
        const spawned = spawnHelperProcess(
            "brs-sse-queue",
            buildHelperScript,
            "roUrlTransfer",
            "HTTP",
            this.onError,
            () => {
                this.child = undefined;
            }
        );
        if (!spawned) {
            return false;
        }
        this.child = spawned.child;
        this.queueFile = spawned.queueFile;
        this.queueOffset = 0;
        return true;
    }

    private write(command: Record<string, unknown>): boolean {
        if (!this.child) {
            return false;
        }
        try {
            this.child.stdin.write(`${JSON.stringify(command)}\n`);
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Builds the inline script run by the helper process: one streaming HTTP(S) request at a time,
 * following up to 10 redirects, with newline-delimited JSON commands read from `stdin` and
 * payloads appended as newline-delimited JSON to `queueFile`.
 * @param queueFile Path the helper appends payload JSON lines to.
 * @returns Source text passed to `node -e`.
 */
function buildHelperScript(queueFile: string): string {
    return String.raw`
        const http = require('http');
        const https = require('https');
        const fs = require('fs');
        const queueFile = ${JSON.stringify(queueFile)};
        let current;
        process.on('exit', () => { try { fs.unlinkSync(queueFile); } catch (e) {} });
        function abortCurrent() {
            const state = current;
            current = undefined;
            if (state && state.req) {
                try { state.req.destroy(); } catch (e) {}
            }
        }
        function rawHeaders(res) {
            const lines = [];
            for (let i = 0; i + 1 < res.rawHeaders.length; i += 2) {
                lines.push(res.rawHeaders[i] + ': ' + res.rawHeaders[i + 1]);
            }
            return lines.join('\r\n');
        }
        function start(msg) {
            abortCurrent();
            const state = { rid: msg.rid, req: undefined, gotResponse: false };
            current = state;
            const emit = (payload) => {
                if (current !== state) return;
                try { fs.appendFileSync(queueFile, JSON.stringify(Object.assign({ rid: state.rid }, payload)) + '\n'); } catch (e) {}
                if (payload.type === 'end' || payload.type === 'error') current = undefined;
            };
            const fail = (errName, message) => {
                emit({ type: 'error', errName: errName || '', message: message || 'Unknown error', midStream: state.gotResponse });
            };
            function send(urlText, method, requestHeaders, redirectsLeft) {
                let u;
                try { u = new URL(urlText); } catch (e) { fail('URL_MALFORMAT', e.message); return; }
                if (u.protocol !== 'http:' && u.protocol !== 'https:') { fail('UNSUPPORTED_PROTOCOL', 'Protocol not supported.'); return; }
                const ssl = u.protocol === 'https:';
                const headers = Object.assign({}, requestHeaders, { Host: u.host });
                const options = { hostname: u.hostname, port: u.port || (ssl ? 443 : 80), path: u.pathname + u.search, method, headers };
                const req = (ssl ? https : http).request(options, (res) => {
                    if (current !== state) { res.destroy(); return; }
                    const sc = res.statusCode;
                    const loc = res.headers.location;
                    if ((sc === 301 || sc === 302 || sc === 303 || sc === 307 || sc === 308) && loc) {
                        res.resume();
                        if (redirectsLeft <= 0) { fail('TOO_MANY_REDIRECTS', 'Too many redirects'); return; }
                        const next = new URL(loc, urlText);
                        let nextHeaders = requestHeaders;
                        if (next.origin !== u.origin) {
                            // Like browsers and curl, never forward credentials to another origin.
                            nextHeaders = {};
                            for (const key of Object.keys(requestHeaders)) {
                                const name = key.toLowerCase();
                                if (name !== 'authorization' && name !== 'cookie' && name !== 'proxy-authorization') {
                                    nextHeaders[key] = requestHeaders[key];
                                }
                            }
                        }
                        send(next.href, sc === 303 ? 'GET' : method, nextHeaders, redirectsLeft - 1);
                        return;
                    }
                    state.gotResponse = true;
                    emit({ type: 'response', status: sc, statusText: res.statusMessage || '', headers: rawHeaders(res), contentType: res.headers['content-type'] || '' });
                    res.setEncoding('utf8');
                    res.on('data', (text) => emit({ type: 'chunk', text }));
                    res.on('end', () => emit({ type: 'end' }));
                    res.on('error', (e) => fail(e.code, e.message));
                    res.on('close', () => { if (!res.complete) fail('ECONNRESET', 'Connection closed before the stream ended'); });
                });
                state.req = req;
                req.on('error', (e) => fail(e.code, e.message));
                req.end();
            }
            send(msg.url, msg.method || 'GET', msg.headers || {}, 10);
        }
        function handle(msg) {
            if (msg.cmd === 'start') {
                start(msg);
            } else if (msg.cmd === 'abort') {
                abortCurrent();
            } else if (msg.cmd === 'dispose') {
                abortCurrent();
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
            abortCurrent();
            process.exit(0);
        });
    `;
}
