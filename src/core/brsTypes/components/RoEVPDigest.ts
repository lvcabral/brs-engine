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
import * as crypto from "crypto";

export class RoEVPDigest extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;

    private hash: crypto.Hash | null;
    private algorithmName: string;

    constructor() {
        super("roEVPDigest");
        this.hash = null;
        this.algorithmName = "";
        this.registerMethods({
            ifEVPDigest: [this.setup, this.update, this.reinit, this.process, this.final],
        });
    }

    toString(parent?: BrsType | undefined): string {
        return "<Component: roEVPDigest>";
    }

    equalTo(other: BrsType): BrsBoolean {
        return BrsBoolean.False;
    }

    setupHash(algorithm: string) {
        try {
            this.hash = crypto.createHash(algorithm);
            return 0;
        } catch (e) {
            this.hash = null;
            this.algorithmName = "";
            return -1;
        }
    }

    updateData(data: Uint8Array) {
        if (this.hash) {
            try {
                this.hash.update(Buffer.from(data));
                return true;
            } catch (e) {
                return false;
            }
        }
        return false;
    }

    finalResult() {
        if (this.hash) {
            try {
                let digest = this.hash.digest("hex");
                this.hash = null;
                return digest;
            } catch (e) {
                return "";
            }
        }
        return "";
    }

    /** Initializes a new message digest context. */
    private readonly setup = new Callable("setup", {
        signature: {
            args: [new StdlibArgument("algorithm", ValueKind.String)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, algorithm: BrsString) => {
            this.algorithmName = algorithm.value;
            return new Int32(this.setupHash(algorithm.value));
        },
    });

    /** Re-initializes an existing message digest context, to reuse it to digest new data. */
    private readonly reinit = new Callable("reinit", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            if (this.algorithmName !== "") {
                return new Int32(this.setupHash(this.algorithmName));
            }
            return new Int32(-1);
        },
    });

    /** Digests the provided data. */
    private readonly process = new Callable("process", {
        signature: {
            args: [new StdlibArgument("data", ValueKind.Object)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, data: RoByteArray) => {
            if (this.algorithmName !== "" && this.setupHash(this.algorithmName) === 0) {
                if (this.updateData(data.getByteArray())) {
                    return new BrsString(this.finalResult());
                }
            }
            return new BrsString("");
        },
    });

    /** Adds more data to be digested. */
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

    /** Returns the digest of data passed in by previous calls to Update() as a hex string. */
    private readonly final = new Callable("final", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.finalResult());
        },
    });
}
