import { BrsType, Float, Int32, isBrsNumber } from "..";
import { BrsValue, ValueKind, BrsBoolean, BrsInvalid, BrsString } from "../BrsType";
import { BrsComponent, BrsIterable } from "./BrsComponent";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { crc32 } from "crc";

export class RoByteArray extends BrsComponent implements BrsValue, BrsIterable {
    readonly kind = ValueKind.Object;
    private elements: Uint8Array;
    private _capacity = 0;
    private _resizable = true;

    enumIndex: number;

    constructor();
    constructor(elementsParam: Uint8Array);
    constructor(elementsParam?: Uint8Array) {
        super("roByteArray");
        this.elements = elementsParam ?? new Uint8Array();
        this.enumIndex = this.elements.length ? 0 : -1;
        this.registerMethods({
            ifByteArray: [
                this.readFile,
                this.writeFile,
                this.appendFile,
                this.setResize,
                this.fromHexString,
                this.toHexString,
                this.fromBase64String,
                this.toBase64String,
                this.fromAsciiString,
                this.toAsciiString,
                this.getSignedByte,
                this.getSignedLong,
                this.getCRC32,
                this.isLittleEndianCPU,
            ],
            ifArray: [
                this.peek,
                this.pop,
                this.push,
                this.shift,
                this.unshift,
                this.delete,
                this.count,
                this.clear,
                this.append,
            ],
            ifArrayGet: [this.getEntry],
            ifArraySet: [this.setEntry],
            ifArraySizeInfo: [this.capacity, this.isResizable],
            ifEnum: [this.isEmpty, this.isNext, this.next, this.reset],
        });
    }

