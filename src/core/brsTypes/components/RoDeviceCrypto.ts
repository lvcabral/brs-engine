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
    BrsInvalid,
} from "..";
import { BrsComponent } from "./BrsComponent";
import { Interpreter } from "../../interpreter";
import { BrsDevice } from "../../device/BrsDevice";

export class RoDeviceCrypto extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;

    private readonly algorithm = "aes-256-ctr";
    private readonly keys: Map<string, Buffer>;

    constructor() {
        super("roDeviceCrypto");

        /**
         *  There is no way to know the actual implementation details of this component
         *  in a Roku device, so we are generating keys based on the observed behavior.
         *  As we store the IV together with the returned byte array, do not rely on this
         *  component for any security purposes in production. This component is only
         *  intended to be used for simulation, behaving as close as possible to
         *  the real device.
         */
        this.keys = new Map();
        let deviceId = BrsDevice.deviceInfo.clientId.replaceAll("-", "");
        this.keys.set("device", this.format256BitKey(deviceId));
        let devId = BrsDevice.deviceInfo.developerId;
        this.keys.set("channel", this.format256BitKey(devId));
        let model = BrsDevice.deviceInfo.deviceModel;
        this.keys.set("model", this.format256BitKey(`${model}${devId}`));

        this.registerMethods({ ifDeviceCrypto: [this.encrypt, this.decrypt] });
    }

    toString(parent?: BrsType | undefined): string {
        return "<Component: roDeviceCrypto>";
    }

    equalTo(other: BrsType): BrsBoolean {
        return BrsBoolean.False;
    }

    format256BitKey(key: string): Buffer {
        if (key.length < 32) {
            key = key.padEnd(32, String.fromCharCode(13));
        } else if (key.length > 32) {
            key = key.slice(0, 32);
        }
        return Buffer.from(key);
    }

    /** Encrypts data on a device that is unique per device, channel, or model. */
    private readonly encrypt = new Callable("encrypt", {
        signature: {
            args: [new StdlibArgument("input", ValueKind.Object), new StdlibArgument("type", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, input: RoByteArray, type: BrsString) => {
            try {
                const key = this.keys.get(type.value.toLowerCase());
                if (!key) {
                    BrsDevice.stderr.write(
                        `warning,BRIGHTSCRIPT: ERROR: roDeviceCrypto.Encrypt: invalid encryption type ${
                            type.value
                        }: ${interpreter.formatLocation()}`
                    );
                    return BrsInvalid.Instance;
                }
                const iv = crypto.randomBytes(16);
                const salt = crypto.randomBytes(16);
                const cipher = crypto.createCipheriv(this.algorithm, key, iv);
                const updateData = cipher.update(Buffer.from([...input.getByteArray(), ...salt]));
                const finalResult = cipher.final();
                return new RoByteArray(new Uint8Array([...updateData, ...finalResult, ...iv]));
            } catch (err: any) {
                return BrsInvalid.Instance;
            }
        },
    });

    /** Decrypts data stored on a device that was previously encoded with the Encrypt() method. */
    private readonly decrypt = new Callable("decrypt", {
        signature: {
            args: [new StdlibArgument("encryptedData", ValueKind.Object), new StdlibArgument("type", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter, encryptedData: RoByteArray, type: BrsString) => {
            const key = this.keys.get(type.value.toLowerCase());
            if (!key) {
                BrsDevice.stdout.write(
                    `warning;BRIGHTSCRIPT: ERROR: roDeviceCrypto.Decrypt: invalid encryption type ${
                        type.value
                    }: ${interpreter.formatLocation()}`
                );
                return BrsInvalid.Instance;
            }
            try {
                const iv = encryptedData.getByteArray().slice(-16);
                const data = encryptedData.getByteArray().slice(0, -16);
                const decipher = crypto.createDecipheriv(this.algorithm, key, Buffer.from(iv));
                const updateData = decipher.update(Buffer.from(data));
                const finalResult = decipher.final();
                return new RoByteArray(new Uint8Array([...updateData, ...finalResult].slice(0, -16)));
            } catch (err: any) {
                return BrsInvalid.Instance;
            }
        },
    });
}
