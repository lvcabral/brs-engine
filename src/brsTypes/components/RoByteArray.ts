import { BrsType, Int32 } from "..";
import { BrsValue, ValueKind, BrsBoolean, BrsInvalid, BrsString } from "../BrsType";
import { BrsComponent, BrsIterable } from "./BrsComponent";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { crc32 } from "crc";

export class RoByteArray extends BrsComponent implements BrsValue, BrsIterable {
    readonly kind = ValueKind.Object;
    private elements: Uint8Array;
    private resize = true;
    enumIndex: number;

    constructor();
    constructor(elementsParam: Uint8Array);
    constructor(elementsParam?: Uint8Array) {
        super("roByteArray");
        this.elements = elementsParam ? elementsParam : new Uint8Array();
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
        ].join("\n");
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    getValue() {
        return this.elements;
    }

    getElements() {
        const result: BrsType[] = [];
        this.elements.slice().forEach((value: number) => {
            result.push(new Int32(value));
        });
        return result;
    }

    get(index: BrsType) {
        switch (index.kind) {
            case ValueKind.Float:
                return this.getElements()[Math.trunc(index.getValue())] || BrsInvalid.Instance;
            case ValueKind.Int32:
                return this.getElements()[index.getValue()] || BrsInvalid.Instance;
            case ValueKind.String:
                return this.getMethod(index.value) || BrsInvalid.Instance;
            default:
                postMessage(
                    "warning,Array indexes must be 32-bit integers, or method names must be strings"
                );
                return BrsInvalid.Instance;
        }
    }

    set(index: BrsType, value: BrsType) {
        if (index.kind !== ValueKind.Int32 && index.kind !== ValueKind.Float) {
            postMessage("warning,Array indexes must be 32-bit integers.");
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

    // ifByteArray ---------------------------------------------------------------------

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
                        this.elements = array.slice(start, end);
                    } else {
                        this.elements = array;
                    }
                    this.updateNext();
                    return BrsBoolean.True;
                }
            } catch (err: any) {
                return BrsBoolean.False;
            }
            return BrsBoolean.False;
        },
    });

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

    private fromAsciiString = new Callable("fromAsciiString", {
        signature: {
            args: [new StdlibArgument("asciiStr", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, asciiStr: BrsString) => {
            this.elements = new Uint8Array(Buffer.from(asciiStr.value, "utf8"));
            this.updateNext();
            return BrsInvalid.Instance;
        },
    });

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
            const regex = new RegExp("[^a-f0-9]", "gi");
            const value = hexStr.value.replace(regex, "0");
            if (value.length % 2 === 0) {
                this.elements = new Uint8Array(Buffer.from(value, "hex"));
            }
            this.updateNext();
            return BrsInvalid.Instance;
        },
    });

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

    private fromBase64String = new Callable("fromBase64String", {
        signature: {
            args: [new StdlibArgument("hexStr", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, hexStr: BrsString) => {
            this.elements = new Uint8Array(Buffer.from(hexStr.value, "base64"));
            this.updateNext();
            return BrsInvalid.Instance;
        },
    });

    private toBase64String = new Callable("toBase64String", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(Buffer.from(this.elements).toString("base64"));
        },
    });

    private getSignedByte = new Callable("getSignedByte", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, index: Int32) => {
            let byte = (this.elements[index.getValue()] << 24) >> 24;
            return new Int32(byte);
        },
    });

    private getSignedLong = new Callable("getSignedLong", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, index: Int32) => {
            const dataView = new DataView(this.elements.buffer, index.getValue(), 4);
            const long = dataView.getInt32(0, true);
            return new Int32(long);
        },
    });

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

    private setResize = new Callable("setResize", {
        signature: {
            args: [
                new StdlibArgument("minSize", ValueKind.Int32),
                new StdlibArgument("autoResize", ValueKind.Boolean),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, minSize: Int32, autoResize: BrsBoolean) => {
            this.resize = autoResize.toBoolean();
            // TODO: Resize byte array if length < minSize
            return BrsInvalid.Instance;
        },
    });

    private isLittleEndianCPU = new Callable("isLittleEndianCPU", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.True;
        },
    });

    // ifArray -------------------------------------------------------------------------

    private peek = new Callable("peek", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.elements[this.elements.length - 1]) || BrsInvalid.Instance;
        },
    });

    private pop = new Callable("pop", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            const pop = new Int32(this.elements[this.elements.length - 1]) || BrsInvalid.Instance;
            // TODO: Remove last item from byte array (check how to behave with resize=true)
            return pop;
        },
    });

    private push = new Callable("push", {
        signature: {
            args: [new StdlibArgument("byte", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, byte: Int32) => {
            let array = new Uint8Array(this.elements.length + 1);
            array.set(this.elements, 0);
            array[this.elements.length] = byte.getValue();
            this.elements = array;
            this.updateNext();
            return BrsInvalid.Instance;
        },
    });

    private shift = new Callable("shift", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            const shift = new Int32(this.elements[0]) || BrsInvalid.Instance;
            // TODO: Remove first item from byte array (check how to behave with resize=true)
            return shift;
        },
    });

    private unshift = new Callable("unshift", {
        signature: {
            args: [new StdlibArgument("tvalue", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, byte: Int32) => {
            let array = new Uint8Array(this.elements.length + 1);
            array[0] = byte.getValue();
            array.set(this.elements, 1);
            this.elements = array;
            this.updateNext();
            return BrsInvalid.Instance;
        },
    });

    private delete = new Callable("delete", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, index: Int32) => {
            if (index.lessThan(new Int32(0)).toBoolean()) {
                return BrsBoolean.False;
            }
            // TODO: Remove specific item from byte array (check how to behave with resize=true)
            return BrsBoolean.True;
        },
    });

    private count = new Callable("count", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.elements.length);
        },
    });

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

            // TODO: Append other byte array to the end of this byte array (check how to behave with resize=true)

            // this.elements = [
            //     ...this.elements,
            //     ...array.elements.filter(element => !!element), // don't copy "holes" where no value exists
            // ];

            return BrsInvalid.Instance;
        },
    });

    // ifArrayGet -------------------------------------------------------------------------

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

    private setEntry = new Callable("setEntry", {
        signature: {
            args: [
                new StdlibArgument("index", ValueKind.Dynamic),
                new StdlibArgument("tvalue", ValueKind.Dynamic),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, index: BrsType, tvalue: BrsType) => {
            return this.set(index, tvalue);
        },
    });

    // ifEnum -------------------------------------------------------------------------

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

    /** Increments the position of an enumeration. If the last element of the enumeration is returned,
     * this method sets the current position to indicate that it is now past the end. */
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
