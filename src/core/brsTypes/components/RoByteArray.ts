import { BrsType, Float, Int32, isBoxedNumber, isBrsNumber } from "..";
import { BrsValue, ValueKind, BrsBoolean, BrsInvalid, BrsString } from "../BrsType";
import { BrsComponent, BrsIterable } from "./BrsComponent";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { validUri, writeUri } from "../../device/FileSystem";
import { crc32 } from "crc";
import { IfEnum } from "../interfaces/IfEnum";
import { BrsDevice } from "../../device/BrsDevice";

export class RoByteArray extends BrsComponent implements BrsValue, BrsIterable {
    readonly kind = ValueKind.Object;
    private maxSize = 0;
    private resizable = true;
    elements: Uint8Array;
    enumIndex: number;

    constructor();
    constructor(elementsParam: Uint8Array);
    constructor(elementsParam?: Uint8Array) {
        super("roByteArray");
        this.elements = elementsParam ?? new Uint8Array();
        this.enumIndex = this.elements.length ? 0 : -1;
        const ifEnum = new IfEnum(this);
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
            ifEnum: [ifEnum.isEmpty, ifEnum.isNext, ifEnum.next, ifEnum.reset],
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
        ].join("\n");
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
        if (isBoxedNumber(index)) {
            index = index.unbox();
        }
        switch (index.kind) {
            case ValueKind.Float:
                return this.getElements()[Math.trunc(index.getValue())] ?? BrsInvalid.Instance;
            case ValueKind.Int32:
                return this.getElements()[index.getValue()] ?? BrsInvalid.Instance;
            case ValueKind.String:
                return this.getMethod(index.value) ?? BrsInvalid.Instance;
            default:
                return BrsInvalid.Instance;
        }
    }

    set(index: BrsType, value: BrsType) {
        if (isBoxedNumber(index)) {
            index = index.unbox();
        }
        if (isBrsNumber(index) && value.kind === ValueKind.Int32) {
            if (index.kind === ValueKind.Int64) {
                index = new Int32(index.getValue());
            }
            const idx = Math.trunc(index.getValue());
            // Expand the array if the index is out of bounds
            if (idx >= this.elements.length) {
                const elements = new Uint8Array(idx + 1);
                elements.set(this.elements);
                this.elements = elements;
            }
            this.elements[idx] = value.getValue();
        }
        return BrsInvalid.Instance;
    }

    hasNext() {
        return BrsBoolean.from(this.enumIndex >= 0);
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

    resetNext() {
        this.enumIndex = this.elements.length > 0 ? 0 : -1;
    }

    updateCapacity(growthFactor = 0) {
        if (this.resizable && growthFactor > 0) {
            if (this.elements.length > 0 && this.elements.length > this.maxSize) {
                let count = this.elements.length - 1;
                let newCap = Math.trunc(count * growthFactor);
                if (newCap - this.maxSize < 16) {
                    this.maxSize = Math.trunc(16 * (count / 16 + 1));
                } else {
                    this.maxSize = newCap;
                }
            }
        } else {
            this.maxSize = Math.max(this.elements.length, this.maxSize);
        }
    }

    isLittleEndian() {
        // Solution from: https://abdulapopoola.com/2019/01/20/check-endianness-with-javascript/
        const uInt32 = new Uint32Array([0x11223344]);
        const uInt8 = new Uint8Array(uInt32.buffer);
        return uInt8[0] === 0x44;
    }

    // ifByteArray ---------------------------------------------------------------------

    /** Reads the specified file into the Byte Array. Any data currently in the Byte Array is discarded. */
    private readonly readFile = new Callable("readFile", {
        signature: {
            args: [
                new StdlibArgument("path", ValueKind.String),
                new StdlibArgument("index", ValueKind.Int32, new Int32(0)),
                new StdlibArgument("length", ValueKind.Int32, new Int32(-1)),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, filepath: BrsString, index: Int32, length: Int32) => {
            try {
                const fsys = BrsDevice.fileSystem;
                if (fsys && validUri(filepath.value)) {
                    let array: Uint8Array = fsys.readFileSync(filepath.value);
                    if (index.getValue() > 0 || length.getValue() > 0) {
                        let start = index.getValue();
                        let end = length.getValue() < 1 ? undefined : start + length.getValue();
                        array = array.slice(start, end);
                    }
                    if (this.resizable || array.length <= this.maxSize) {
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
    private readonly writeFile = new Callable("writeFile", {
        signature: {
            args: [
                new StdlibArgument("path", ValueKind.String),
                new StdlibArgument("index", ValueKind.Int32, new Int32(0)),
                new StdlibArgument("length", ValueKind.Int32, new Int32(-1)),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, filepath: BrsString, index: Int32, length: Int32) => {
            try {
                const fsys = BrsDevice.fileSystem;
                if (fsys && writeUri(filepath.value)) {
                    if (index.getValue() > 0 || length.getValue() > 0) {
                        let start = index.getValue();
                        let end = length.getValue() < 1 ? undefined : start + length.getValue();
                        fsys.writeFileSync(filepath.value, Buffer.from(this.elements.slice(start, end)));
                    } else {
                        fsys.writeFileSync(filepath.value, Buffer.from(this.elements));
                    }
                    return BrsBoolean.True;
                }
            } catch (err: any) {
                return BrsBoolean.False;
            }
            return BrsBoolean.False;
        },
    });

    /** Appends the contents (or a subset) of the Byte Array to the specified file. */
    private readonly appendFile = new Callable("appendFile", {
        signature: {
            args: [
                new StdlibArgument("path", ValueKind.String),
                new StdlibArgument("index", ValueKind.Int32, new Int32(0)),
                new StdlibArgument("length", ValueKind.Int32, new Int32(-1)),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, filepath: BrsString, index: Int32, length: Int32) => {
            try {
                const fsys = BrsDevice.fileSystem;
                if (fsys && writeUri(filepath.value)) {
                    let file: Uint8Array = fsys.readFileSync(filepath.value);
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
                    fsys.writeFileSync(filepath.value, Buffer.from(array));
                    return BrsBoolean.True;
                }
            } catch (err: any) {
                return BrsBoolean.False;
            }
            return BrsBoolean.False;
        },
    });

    /** Sets the contents of the Byte Array to the specified string using UTF-8 encoding. Any data currently in the Byte Array is discarded. */
    private readonly fromAsciiString = new Callable("fromAsciiString", {
        signature: {
            args: [new StdlibArgument("asciiStr", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, asciiStr: BrsString) => {
            const array = new Uint8Array(Buffer.from(asciiStr.value, "utf8"));
            if (this.resizable || array.length <= this.maxSize) {
                this.elements = array;
                this.updateNext();
                this.updateCapacity();
            }
            return BrsInvalid.Instance;
        },
    });

    /** Returns the contents of the Byte Array as a string. The contents must be valid UTF-8 (or ASCII subset), or the result is undefined. */
    private readonly toAsciiString = new Callable("toAsciiString", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(Buffer.from(this.elements).toString("utf8"));
        },
    });

    private readonly fromHexString = new Callable("fromHexString", {
        signature: {
            args: [new StdlibArgument("hexStr", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, hexStr: BrsString) => {
            const value = hexStr.value.replace(/[^0-9A-Fa-f]/g, "0");
            if (value.length % 2 === 0 && (this.resizable || value.length / 2 <= this.maxSize)) {
                this.elements = new Uint8Array(Buffer.from(value, "hex"));
                this.updateNext();
                this.updateCapacity();
            }
            return BrsInvalid.Instance;
        },
    });

    /** Returns a hexadecimal string representing the contents of the Byte Array, two digits per byte. */
    private readonly toHexString = new Callable("toHexString", {
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
    private readonly fromBase64String = new Callable("fromBase64String", {
        signature: {
            args: [new StdlibArgument("hexStr", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, hexStr: BrsString) => {
            const array = new Uint8Array(Buffer.from(hexStr.value, "base64"));
            if (this.resizable || array.length <= this.maxSize) {
                this.elements = array;
                this.updateNext();
                this.updateCapacity();
            }
            return BrsInvalid.Instance;
        },
    });

    /** Returns a base-64 string representing the contents of the Byte Array. */
    private readonly toBase64String = new Callable("toBase64String", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(Buffer.from(this.elements).toString("base64"));
        },
    });

    /** Returns the signed byte at the specified zero-based index in the Byte Array. */
    private readonly getSignedByte = new Callable("getSignedByte", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Int32 | ValueKind.Float)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, index: Int32 | Float) => {
            const idx = Math.trunc(index.getValue());
            if (idx < this.elements.length) {
                let byte = (this.elements[idx] << 24) >> 24;
                return new Int32(byte);
            }
            return new Int32(0);
        },
    });

    /** Returns the signed long (four bytes) starting at the specified zero-based long index. */
    private readonly getSignedLong = new Callable("getSignedLong", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Int32 | ValueKind.Float)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, index: Int32 | Float) => {
            const idx = Math.trunc(index.getValue()) * 4; // Multiply index by 4
            if (idx < this.elements.length - 3) {
                const dataView = new DataView(this.elements.buffer, idx, 4);
                const long = dataView.getInt32(0, this.isLittleEndian());
                return new Int32(long);
            }
            return new Int32(0);
        },
    });

    /** Calculates a CRC-32 of the contents (or a subset) of the Byte Array. */
    private readonly getCRC32 = new Callable("getCRC32", {
        signature: {
            args: [
                new StdlibArgument("index", ValueKind.Int32 | ValueKind.Float, new Int32(0)),
                new StdlibArgument("length", ValueKind.Int32 | ValueKind.Float, new Int32(-1)),
            ],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, index: Int32 | Float, length: Int32 | Float) => {
            const idx = Math.trunc(index.getValue());
            const len = Math.trunc(length.getValue());
            if (idx > 0 || len > 0) {
                const end = len < 1 ? undefined : idx + len;
                return new Int32(crc32(Buffer.from(this.elements.slice(idx, end))));
            }
            return new Int32(crc32(Buffer.from(this.elements)));
        },
    });

    /** If the size of the Byte Array is less than min_size, expands the Byte Array to min_size. */
    private readonly setResize = new Callable("setResize", {
        signature: {
            args: [
                new StdlibArgument("minSize", ValueKind.Int32 | ValueKind.Float),
                new StdlibArgument("autoResize", ValueKind.Boolean),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, minSize: Int32 | Float, autoResize: BrsBoolean) => {
            this.maxSize = Math.max(Math.trunc(minSize.getValue()), this.elements.length);
            this.resizable = autoResize.toBoolean();
            return BrsInvalid.Instance;
        },
    });

    /** Returns true if the CPU architecture is little-endian. */
    private readonly isLittleEndianCPU = new Callable("isLittleEndianCPU", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.isLittleEndian());
        },
    });

    // ifArray -------------------------------------------------------------------------

    /** Returns the last array entry without removing it. If the array is empty, returns invalid. */
    private readonly peek = new Callable("peek", {
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
    private readonly pop = new Callable("pop", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            if (this.elements.length === 0) {
                return BrsInvalid.Instance;
            }
            const index = this.elements.length - 1;
            const item = this.elements[index];
            let array = new Uint8Array(index);
            array.set(this.elements.slice(0, index), 0);
            this.elements = array;
            return item ? new Int32(item) : BrsInvalid.Instance;
        },
    });

    /** Adds the specified value to the end of the array. */
    private readonly push = new Callable("push", {
        signature: {
            args: [new StdlibArgument("byte", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, byte: Int32 | Float | BrsInvalid) => {
            if (isBrsNumber(byte)) {
                if (this.resizable || this.elements.length < this.maxSize) {
                    let array = new Uint8Array(this.elements.length + 1);
                    array.set(this.elements, 0);
                    array[this.elements.length] = byte.getValue();
                    this.elements = array;
                    this.updateNext();
                    this.updateCapacity(1.5);
                } else {
                    BrsDevice.stderr.write(
                        `warning,BRIGHTSCRIPT: ERROR: roByteArray.Push: set ignored for index out of bounds on non-resizable array: ${interpreter.formatLocation()}`
                    );
                }
            } else {
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roByteArray.Push: set ignored for non-numeric value: ${interpreter.formatLocation()}`
                );
            }
            return BrsInvalid.Instance;
        },
    });

    /** Removes the first entry (zero index) from the beginning of the array and shifts the other entries up. */
    private readonly shift = new Callable("shift", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            if (this.elements.length === 0) {
                return BrsInvalid.Instance;
            }
            const item = this.elements[0];
            let array = new Uint8Array(this.elements.length - 1);
            array.set(this.elements.slice(1));
            this.elements = array;
            return item ? new Int32(item) : BrsInvalid.Instance;
        },
    });

    /** Adds the specified value to the beginning of the array (at the zero index) and shifts the other entries down. */
    private readonly unshift = new Callable("unshift", {
        signature: {
            args: [new StdlibArgument("byte", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, byte: Int32 | Float | BrsInvalid) => {
            if (isBrsNumber(byte)) {
                if (this.resizable || this.elements.length < this.maxSize) {
                    let array = new Uint8Array(this.elements.length + 1);
                    array[0] = byte.getValue();
                    array.set(this.elements, 1);
                    this.elements = array;
                    this.updateNext();
                    this.updateCapacity(1.25);
                } else {
                    BrsDevice.stderr.write(
                        `warning,BRIGHTSCRIPT: ERROR: roByteArray.Unshift: unshift ignored for full non-resizable array: ${interpreter.formatLocation()}`
                    );
                }
            } else {
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roByteArray.Unshift: unshift ignored for non-numeric value: ${interpreter.formatLocation()}`
                );
            }
            return BrsInvalid.Instance;
        },
    });

    /** Deletes the indicated array entry, and shifts all entries up. This decreases the array length by one. */
    private readonly delete = new Callable("delete", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Int32 | ValueKind.Float)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, index: Int32 | Float) => {
            const idx = Math.trunc(index.getValue());
            if (idx < 0 || idx >= this.elements.length) {
                return BrsBoolean.False;
            }
            let array = new Uint8Array(this.elements.length - 1);
            array.set(this.elements.slice(0, idx), 0);
            array.set(this.elements.slice(idx + 1), idx);
            this.elements = array;
            return BrsBoolean.True;
        },
    });

    /** Returns the length of the array, which is one more than the index of highest entry. */
    private readonly count = new Callable("count", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.elements.length);
        },
    });

    /** Deletes all the entries in the array. */
    private readonly clear = new Callable("clear", {
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
    private readonly append = new Callable("append", {
        signature: {
            args: [new StdlibArgument("array", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, array: BrsComponent) => {
            if (!(array instanceof RoByteArray)) {
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roByteArray.Append: invalid parameter type ${array.getComponentName()}: ${interpreter.formatLocation()}`
                );
                return BrsInvalid.Instance;
            }
            if (this.resizable || this.elements.length + array.elements.length <= this.maxSize) {
                this.elements = new Uint8Array([...this.elements, ...array.elements]);
                this.updateNext();
                this.updateCapacity();
            }
            return BrsInvalid.Instance;
        },
    });

    // ifArrayGet -------------------------------------------------------------------------

    /** Returns an array entry based on the provided index. */
    private readonly getEntry = new Callable("getEntry", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Int32 | ValueKind.Float)],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter, index: Int32 | Float) => {
            return this.getElements()[Math.trunc(index.getValue())] || BrsInvalid.Instance;
        },
    });

    // ifArraySet  -------------------------------------------------------------------------

    /** Sets an entry at a given index to the passed value. If index is beyond the bounds of the array, the array is expanded. */
    private readonly setEntry = new Callable("setEntry", {
        signature: {
            args: [
                new StdlibArgument("index", ValueKind.Int32 | ValueKind.Float),
                new StdlibArgument("value", ValueKind.Dynamic),
            ],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, index: Int32 | Float, value: BrsType) => {
            if (!isBrsNumber(value)) {
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roByteArray.SetEntry: set ignored for non-numeric value: ${interpreter.formatLocation()}`
                );
            }
            return this.set(index, value);
        },
    });

    // ifArraySizeInfo ---------------------------------------------------------------------

    /** Returns the maximum number of entries that can be stored in the array. */
    private readonly capacity = new Callable("capacity", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.maxSize);
        },
    });

    /** Returns true if the array can be resized. */
    private readonly isResizable = new Callable("isResizable", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.resizable);
        },
    });
}
