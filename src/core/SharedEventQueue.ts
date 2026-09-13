/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * SharedEventQueue is a single-producer/single-consumer, ordered, lossless event log backed by a
 * resizable `SharedArrayBuffer`. It exists for the same reason the SceneGraph Task rendezvous
 * machinery uses shared memory: a BrightScript component's `Wait()` loop (`RoMessagePort.wait`) is
 * a synchronous busy-spin with no yielding, so a callback from a *different* real thread (the
 * browser's main thread, which owns the actual `WebSocket`) can never run on the interpreter
 * thread while it's inside that loop — `postMessage`/`onmessage` needs the event loop to turn,
 * which a busy-spin never allows. `Atomics` reads/writes need no event loop at all, so the
 * interpreter thread can observe cross-thread writes by polling plain shared memory instead.
 *
 * Unlike `SharedObject` (a single-slot "latest value wins" store, right for Task field rendezvous
 * where only the current value matters), a WebSocket producing several messages between two polls
 * must not drop any of them — so this is an append-only log: the producer appends one frame per
 * event, the consumer drains everything written since its last poll, in order. A tiny
 * `Atomics.compareExchange` spinlock guards the (rare, sub-microsecond) critical section on each
 * side so a drain can never race a concurrent append.
 */

const LOCK_FREE = 0;
const LOCK_HELD = 1;

// One shared instance each: both are stateless for one-shot encode()/decode() calls, so reusing
// them avoids allocating a fresh codec object for every single event pushed or drained.
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

class SharedEventQueue {
    private static readonly writeOffsetIdx = 0;
    private static readonly lockIdx = 1;
    private static readonly headerInts = 2;
    private static readonly headerBytes = SharedEventQueue.headerInts * 4;
    /** Well beyond any real critical section's duration (a memory copy), so this only ever fires
     *  when the other side is genuinely gone, never as a false positive under normal load. */
    private static readonly lockTimeoutMs = 2000;

    private buffer: SharedArrayBuffer;
    private view: Uint8Array;
    private atomicView: Int32Array;
    private dataView: DataView;
    private maxSize: number;
    onError?: (message: string) => void;

    /**
     * @param initialSize Initial buffer size in bytes (defaults to 8KB).
     * @param maxSize Hard cap for automatic growth (defaults to 4MB).
     */
    constructor(initialSize: number = 8 * 1024, maxSize: number = 4 * 1024 * 1024) {
        this.maxSize = Math.max(maxSize, initialSize);
        this.buffer = new SharedArrayBuffer(initialSize, { maxByteLength: this.maxSize });
        [this.view, this.atomicView, this.dataView] = SharedEventQueue.viewsFor(this.buffer);
    }

    /** Returns the backing `SharedArrayBuffer` to hand to the other thread via `postMessage`. */
    getBuffer(): SharedArrayBuffer {
        return this.buffer;
    }

    /** Attaches to a `SharedArrayBuffer` received from the producing thread. */
    static fromBuffer(buffer: SharedArrayBuffer): SharedEventQueue {
        // The throwaway buffer must be at least header-sized, or building its own initial views
        // (inside the constructor, before `queue.buffer` below replaces it) fails outright.
        const queue = new SharedEventQueue(SharedEventQueue.headerBytes);
        queue.buffer = buffer;
        queue.maxSize = buffer.maxByteLength || buffer.byteLength;
        [queue.view, queue.atomicView, queue.dataView] = SharedEventQueue.viewsFor(buffer);
        return queue;
    }

    /** Rebuilds the three typed-array views over a (possibly just-grown) buffer. */
    private static viewsFor(buffer: SharedArrayBuffer): [Uint8Array, Int32Array, DataView] {
        return [new Uint8Array(buffer), new Int32Array(buffer, 0, SharedEventQueue.headerInts), new DataView(buffer)];
    }

    /** Appends one JSON-serializable frame. Safe to call from the thread that owns the real I/O. */
    push(obj: any): void {
        let bytes: Uint8Array;
        try {
            bytes = textEncoder.encode(JSON.stringify(obj));
        } catch {
            return;
        }
        this.withLock(() => {
            const writeOffset = Atomics.load(this.atomicView, SharedEventQueue.writeOffsetIdx);
            const needed = SharedEventQueue.headerBytes + writeOffset + 4 + bytes.length;
            if (needed > this.maxSize) {
                this.onError?.(`[SharedEventQueue] Dropped event: queue would exceed ${this.maxSize}-byte limit`);
                return;
            }
            if (needed > this.buffer.byteLength) {
                const newSize = Math.min(this.maxSize, Math.max(needed, this.buffer.byteLength * 2));
                try {
                    this.buffer.grow(newSize);
                    [this.view, this.atomicView, this.dataView] = SharedEventQueue.viewsFor(this.buffer);
                } catch (e: any) {
                    this.onError?.(`[SharedEventQueue] Dropped event: failed to grow buffer: ${e?.message ?? e}`);
                    return;
                }
            }
            const dataOffset = SharedEventQueue.headerBytes + writeOffset;
            this.dataView.setUint32(dataOffset, bytes.length, true);
            this.view.set(bytes, dataOffset + 4);
            Atomics.store(this.atomicView, SharedEventQueue.writeOffsetIdx, writeOffset + 4 + bytes.length);
        });
    }

    /** Drains every frame appended since the last drain, in order. Never blocks. */
    drain(): any[] {
        let copy: Uint8Array | undefined;
        this.withLock(() => {
            const writeOffset = Atomics.load(this.atomicView, SharedEventQueue.writeOffsetIdx);
            if (writeOffset > 0) {
                copy = this.view.slice(SharedEventQueue.headerBytes, SharedEventQueue.headerBytes + writeOffset);
                Atomics.store(this.atomicView, SharedEventQueue.writeOffsetIdx, 0);
            }
        });
        if (!copy) {
            return [];
        }
        const results: any[] = [];
        const view = new DataView(copy.buffer, copy.byteOffset, copy.byteLength);
        let offset = 0;
        while (offset + 4 <= copy.length) {
            const length = view.getUint32(offset, true);
            offset += 4;
            if (offset + length > copy.length) {
                break; // Truncated frame — shouldn't happen, guard against a malformed buffer.
            }
            try {
                results.push(JSON.parse(textDecoder.decode(copy.subarray(offset, offset + length))));
            } catch {
                // Ignore a malformed frame rather than losing the rest of the batch.
            }
            offset += length;
        }
        return results;
    }

    /** Runs `fn` while holding the cross-thread spinlock. Critical sections here are memory-only
     *  copies, so the spin is expected to resolve in well under a microsecond. Bounded rather than
     *  unconditional: the other side can be hard-killed (`Worker.terminate()`, the engine's own
     *  termination path) mid-critical-section, which would otherwise leave the lock held forever
     *  and freeze every future caller — after `LOCK_TIMEOUT_MS` with no progress, the lock is
     *  assumed abandoned and force-cleared instead of spinning indefinitely. */
    private withLock(fn: () => void): void {
        const deadline = Date.now() + SharedEventQueue.lockTimeoutMs;
        while (Atomics.compareExchange(this.atomicView, SharedEventQueue.lockIdx, LOCK_FREE, LOCK_HELD) !== LOCK_FREE) {
            if (Date.now() > deadline) {
                this.onError?.("[SharedEventQueue] Lock held past timeout — assuming the other side was terminated");
                Atomics.store(this.atomicView, SharedEventQueue.lockIdx, LOCK_HELD);
                break;
            }
        }
        try {
            fn();
        } finally {
            Atomics.store(this.atomicView, SharedEventQueue.lockIdx, LOCK_FREE);
        }
    }
}

export { SharedEventQueue };
