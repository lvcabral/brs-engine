/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * SharedObject serializes JSON payloads or raw buffers into a resizable SharedArrayBuffer
 * to coordinate state between the host and worker threads via Atomics.
 */
class SharedObject {
    private readonly offset = 8;
    private readonly queue: { obj: any; version: number; timeout: number }[] = [];
    private readonly lengthIdx = 0;
    private readonly versionIdx = 1;
    private buffer: SharedArrayBuffer;
    private view: Uint8Array;
    private maxSize: number;
    private atomicView: Int32Array;
    private isProcessing: boolean = false;

    /**
     * @param initialSize Optional initial buffer size in bytes (defaults to 32KB).
     * @param maxSize Optional hard cap for automatic growth (defaults to 3MB).
     */
    constructor(initialSize?: number, maxSize?: number) {
        initialSize = initialSize ?? 32 * 1024; // 32KB default
        this.maxSize = maxSize ?? 3 * 1024 * 1024; // 3MB default
        this.buffer = new SharedArrayBuffer(initialSize, { maxByteLength: this.maxSize });
        this.view = new Uint8Array(this.buffer);
        this.atomicView = new Int32Array(this.buffer, 0, 2);
        Atomics.store(this.atomicView, this.lengthIdx, 0); // Initialize length to 0
        Atomics.store(this.atomicView, this.versionIdx, 0); // Initialize version to 0
    }

    /**
     * Replaces the underlying shared buffer with an externally provided one.
     * @param buffer New shared buffer reference.
     */
    setBuffer(buffer: SharedArrayBuffer): void {
        this.buffer = buffer;
        this.view = new Uint8Array(this.buffer);
        this.atomicView = new Int32Array(this.buffer, 0, 2);
        this.maxSize = Math.max(this.maxSize, this.buffer.byteLength);
    }

    /**
     * @returns Current SharedArrayBuffer handle backing the object.
     */
    getBuffer(): SharedArrayBuffer {
        return this.buffer;
    }

    /**
     * @returns Monotonic version counter used to detect new writes.
     */
    getVersion(): number {
        return Atomics.load(this.atomicView, this.versionIdx);
    }

    /**
     * Enqueues a write request that should execute once the buffer version differs.
     * @param obj Arbitrary payload to persist.
     * @param version Version to wait on before writing.
     * @param timeout Optional timeout in ms before the wait is considered failed.
     */
    waitStore(obj: any, version: number, timeout: number = 10000): void {
        this.queue.push({ obj, version, timeout });
        this.processQueue();
    }

    /**
     * Blocks the current thread until the version changes or timeout is hit.
     * @param version Expected version value.
     * @param timeout Optional timeout in ms.
     * @returns Atomics wait result string.
     */
    waitVersion(version: number, timeout?: number) {
        return Atomics.wait(this.atomicView, this.versionIdx, version, timeout);
    }

    /**
     * Processes the wait queue sequentially, honoring Atomics.waitAsync when present.
     */
    private processQueue(): void {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;
        const { obj, version, timeout } = this.queue[0];

        if (typeof Atomics.waitAsync === "function") {
            const result = Atomics.waitAsync(this.atomicView, this.versionIdx, version, timeout);
            if (result.async) {
                result.value.then((status) => {
                    if (status === "ok") {
                        this.store(obj);
                        console.debug("[SharedObject] Buffer released. Stored data.", obj.field, this.getVersion());
                    } else {
                        console.error("[SharedObject] Error storing shared data", status, obj.field);
                    }
                    this.queue.shift();
                    this.isProcessing = false;
                    this.processQueue();
                });
            } else if (result.value === "not-equal") {
                this.store(obj);
                console.debug("[SharedObject] Buffer is free. Stored data.", obj.field, this.getVersion());
                this.queue.shift();
                this.isProcessing = false;
                this.processQueue();
            } else {
                console.error("[SharedObject] Error storing shared data: timeout", obj.field);
                this.queue.shift();
                this.isProcessing = false;
                this.processQueue();
            }
        } else {
            // Fallback for browsers that do not support Atomics.waitAsync (e.g., Firefox)
            const start = Date.now();
            const checkCondition = () => {
                if (Atomics.load(this.atomicView, this.versionIdx) !== version) {
                    console.debug("[SharedObject] Buffer is free. Storing data.");
                    this.store(obj);
                    this.queue.shift();
                    this.isProcessing = false;
                    this.processQueue();
                } else if (Date.now() - start < timeout) {
                    setTimeout(checkCondition, 10); // Check every 10ms
                } else {
                    console.error("[SharedObject] Error storing shared data: timeout", obj.field);
                    this.queue.shift();
                    this.isProcessing = false;
                    this.processQueue();
                }
            };
            checkCondition();
        }
    }

