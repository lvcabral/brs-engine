import * as crypto from "crypto";
import {
    Callable,
    ValueKind,
    BrsString,
    StdlibArgument,
    BrsBoolean,
    BrsType,
    BrsValue,
    RoByteArray,
    Int32,
    BrsInvalid,
} from "..";
import { BrsComponent } from "./BrsComponent";
import { Interpreter } from "../../interpreter";

export class RoHMAC extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;

    private hmac: crypto.Hmac | null;
    private hmacAlgorithm: string;
    private hmacKey: Buffer;

    constructor() {
        super("roHMAC");
        this.hmac = null;
        this.hmacAlgorithm = "";
        this.hmacKey = Buffer.from("");
        this.registerMethods({
            ifHMAC: [this.setup, this.update, this.reinit, this.process, this.final],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roHMAC>";
    }

    equalTo(other: BrsType): BrsBoolean {
        return BrsBoolean.False;
    }

    setupHMAC(algorithm: string, key: Buffer) {
        try {
            this.hmac = crypto.createHmac(algorithm, key);
            this.hmacAlgorithm = algorithm;
            this.hmacKey = key;
            return 0;
        } catch (e) {
            this.hmac = null;
            this.hmacAlgorithm = "";
            this.hmacKey = Buffer.from("");
            return -1;
        }
    }

    updateData(data: Uint8Array) {
        if (this.hmac) {
            try {
                this.hmac.update(Buffer.from(data));
                return true;
            } catch (e) {
                return false;
            }
        }
        return false;
    }

    finalResult() {
        if (this.hmac) {
            try {
                let digest = this.hmac.digest();
                this.hmac = null;
                return digest;
            } catch (e) {
                return Buffer.from("");
            }
        }
        return Buffer.from("");
    }

    /** Initializes new HMAC context. */
    private readonly setup = new Callable("setup", {
        signature: {
            args: [new StdlibArgument("digestType", ValueKind.String), new StdlibArgument("key", ValueKind.Object)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, digestType: BrsString, key: RoByteArray) => {
            return new Int32(this.setupHMAC(digestType.value, Buffer.from(key.getByteArray())));
        },
    });

    /** Adds more data to be digested. The data in the array is added to the current digest. */
    private readonly update = new Callable("update", {
        signature: {
            args: [new StdlibArgument("data", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, data: RoByteArray) => {
            this.updateData(data.getByteArray());
            return BrsInvalid.Instance;
        },
    });

    /** Re-initializes an existing HMAC context to reuse it to authenticate new data. */
    private readonly reinit = new Callable("reinit", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            if (this.hmacAlgorithm !== "") {
                return new Int32(this.setupHMAC(this.hmacAlgorithm, this.hmacKey));
            }
            return new Int32(-1);
        },
    });

    /** Digests the data in an array generates a MAC. */
    private readonly process = new Callable("process", {
        signature: {
            args: [new StdlibArgument("data", ValueKind.Object)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, data: RoByteArray) => {
            if (this.hmacAlgorithm !== "" && this.setupHMAC(this.hmacAlgorithm, this.hmacKey) === 0) {
                if (this.updateData(data.getByteArray())) {
                    return new RoByteArray(this.finalResult());
                }
            }
            return new RoByteArray(Buffer.from(""));
        },
    });

    /** Returns an roByteArray containing the final MAC. */
    private readonly final = new Callable("final", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return new RoByteArray(this.finalResult());
        },
    });
}
