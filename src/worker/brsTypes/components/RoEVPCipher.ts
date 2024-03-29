import * as crypto from "crypto";
import {
    Callable,
    ValueKind,
    BrsString,
    StdlibArgument,
    BrsBoolean,
    BrsType,
    BrsComponent,
    BrsValue,
    RoByteArray,
    Int32,
    BrsInvalid,
} from "..";
import { Interpreter } from "../../interpreter";

export class RoEVPCipher extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;

    private cipher: crypto.Cipher | null;
    private cipherEncrypt: boolean;
    private cipherFormat: string;
    private cipherKey: string;
    private cipherIV: string;
    private cipherPadding: boolean;

    constructor() {
        super("roEVPCipher");
        this.cipher = null;
        this.cipherEncrypt = false;
        this.cipherFormat = "";
        this.cipherKey = "";
        this.cipherIV = "";
        this.cipherPadding = false;
        this.registerMethods({
            ifEVPCipher: [this.setup, this.update, this.reinit, this.process, this.final],
        });
    }

    toString(parent?: BrsType | undefined): string {
        return "<Component: roEVPCipher>";
    }

    equalTo(other: BrsType): BrsBoolean {
        return BrsBoolean.False;
    }

    setupCipher(encrypt: boolean, format: string, key: string, iv: string, padding: boolean) {
        try {
            this.cipherEncrypt = encrypt;
            this.cipherFormat = format;
            this.cipherKey = key;
            this.cipherIV = iv;
            this.cipherPadding = padding;

            if (encrypt) {
                this.cipher = crypto.createCipheriv(
                    format,
                    Buffer.from(key, "hex"),
                    Buffer.from(iv, "hex")
                );
            } else {
                this.cipher = crypto.createDecipheriv(
                    format,
                    Buffer.from(key, "hex"),
                    Buffer.from(iv, "hex")
                );
            }
            if (this.cipher) {
                this.cipher.setAutoPadding(padding);
            }
            return 0;
        } catch (e: any) {
            postMessage(`error,[roEVPCipher] Setup error: ${e.message}`);
            this.cipher = null;
            this.cipherFormat = "";
            this.cipherKey = "";
            this.cipherIV = "";
            return -1;
        }
    }

    updateData(data: Uint8Array) {
        if (this.cipher) {
            try {
                return this.cipher.update(Buffer.from(data));
            } catch (e) {
                return Buffer.from("");
            }
        }
        return Buffer.from("");
    }

    finalResult() {
        if (this.cipher) {
            let encrypted = this.cipher.final();
            this.cipher = null;
            return encrypted;
        }
        return Buffer.from("");
    }

    /** Configures and initializes a new cipher context. */
    private setup = new Callable("setup", {
        signature: {
            args: [
                new StdlibArgument("encrypt", ValueKind.Boolean),
                new StdlibArgument("format", ValueKind.String),
                new StdlibArgument("key", ValueKind.String),
                new StdlibArgument("iv", ValueKind.String),
                new StdlibArgument("padding", ValueKind.Int32),
            ],
            returns: ValueKind.Int32,
        },
        impl: (
            _: Interpreter,
            encrypt: BrsBoolean,
            format: BrsString,
            key: BrsString,
            iv: BrsString,
            padding: Int32
        ) => {
            return new Int32(
                this.setupCipher(
                    encrypt.toBoolean(),
                    format.value,
                    key.value,
                    iv.value,
                    padding.getValue() === 1
                )
            );
        },
    });

    /** Re-initializes an existing cipher context, to reuse it to encrypt new data. */
    private reinit = new Callable("reinit", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            if (this.cipherFormat !== "" && this.cipherKey !== "" && this.cipherIV !== "") {
                return new Int32(
                    this.setupCipher(
                        this.cipherEncrypt,
                        this.cipherFormat,
                        this.cipherKey,
                        this.cipherIV,
                        this.cipherPadding
                    )
                );
            }
            return new Int32(-1);
        },
    });

    /** Processes the included roByteArray containing encrypted/decrypted data. */
    private process = new Callable("process", {
        signature: {
            args: [new StdlibArgument("data", ValueKind.Object)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, data: RoByteArray) => {
            if (
                this.cipherFormat !== "" &&
                this.cipherKey !== "" &&
                this.cipherIV !== "" &&
                this.setupCipher(
                    this.cipherEncrypt,
                    this.cipherFormat,
                    this.cipherKey,
                    this.cipherIV,
                    this.cipherPadding
                ) === 0
            ) {
                let result = this.updateData(data.getByteArray());
                let finalResult = this.finalResult();
                return new RoByteArray(new Uint8Array([...result, ...finalResult]));
            }
            return BrsInvalid.Instance;
        },
    });

    /** Updates the included roByteArray containing encrypted/decrypted data. */
    private update = new Callable("update", {
        signature: {
            args: [new StdlibArgument("data", ValueKind.Object)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, data: RoByteArray) => {
            return new RoByteArray(this.updateData(data.getByteArray()));
        },
    });

    /** Signals that all data has been submitted by previous calls to Update(). */
    private final = new Callable("final", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return new RoByteArray(this.finalResult());
        },
    });
}