    /**
     * Serializes an object to JSON and writes it to the shared buffer.
     * @param obj Arbitrary JSON-serializable payload.
     */
    store(obj: any): void {
        const serialized = JSON.stringify(obj);
        const data = new TextEncoder().encode(serialized);
        this.writeToBuffer(data);
    }

    /**
     * Stores raw binary data directly into the shared buffer.
     * @param buffer Binary payload to copy.
     */
    storeData(buffer: ArrayBufferLike): void {
        const data = new Uint8Array(buffer);
        this.writeToBuffer(data);
    }

    /**
     * Reads the current buffer contents and parses the serialized JSON payload.
     * @param resetVersion When true, resets the version counter to zero after reading.
     * @returns Deserialized object or empty object on failure.
     */
    load(resetVersion: boolean = false) {
        const data = this.readFromBuffer(resetVersion);
        if (!data) {
            return {};
        }

        const serialized = new TextDecoder().decode(data);
        try {
            return JSON.parse(serialized);
        } catch (error) {
            console.error("Error parsing data:", error, serialized);
            return {};
        }
    }

    /**
     * Reads the raw binary payload without JSON parsing.
     * @param resetVersion When true, resets the version counter to zero after reading.
     * @returns A copy of the stored buffer slice or undefined if empty.
     */
    loadData(resetVersion: boolean = false): ArrayBufferLike | undefined {
        const data = this.readFromBuffer(resetVersion);
        if (!data) {
            return undefined;
        }

        return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }

    /**
     * Copies encoded bytes into the shared view and updates version metadata.
     * @param data Encoded payload.
     */
    private writeToBuffer(data: Uint8Array): void {
        const dataLength = data.length;
        if (!this.ensureCapacity(dataLength + this.offset)) {
            return;
        }

        this.view.set(data, this.offset);
        Atomics.store(this.atomicView, this.lengthIdx, dataLength);
        Atomics.add(this.atomicView, this.versionIdx, 1);
        Atomics.notify(this.atomicView, this.versionIdx);
    }

    /**
     * Returns a copy of the currently stored bytes, optionally resetting the version.
     * @param resetVersion Whether to zero the version counter after reading.
     */
    private readFromBuffer(resetVersion: boolean): Uint8Array | undefined {
        const currentLength = Atomics.load(this.atomicView, this.lengthIdx);
        if (currentLength < 1) {
            return undefined;
        }

        const data = this.view.slice(this.offset, this.offset + currentLength);
        if (resetVersion) {
            Atomics.store(this.atomicView, this.versionIdx, 0);
            Atomics.notify(this.atomicView, this.versionIdx);
        }

        return data;
    }

    /**
     * Ensures the backing buffer can accommodate the requested payload size.
     * @param size Total number of bytes required (payload + header offset).
     * @returns True when the buffer is ready; false if it exceeds max size or fails to grow.
     */
    private ensureCapacity(size: number): boolean {
        if (size > this.maxSize) {
            console.error(`[SharedObject] Buffer is full. Cannot store more data. ${size} > ${this.maxSize}`);
            return false;
        }
        if (size > this.buffer.byteLength) {
            let newSize = Math.min(this.maxSize, Math.max(size * 2, this.buffer.byteLength * 2)); // Double or required, respect max size
            try {
                this.buffer.grow(newSize); // Grow the buffer IN PLACE
                this.view = new Uint8Array(this.buffer); // Update the view
                this.atomicView = new Int32Array(this.buffer, 0, 2); // Update atomic offset view
            } catch (e) {
                console.error("[SharedObject] Error growing buffer:", e);
                return false;
            }
        }
        return true;
    }
}

export default SharedObject;