    toString(parent?: BrsType): string {
        if (parent) {
            return "<Component: roByteArray>";
        }

        return [
            "<Component: roByteArray> =",
            "[",
            ...this.getElements()
                .slice(0, 100)
                .map((el: BrsValue) => `    ${el.toString(this)}`),
            this.elements.length > 100 ? "    ...\n]" : "]",
        ].join("\r\n");
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    getValue() {
        return this.elements;
    }

    getElements(): Int32[] {
        const result: Int32[] = [];
        this.elements.slice().forEach((value: number) => {
            result.push(new Int32(value));
        });
        return result;
    }

    getByteArray() {
        return this.elements;
    }

    get(index: BrsType) {
        switch (index.kind) {
            case ValueKind.Float:
                return this.getElements()[Math.trunc(index.getValue())] ?? BrsInvalid.Instance;
            case ValueKind.Int32:
                return this.getElements()[index.getValue()] ?? BrsInvalid.Instance;
            case ValueKind.String:
                return this.getMethod(index.value) ?? BrsInvalid.Instance;
            default:
                postMessage(
                    "warning,Array indexes must be 32-bit integers or Float, method names must be strings"
                );
                return BrsInvalid.Instance;
        }
    }

    set(index: BrsType, value: BrsType) {
        if (index.kind !== ValueKind.Int32 && index.kind !== ValueKind.Float) {
            postMessage("warning,Array indexes must be 32-bit integers or Float.");
        } else if (value.kind !== ValueKind.Int32) {
            postMessage("warning,Byte array values must be 32-bit integers");
        } else {
            this.elements[Math.trunc(index.getValue())] = value.getValue();
        }
        return BrsInvalid.Instance;
    }

    getNext() {
        const index = this.enumIndex;
        if (index >= 0) {
            this.enumIndex++;
            if (this.enumIndex >= this.elements.length) {
                this.enumIndex = -1;
            }
        }
        return new Int32(this.elements[this.enumIndex]);
    }

    updateNext() {
        const hasItems = this.elements.length > 0;
        if (this.enumIndex === -1 && hasItems) {
            this.enumIndex = 0;
        } else if (this.enumIndex >= this.elements.length || !hasItems) {
            this.enumIndex = -1;
        }
    }

    updateCapacity(growthFactor = 0) {
        if (this._resizable && growthFactor > 0) {
            if (this.elements.length > 0 && this.elements.length > this._capacity) {
                let count = this.elements.length - 1;
                let newCap = Math.trunc(count * growthFactor);
                if (newCap - this._capacity < 16) {
                    this._capacity = Math.trunc(16 * (count / 16 + 1));
                } else {
                    this._capacity = newCap;
                }
            }
        } else {
            this._capacity = Math.max(this.elements.length, this._capacity);
        }
    }

    // ifByteArray ---------------------------------------------------------------------

    /** Reads the specified file into the Byte Array. Any data currently in the Byte Array is discarded. */
    private readFile = new Callable("readFile", {
        signature: {
            args: [
                new StdlibArgument("path", ValueKind.String),
                new StdlibArgument("index", ValueKind.Int32, new Int32(0)),
                new StdlibArgument("length", ValueKind.Int32, new Int32(-1)),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, filepath: BrsString, index: Int32, length: Int32) => {
            try {
                const url = new URL(filepath.value);
                const volume = interpreter.fileSystem.get(url.protocol);
                if (volume) {
                    let array: Uint8Array = volume.readFileSync(url.pathname);
                    if (index.getValue() > 0 || length.getValue() > 0) {
                        let start = index.getValue();
                        let end = length.getValue() < 1 ? undefined : start + length.getValue();
                        array = array.slice(start, end);
                    }
                    if (this._resizable || array.length <= this._capacity) {
                        this.elements = array;
                        this.updateNext();
                        this.updateCapacity();
                        return BrsBoolean.True;
                    }
                }
            } catch (err: any) {
                return BrsBoolean.False;
            }
            return BrsBoolean.False;
        },
    });

    /** Writes the bytes (or a subset) contained in the Byte Array to the specified file. */
    private writeFile = new Callable("writeFile", {
        signature: {
            args: [
                new StdlibArgument("path", ValueKind.String),
                new StdlibArgument("index", ValueKind.Int32, new Int32(0)),
                new StdlibArgument("length", ValueKind.Int32, new Int32(-1)),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, filepath: BrsString, index: Int32, length: Int32) => {
            try {
                const url = new URL(filepath.value);
                if (url.protocol === "tmp:" || url.protocol === "cachefs:") {
                    const volume = interpreter.fileSystem.get(url.protocol);
                    if (volume) {
                        if (index.getValue() > 0 || length.getValue() > 0) {
                            let start = index.getValue();
                            let end = length.getValue() < 1 ? undefined : start + length.getValue();
                            volume.writeFileSync(
                                url.pathname,
                                Buffer.from(this.elements.slice(start, end))
                            );
                        } else {
                            volume.writeFileSync(url.pathname, Buffer.from(this.elements));
                        }
                        return BrsBoolean.True;
                    }
                }
            } catch (err: any) {
                return BrsBoolean.False;
            }
            return BrsBoolean.False;
        },
    });

    /** Appends the contents (or a subset) of the Byte Array to the specified file. */
    private appendFile = new Callable("appendFile", {
        signature: {
            args: [
                new StdlibArgument("path", ValueKind.String),
                new StdlibArgument("index", ValueKind.Int32, new Int32(0)),
                new StdlibArgument("length", ValueKind.Int32, new Int32(-1)),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, filepath: BrsString, index: Int32, length: Int32) => {
            try {
                const url = new URL(filepath.value);
                if (url.protocol === "tmp:" || url.protocol === "cachefs:") {
                    const volume = interpreter.fileSystem.get(url.protocol);
                    if (volume) {
                        let file: Uint8Array = volume.readFileSync(url.pathname);
                        let array: Uint8Array;
                        if (index.getValue() > 0 || length.getValue() > 0) {
                            let start = index.getValue();
                            let end = length.getValue() < 1 ? undefined : start + length.getValue();
                            let elements = this.elements.slice(start, end);
                            array = new Uint8Array(file.length + elements.length);
                            array.set(file, 0);
                            array.set(elements, file.length);
                        } else {
                            array = new Uint8Array(file.length + this.elements.length);
                            array.set(file, 0);
                            array.set(this.elements, file.length);
                        }
                        volume.writeFileSync(url.pathname, Buffer.from(array));
                        return BrsBoolean.True;
                    }
                }
            } catch (err: any) {
                return BrsBoolean.False;
            }
            return BrsBoolean.False;
        },
    });

    /** Sets the contents of the Byte Array to the specified string using UTF-8 encoding. Any data currently in the Byte Array is discarded. */
    private fromAsciiString = new Callable("fromAsciiString", {
        signature: {
            args: [new StdlibArgument("asciiStr", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, asciiStr: BrsString) => {
            const array = new Uint8Array(Buffer.from(asciiStr.value, "utf8"));
            if (this._resizable || array.length <= this._capacity) {
                this.elements = array;
                this.updateNext();
                this.updateCapacity();
            }
            return BrsInvalid.Instance;
        },
    });

    /** Returns the contents of the Byte Array as a string. The contents must be valid UTF-8 (or ASCII subset), or the result is undefined. */
    private toAsciiString = new Callable("toAsciiString", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(Buffer.from(this.elements).toString("utf8"));
        },
    });

    private fromHexString = new Callable("fromHexString", {
        signature: {
            args: [new StdlibArgument("hexStr", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, hexStr: BrsString) => {
            const value = hexStr.value.replace(/[^0-9A-Fa-f]/g, "0");
            if (this._resizable || (value.length % 2 === 0 && value.length / 2 <= this._capacity)) {
                this.elements = new Uint8Array(Buffer.from(value, "hex"));
                this.updateNext();
                this.updateCapacity();
            }
            return BrsInvalid.Instance;
        },
    });

    /** Returns a hexadecimal string representing the contents of the Byte Array, two digits per byte. */
    private toHexString = new Callable("toHexString", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            const hex = Buffer.from(this.elements).toString("hex");
            return new BrsString(hex.toUpperCase());
        },
    });

    /** Sets the contents of the Byte Array to the specified value. Any data currently in the Byte Array is discarded. */
    private fromBase64String = new Callable("fromBase64String", {
        signature: {
            args: [new StdlibArgument("hexStr", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, hexStr: BrsString) => {
            const array = new Uint8Array(Buffer.from(hexStr.value, "base64"));
            if (this._resizable || array.length <= this._capacity) {
                this.elements = array;
                this.updateNext();
                this.updateCapacity();
            }
            return BrsInvalid.Instance;
        },
    });

    /** Returns a base-64 string representing the contents of the Byte Array. */
    private toBase64String = new Callable("toBase64String", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(Buffer.from(this.elements).toString("base64"));
        },
    });

    /** Returns the signed byte at the specified zero-based index in the Byte Array. */
    private getSignedByte = new Callable("getSignedByte", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, index: Int32) => {
            if (index.getValue() < this.elements.length) {
                let byte = (this.elements[index.getValue()] << 24) >> 24;
                return new Int32(byte);
            }
            return new Int32(0);
        },
    });

    /** Returns the signed long (four bytes) starting at the specified zero-based index in the Byte Array. */
    private getSignedLong = new Callable("getSignedLong", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, index: Int32) => {
            if (index.getValue() < this.elements.length - 3) {
                const dataView = new DataView(this.elements.buffer, index.getValue(), 4);
                const long = dataView.getInt32(0, true);
                return new Int32(long);
            }
            return new Int32(0);
        },
    });

