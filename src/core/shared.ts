/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
class SharedObjectBuffer {
    private buffer: SharedArrayBuffer;
    private view: Uint8Array;
    private maxSize: number;
    private atomicOffsetView: Int32Array;

    constructor(initialSize: number, maxSize: number) {
        initialSize = initialSize ?? 32 * 1024; // 32KB default
        this.maxSize = maxSize ?? 1024 * 1024; // 1MB default
        this.buffer = new SharedArrayBuffer(initialSize, { maxByteLength: this.maxSize });
        this.view = new Uint8Array(this.buffer);
        this.atomicOffsetView = new Int32Array(this.buffer, 0, 2);
        Atomics.store(this.atomicOffsetView, 0, 8); // Initialize offset to 8 to leave space for length and version
        Atomics.store(this.atomicOffsetView, 1, 0); // Initialize version to 0
    }

    setBuffer(buffer: SharedArrayBuffer): void {
        this.buffer = buffer;
        this.view = new Uint8Array(this.buffer);
        this.atomicOffsetView = new Int32Array(this.buffer, 0, 2);
        this.maxSize = Math.max(this.maxSize, this.buffer.byteLength);
    }

    getBuffer(): SharedArrayBuffer {
        return this.buffer;
    }

    getVersion(): number {
        return Atomics.load(this.atomicOffsetView, 1);
    }

    store(obj: any): void {
        const serialized = JSON.stringify(obj);
        const data = new TextEncoder().encode(serialized);
        const dataLength = data.length;

        this.ensureCapacity(dataLength + 8);

        // Store the data
        this.view.set(data, 8);

        Atomics.store(this.atomicOffsetView, 0, dataLength);
        Atomics.add(this.atomicOffsetView, 1, 1); // Increment version
        Atomics.notify(this.atomicOffsetView, 1);
    }

    load(): any | null {
        const currentOffset = Atomics.load(this.atomicOffsetView, 0);
        if (currentOffset <= 8) {
            return {};
        }

        const data = this.view.subarray(8, 8 + currentOffset);
        const serialized = new TextDecoder().decode(new Uint8Array(data).buffer);

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
                this.atomicOffsetView = new Int32Array(this.buffer, 0, 2); // Update atomic offset view
            } catch (e) {
                console.error("Error growing buffer:", e);
                throw e;
            }
        }
    }
}

export default SharedObjectBuffer;
