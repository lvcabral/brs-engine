import { BrsValue, ValueKind, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, BrsString, RoByteArray } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";

/**
 * Mock implementation of the roDSA component (ECDSA/EdDSA signing).
 * The engine does not provide real signing, so the methods report failure so
 * callers that branch on the return value handle it without crashing.
 */
export class RoDSA extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;

    constructor() {
        super("roDSA");
        this.registerMethods({
            ifDsa: [
                this.setPrivateKey,
                this.setPrivateKeyFromByteArray,
                this.setPublicKey,
                this.setDigestAlgorithm,
                this.setSignAlgorithm,
                this.sign,
                this.verify,
            ],
        });
    }

    toString(_parent?: BrsType): string {
        return "<Component: roDSA>";
    }

    equalTo(_other: BrsType): BrsBoolean {
        return BrsBoolean.False;
    }

    // ifDsa ----------------------------------------------------------------------------

    /** Sets the private key for signing (mock: reports invalid key). */
    private readonly setPrivateKey = new Callable("setPrivateKey", {
        signature: {
            args: [new StdlibArgument("keyFileName", ValueKind.String)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, _keyFileName: BrsString) => {
            return new Int32(0);
        },
    });

    /** Sets the private key from a byte array (mock: reports invalid key). */
    private readonly setPrivateKeyFromByteArray = new Callable("setPrivateKeyFromByteArray", {
        signature: {
            args: [new StdlibArgument("key", ValueKind.Object)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, _key: RoByteArray) => {
            return new Int32(0);
        },
    });

    /** Sets the public key for verification (mock: reports invalid key). */
    private readonly setPublicKey = new Callable("setPublicKey", {
        signature: {
            args: [new StdlibArgument("keyFileName", ValueKind.String)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, _keyFileName: BrsString) => {
            return new Int32(0);
        },
    });

    /** Sets the digest algorithm (mock: accepts any value). */
    private readonly setDigestAlgorithm = new Callable("setDigestAlgorithm", {
        signature: {
            args: [new StdlibArgument("algorithm", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, _algorithm: BrsString) => {
            return BrsBoolean.True;
        },
    });

    /** Sets the signing algorithm (mock: accepts any value). */
    private readonly setSignAlgorithm = new Callable("setSignAlgorithm", {
        signature: {
            args: [new StdlibArgument("algorithm", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, _algorithm: BrsString) => {
            return BrsBoolean.True;
        },
    });

    /** Generates a signature (mock: always fails, returns invalid). */
    private readonly sign = new Callable("sign", {
        signature: {
            args: [new StdlibArgument("message", ValueKind.Object)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, _message: RoByteArray) => {
            return BrsInvalid.Instance;
        },
    });

    /** Verifies a message and signature (mock: reports no match). */
    private readonly verify = new Callable("verify", {
        signature: {
            args: [new StdlibArgument("message", ValueKind.Object), new StdlibArgument("signature", ValueKind.Object)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, _message: RoByteArray, _signature: RoByteArray) => {
            return new Int32(0);
        },
    });
}
