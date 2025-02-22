/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
class SharedObject {
    private readonly offset = 8;
    private lengthIdx = 0;
    private versionIdx = 1;
    private buffer: SharedArrayBuffer;
    private view: Uint8Array;
    private maxSize: number;
    private atomicView: Int32Array;

    constructor(initialSize?: number, maxSize?: number) {
        initialSize = initialSize ?? 32 * 1024; // 32KB default
        this.maxSize = maxSize ?? 1024 * 1024; // 1MB default
        this.buffer = new SharedArrayBuffer(initialSize, { maxByteLength: this.maxSize });
        this.view = new Uint8Array(this.buffer);
        this.atomicView = new Int32Array(this.buffer, 0, 2);
        Atomics.store(this.atomicView, this.lengthIdx, 0); // Initialize length to 0
        Atomics.store(this.atomicView, this.versionIdx, 0); // Initialize version to 0
    }

    setBuffer(buffer: SharedArrayBuffer): void {
        this.buffer = buffer;
        this.view = new Uint8Array(this.buffer);
        this.atomicView = new Int32Array(this.buffer, 0, 2);
        this.maxSize = Math.max(this.maxSize, this.buffer.byteLength);
    }

    getBuffer(): SharedArrayBuffer {
        return this.buffer;
    }

    getVersion(): number {
        return Atomics.load(this.atomicView, this.versionIdx);
    }

    waitStore(obj: any, version: number, timeout: number = 10000): void {
        const result = Atomics.waitAsync(this.atomicView, this.versionIdx, version, timeout);
        if (result.async) {
            result.value.then((status) => {
                if (status === "ok") {
                    console.log("[API] Buffer released. Storing data.");
                    this.store(obj);
                } else {
                    console.error("[API] Error storing shared data", status);
                }
            });
        } else if (result.value === "not-equal") {
            console.log("[API] Buffer is free. Storing data.");
            this.store(obj);
        }
    }

    store(obj: any): void {
        const serialized = JSON.stringify(obj);
        const data = new TextEncoder().encode(serialized);
        const dataLength = data.length;

        this.ensureCapacity(dataLength + 8);

        // Store the data
        this.view.set(data, 8);

        Atomics.store(this.atomicView, this.lengthIdx, dataLength);
        Atomics.add(this.atomicView, this.versionIdx, 1); // Increment version
        Atomics.notify(this.atomicView, this.versionIdx);
    }

    load(resetVersion: boolean = false): any | null {
        const currentLength = Atomics.load(this.atomicView, 0);
        if (currentLength < 1) {
            return {};
        }

        const data = this.view.subarray(this.offset, this.offset + currentLength);
        const serialized = new TextDecoder().decode(new Uint8Array(data).buffer);

        if (resetVersion) {
            Atomics.store(this.atomicView, this.versionIdx, 0); // Reset version
            Atomics.notify(this.atomicView, this.versionIdx);
        }

        try {
            return JSON.parse(serialized);
        } catch (error) {
            console.error("Error parsing data:", error, serialized);
            return null;
        }
    }

    private ensureCapacity(size: number): void {
        if (size > this.maxSize) {
            throw new Error("SharedObjectBuffer is full. Cannot store more data.");
        }

        if (size > this.buffer.byteLength) {
            let newSize = Math.min(this.maxSize, Math.max(size * 2, this.buffer.byteLength * 2)); // Double or required, respect max size

            try {
                this.buffer.grow(newSize); // Grow the buffer IN PLACE
                this.view = new Uint8Array(this.buffer); // Update the view
                this.atomicView = new Int32Array(this.buffer, 0, 2); // Update atomic offset view
            } catch (e) {
                console.error("Error growing buffer:", e);
                throw e;
            }
        }
    }
}

export default SharedObject;
