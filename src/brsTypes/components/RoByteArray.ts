import { BrsValue, ValueKind, BrsBoolean, BrsInvalid, BrsString } from "../BrsType";
import { BrsType } from "..";
import { BrsComponent, BrsIterable } from "./BrsComponent";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import * as util from "util";

export class RoByteArray extends BrsComponent implements BrsValue, BrsIterable {
    readonly kind = ValueKind.Object;
    private elements: Uint8Array;
    private resize = true;

    constructor();
    constructor(elementsParam: Uint8Array);
    constructor(elementsParam?: Uint8Array) {
        super("roByteArray");
        this.elements = elementsParam ? elementsParam : new Uint8Array();
        this.registerMethods([
            this.readFile,
            // this.writeFile,
            // this.appendFile,
            this.setResize,
            // this.fromHexString,
            // this.toHexString,
            // this.fromBase64String,
            // this.toBase64String,
            this.fromAsciiString,
            this.toAsciiString,
            // this.getSignedByte,
            // this.getSignedLong,
            // this.getCRC32,
            this.isLittleEndianCPU,
            this.peek,
            this.pop,
            this.push,
            this.shift,
            this.unshift,
            this.delete,
            this.count,
            this.clear,
            this.append,
        ]);
    }

    toString(parent?: BrsType): string {
        if (parent) {
            return "<Component: roByteArray>";
        }

        return [
            "<Component: roArray> =",
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
            case ValueKind.Int32:
                return this.getElements()[index.getValue()] || BrsInvalid.Instance;
            case ValueKind.String:
                return this.getMethod(index.value) || BrsInvalid.Instance;
            default:
                throw new Error(
                    "Array indexes must be 32-bit integers, or method names must be strings"
                );
        }
    }

    set(index: BrsType, value: BrsType) {
        if (index.kind !== ValueKind.Int32) {
            throw new Error("Array indexes must be 32-bit integers");
        } else if (value.kind !== ValueKind.Int32) {
            throw new Error("Byte array values must be 32-bit integers");
        }
        this.elements[index.getValue()] = value.getValue();
        return BrsInvalid.Instance;
    }

    // ifByteArray ---------------------------------------------------------------------

    private readFile = new Callable("readFile", {
        signature: {
            args: [new StdlibArgument("path", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, filepath: BrsString) => {
            try {
                const url = new URL(filepath.value);
                const volume = interpreter.fileSystem.get(url.protocol);
                if (volume) {
                    this.elements = volume.readFileSync(url.pathname) as Uint8Array;
                    return BrsBoolean.True;
                }
            } catch (err) {
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
        impl: (interpreter: Interpreter, asciiStr: BrsString) => {
            let encoder = new util.TextEncoder();
            this.elements = encoder.encode(asciiStr.value);
            return BrsInvalid.Instance;
        },
    });

    private toAsciiString = new Callable("toAsciiString", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            let decoder = new util.TextDecoder();
            return new BrsString(decoder.decode(this.elements));
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
        impl: (interpreter: Interpreter, minSize: Int32, autoResize: BrsBoolean) => {
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
        impl: (interpreter: Interpreter) => {
            return BrsBoolean.True;
        },
    });

    // ifArray -------------------------------------------------------------------------

    private peek = new Callable("peek", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter) => {
            return new Int32(this.elements[this.elements.length - 1]) || BrsInvalid.Instance;
        },
    });

    private pop = new Callable("pop", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter) => {
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
        impl: (interpreter: Interpreter, tvalue: BrsType) => {
            // TODO: Add item to the end of byte array (check how to behave with resize=true)
            return BrsInvalid.Instance;
        },
    });

    private shift = new Callable("shift", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter) => {
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
        impl: (interpreter: Interpreter, tvalue: BrsType) => {
            // TODO: Add index zero item on byte array (check how to behave with resize=true)
            return BrsInvalid.Instance;
        },
    });

    private delete = new Callable("delete", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, index: Int32) => {
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
        impl: (interpreter: Interpreter) => {
            return new Int32(this.elements.length);
        },
    });

    private clear = new Callable("clear", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter) => {
            this.elements = new Uint8Array();
            return BrsInvalid.Instance;
        },
    });

    private append = new Callable("append", {
        signature: {
            args: [new StdlibArgument("array", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, array: BrsComponent) => {
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
}