    /** Calculates a CRC-32 of the contents (or a subset) of the Byte Array. */
    private getCRC32 = new Callable("getCRC32", {
        signature: {
            args: [
                new StdlibArgument("index", ValueKind.Int32, new Int32(0)),
                new StdlibArgument("length", ValueKind.Int32, new Int32(-1)),
            ],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, index: Int32, length: Int32) => {
            if (index.getValue() > 0 || length.getValue() > 0) {
                let start = index.getValue();
                let end = length.getValue() < 1 ? undefined : start + length.getValue();
                return new Int32(crc32(Buffer.from(this.elements.slice(start, end))));
            }
            return new Int32(crc32(Buffer.from(this.elements)));
        },
    });

    /** If the size of the Byte Array is less than min_size, expands the Byte Array to min_size. */
    private setResize = new Callable("setResize", {
        signature: {
            args: [
                new StdlibArgument("minSize", ValueKind.Int32),
                new StdlibArgument("autoResize", ValueKind.Boolean),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, minSize: Int32, autoResize: BrsBoolean) => {
            this._capacity = Math.max(minSize.getValue(), this.elements.length);
            this._resizable = autoResize.toBoolean();
            return BrsInvalid.Instance;
        },
    });

    /** Returns true if the CPU architecture is little-endian. */
    private isLittleEndianCPU = new Callable("isLittleEndianCPU", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            // Solution from: https://abdulapopoola.com/2019/01/20/check-endianness-with-javascript/
            const uInt32 = new Uint32Array([0x11223344]);
            const uInt8 = new Uint8Array(uInt32.buffer);
            return BrsBoolean.from(uInt8[0] === 0x44);
        },
    });

    // ifArray -------------------------------------------------------------------------

    /** Returns the last array entry without removing it. If the array is empty, returns invalid. */
    private peek = new Callable("peek", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            const item = this.elements[this.elements.length - 1];
            return item ? new Int32(item) : BrsInvalid.Instance;
        },
    });

    /** Returns the last entry from the array and removes it. If the array is empty, returns invalid. */
    private pop = new Callable("pop", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            const index = this.elements.length - 1;
            const item = this.elements[index];
            let array = new Uint8Array(index);
            array.set(this.elements.slice(0, index), 0);
            this.elements = array;
            return item ? new Int32(item) : BrsInvalid.Instance;
        },
    });

    /** Adds the specified value to the end of the array. */
    private push = new Callable("push", {
        signature: {
            args: [new StdlibArgument("byte", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, byte: Int32 | Float | BrsInvalid) => {
            if (isBrsNumber(byte)) {
                if (this._resizable || this.elements.length < this._capacity) {
                    let array = new Uint8Array(this.elements.length + 1);
                    array.set(this.elements, 0);
                    array[this.elements.length] = byte.getValue();
                    this.elements = array;
                    this.updateNext();
                    this.updateCapacity(1.5);
                } else {
                    postMessage(
                        `warning,BRIGHTSCRIPT: ERROR: roByteArray.Push: set ignored for index out of bounds on non-resizable array: ${interpreter.formatLocation()}`
                    );
                }
            } else {
                postMessage(
                    `warning,BRIGHTSCRIPT: ERROR: roByteArray.Push: set ignored for non-numeric value: ${interpreter.formatLocation()}`
                );
            }
            return BrsInvalid.Instance;
        },
    });

    /** Removes the first entry (zero index) from the beginning of the array and shifts the other entries up. */
    private shift = new Callable("shift", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            const item = this.elements[0];
            let array = new Uint8Array(this.elements.length - 1);
            array.set(array.slice(1, this.elements.length), 0);
            this.elements = array;
            return item ? new Int32(item) : BrsInvalid.Instance;
        },
    });

    /** Adds the specified value to the beginning of the array (at the zero index) and shifts the other entries down. */
    private unshift = new Callable("unshift", {
        signature: {
            args: [new StdlibArgument("byte", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, byte: Int32 | Float | BrsInvalid) => {
            if (isBrsNumber(byte)) {
                if (this._resizable || this.elements.length < this._capacity) {
                    let array = new Uint8Array(this.elements.length + 1);
                    array[0] = byte.getValue();
                    array.set(this.elements, 1);
                    this.elements = array;
                    this.updateNext();
                    this.updateCapacity(1.25);
                } else {
                    postMessage(
                        `warning,BRIGHTSCRIPT: ERROR: roByteArray.Unshift: unshift ignored for full non-resizable array: ${interpreter.formatLocation()}`
                    );
                }
            } else {
                postMessage(
                    `warning,BRIGHTSCRIPT: ERROR: roByteArray.Unshift: unshift ignored for non-numeric value: ${interpreter.formatLocation()}`
                );
            }
            return BrsInvalid.Instance;
        },
    });

    /** Deletes the indicated array entry, and shifts all entries up. This decreases the array length by one. */
    private delete = new Callable("delete", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, index: Int32) => {
            if (index.lessThan(new Int32(0)).toBoolean()) {
                return BrsBoolean.False;
            }
            let array = new Uint8Array(this.elements.length + 1);
            const idx = index.getValue();
            array.set(this.elements.slice(0, idx), 0);
            array.set(this.elements.slice(idx + 1, this.elements.length), idx);
            return BrsBoolean.True;
        },
    });

    /** Returns the length of the array, which is one more than the index of highest entry. */
    private count = new Callable("count", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.elements.length);
        },
    });

    /** Deletes all the entries in the array. */
    private clear = new Callable("clear", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.elements = new Uint8Array();
            this.enumIndex = -1;
            return BrsInvalid.Instance;
        },
    });

    /** Appends the entries in one roArray to another. */
    private append = new Callable("append", {
        signature: {
            args: [new StdlibArgument("array", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, array: BrsComponent) => {
            if (!(array instanceof RoByteArray)) {
                // TODO: validate against RBI
                return BrsInvalid.Instance;
            }
            if (this._resizable || this.elements.length + array.elements.length <= this._capacity) {
                this.elements = new Uint8Array([...this.elements, ...array.elements]);
                this.updateNext();
                this.updateCapacity();
            }
            return BrsInvalid.Instance;
        },
    });

    // ifArrayGet -------------------------------------------------------------------------

    /** Returns an array entry based on the provided index. */
    private getEntry = new Callable("getEntry", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Dynamic)],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter, index: BrsType) => {
            if (index.kind === ValueKind.Int32 || index.kind === ValueKind.Float) {
                return this.getElements()[Math.trunc(index.getValue())] || BrsInvalid.Instance;
            }
            return BrsInvalid.Instance;
        },
    });

    // ifArraySet  -------------------------------------------------------------------------

    /** Sets an entry at a given index to the passed value. If index is beyond the bounds of the array, the array is expanded. */
    private setEntry = new Callable("setEntry", {
        signature: {
            args: [
                new StdlibArgument("index", ValueKind.Dynamic),
                new StdlibArgument("value", ValueKind.Dynamic),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, index: BrsType, value: BrsType) => {
            return this.set(index, value);
        },
    });

    // ifArraySizeInfo ---------------------------------------------------------------------

    /** Returns the maximum number of entries that can be stored in the array. */
    private capacity = new Callable("capacity", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this._capacity);
        },
    });

    /** Returns true if the array can be resized. */
    private isResizable = new Callable("isResizable", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this._resizable);
        },
    });

    // ifEnum -------------------------------------------------------------------------

    /** Checks whether the enumeration contains no elements. */
    private isEmpty = new Callable("isEmpty", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.elements.length === 0);
        },
    });

    /** Checks whether the current position is not past the end of the enumeration. */
    private isNext = new Callable("isNext", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.enumIndex >= 0);
        },
    });

    /** Resets the current position to the first element of the enumeration. */
    private reset = new Callable("reset", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.enumIndex = this.elements.length > 0 ? 0 : -1;
            return BrsInvalid.Instance;
        },
    });

    /** Increments the position of an enumeration. */
    private next = new Callable("next", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.getNext() ?? BrsInvalid.Instance;
        },
    });
}
