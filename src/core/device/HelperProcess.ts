import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { socketErrorCode, GENERIC_SOCKET_ERROR } from "../brsTypes/interfaces/IfSocket";

/**
 * Shared plumbing behind `DatagramBridge`/`StreamBridge`: both spawn a small persistent `node -e`
 * helper process with its own unblocked event loop (the interpreter's `Wait()` loop is a
 * synchronous busy-spin that can never let a socket's own async callbacks fire — see either
 * bridge's file header for the full rationale), talk to it over newline-JSON `stdin` commands with
 * ack-file busy-poll round trips, and drain unsolicited events via non-blocking size-delta reads of
 * an append-only queue file. This module holds the parts that are identical either way; each bridge
 * still owns its own helper script (the actual `dgram`/`net` socket logic differs completely).
 */

export interface HelperSpawnResult {
    child: ChildProcessWithoutNullStreams;
    queueFile: string;
}

/**
 * Computes a fresh temp queue-file path and spawns a `node -e <script>` helper process bound to
 * it. The whole thing — including `os.tmpdir()`/`crypto.randomUUID()` — must stay inside one
 * try/catch: the browser build's webpack `resolve.fallback` stubs `os`/`crypto`/`child_process` to
 * empty modules, so calling into them throws mid-call rather than the module being simply absent,
 * and this is the only call site that ever touches them. Returns `undefined` if anything in that
 * chain fails (e.g. running on the browser build).
 * @param queueFilePrefix Distinguishes UDP/TCP temp files (e.g. `"brs-udp-queue"`).
 * @param buildScript Builds the helper's source, given the queue file path it must write events to.
 * @param componentName BrightScript component name used in warning-message tags (e.g. `"roStreamSocket"`).
 * @param protocol Human-readable protocol name for the spawn-failure message (e.g. `"TCP"`).
 * @param onError Receives every warning-worthy line (helper stderr, spawn/process failures).
 * @param onProcessError Called if the child process itself errors after spawning (e.g. crashes).
 */
export function spawnHelperProcess(
    queueFilePrefix: string,
    buildScript: (queueFile: string) => string,
    componentName: string,
    protocol: string,
    onError: ((message: string) => void) | undefined,
    onProcessError: () => void
): HelperSpawnResult | undefined {
    try {
        const queueFile = path.join(os.tmpdir(), `${queueFilePrefix}-${crypto.randomUUID()}`);
        // stdout is left unconsumed on purpose: the helper never writes to it, only to stderr
        // (diagnostics) — an unread but never-written-to pipe never fills/blocks.
        const child = spawn(process.argv[0], ["-e", buildScript(queueFile)]);
        child.unref();
        // A write to an already-exited helper's stdin can EPIPE *asynchronously* (an 'error'
        // event on the stream) even though the synchronous write() call itself didn't throw — the
        // try/catch every call site wraps its write() in only catches the synchronous case. Every
        // site already treats "the helper is gone" as an expected, handled outcome, so this just
        // has to stop that from surfacing as an uncaught exception.
        child.stdin.on("error", () => {});
        child.stderr?.on("data", (chunk: Buffer) => {
            onError?.(`[${componentName}] helper: ${chunk.toString().trim()}`);
        });
        child.on("error", (err: Error) => {
            onError?.(`[${componentName}] helper process error: ${err.message}`);
            onProcessError();
        });
        return { child, queueFile };
    } catch (err: any) {
        onError?.(`[${componentName}] failed to start ${protocol} helper: ${err?.message ?? err}`);
        return undefined;
    }
}

/** Writes a command and busy-polls for its ack file, mirroring `XMLHttpRequest.ts`'s sync-XHR trick. */
export function requestAck(
    child: ChildProcessWithoutNullStreams,
    ackFilePrefix: string,
    command: Record<string, unknown>,
    timeoutMs: number
): any {
    const ackFile = path.join(os.tmpdir(), `${ackFilePrefix}-${crypto.randomUUID()}`);
    try {
        child.stdin.write(`${JSON.stringify({ ...command, ackFile })}\n`);
    } catch (err: any) {
        return { ok: false, error: err?.code ?? "EPIPE" };
    }
    const deadline = performance.now() + timeoutMs;
    while (!fs.existsSync(ackFile)) {
        if (child.exitCode !== null || child.signalCode !== null) {
            // The helper died mid-request — it can never write this ack, so fail now instead of
            // spinning out the rest of the timeout on a file that will never appear.
            return { ok: false, error: "ENOTCONN" };
        }
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

/** Non-blocking size-delta read of an append-only queue file, returning only newly-appended lines. */
export function pollQueueFile(file: string, offset: number): { lines: string[]; newOffset: number } {
    let size: number;
    try {
        size = fs.statSync(file).size;
    } catch {
        return { lines: [], newOffset: offset };
    }
    if (size <= offset) {
        return { lines: [], newOffset: offset };
    }
    const length = size - offset;
    const buffer = Buffer.alloc(length);
    const fd = fs.openSync(file, "r");
    try {
        fs.readSync(fd, buffer, 0, length, offset);
    } finally {
        fs.closeSync(fd);
    }
    const lines = buffer
        .toString("utf8")
        .split("\n")
        .filter((line) => line.trim().length > 0);
    return { lines, newOffset: size };
}

/** Reuses `ifSocket`'s host-error-name mapping so status codes stay consistent across both bridges. */
export function mapBridgeError(error?: string): number {
    if (!error) {
        return GENERIC_SOCKET_ERROR;
    }
    return socketErrorCode({ code: error });
}
