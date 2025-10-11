import { Callable, ValueKind, BrsString, StdlibArgument, BrsBoolean, BrsType, BrsComponent, BrsValue, Int32 } from "..";
import { BrsDevice } from "../../device/BrsDevice";
import { Interpreter } from "../../interpreter";
import { isValidHostname, isValidIP, resolveHostToIP } from "../../interpreter/Network";

export class RoSocketAddress extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private hostName: string;
    private hostIP: string;
    private port: number;
    private valid: boolean;

    constructor() {
        super("roSocketAddress");
        this.hostName = "0.0.0.0";
        this.hostIP = "0.0.0.0";
        this.port = 0;
        this.valid = true;
        this.registerMethods({
            ifSocketAddress: [
                this.setAddress,
                this.getAddress,
                this.setHostName,
                this.getHostName,
                this.setPort,
                this.getPort,
                this.isAddressValid,
            ],
        });
    }

    validateAddress(address: string): boolean {
        // regex pattern for a valid quad address with port
        const quadAddressPattern = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::(\d{1,5}))?$/;
        let match = quadAddressPattern.exec(address);
        if (match) {
            this.hostName = match[1];
            this.hostIP = match[1];
            this.port = match[2] ? this.safeParsePort(match[2]) : this.port;
            return isValidIP(this.hostName);
        }
        const splitAddress = address.split(":");
        if (splitAddress.length > 1) {
            this.hostName = splitAddress[0];
            this.port = this.safeParsePort(splitAddress[1]);
        } else {
            this.hostName = address;
        }
        if (this.hostName.trim() === "") {
            return false;
        }
        // If the address does not match the pattern, try to resolve it as a hostname
        try {
            const ip = resolveHostToIP(this.hostName);
            if (ip && isValidIP(ip)) {
                this.hostIP = ip;
                return true;
            }
        } catch (err: any) {
            if (BrsDevice.isDevMode) {
                BrsDevice.stderr.write(`warning,${err.message}`);
            }
        }
        return false;
    }

    safeParsePort(str: string): number {
        const num = Number.parseInt(str, 10);
        let port = Number.isNaN(num) ? 0 : num;
        return toUint16(port);
    }

    toString(parent?: BrsType): string {
        return "<Component: roSocketAddress>";
    }

    equalTo(other: BrsType): BrsBoolean {
        return BrsBoolean.False;
    }

    /** Sets the IPV4 address. */
    private readonly setAddress = new Callable("setAddress", {
        signature: {
            args: [new StdlibArgument("address", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, address: BrsString) => {
            this.valid = this.validateAddress(address.value);
            return BrsBoolean.True;
        },
    });

    /** Returns the IPV4 address in dotted quad format (for example, "192.168.1.120:8888"). */
    private readonly getAddress = new Callable("getAddress", {
        signature: { args: [], returns: ValueKind.String },
        impl: (interpreter: Interpreter) => {
            if (!this.valid) {
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roSocketAddress.getAddress: Domain name not found: ${
                        this.hostName
                    }: ${interpreter.formatLocation()}`
                );
            }
            return new BrsString(this.valid ? `${this.hostIP}:${this.port}` : "");
        },
    });

    /** Sets the hostname. The port number is unchanged. */
    private readonly setHostName = new Callable("setHostName", {
        signature: {
            args: [new StdlibArgument("hostname", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, hostname: BrsString) => {
            if (isValidHostname(hostname.value)) {
                const newAddress = `${hostname.value}:${this.port}`;
                this.valid = this.validateAddress(newAddress);
            } else {
                this.hostName = hostname.value;
                this.valid = false;
            }
            return BrsBoolean.True;
        },
    });

    /** Returns the hostname. */
    private readonly getHostName = new Callable("getHostName", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.hostName);
        },
    });

    /** Sets the port number. The hostname is unchanged. */
    private readonly setPort = new Callable("setPort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, port: Int32) => {
            this.port = toUint16(port.getValue());
            return BrsBoolean.True;
        },
    });

    /** Returns the port. */
    private readonly getPort = new Callable("getPort", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.port);
        },
    });

    /** Checks whether the component contains a valid IP address. */
    private readonly isAddressValid = new Callable("isAddressValid", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter) => {
            if (!this.valid) {
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roSocketAddress.isAddressValid: Domain name not found: ${
                        this.hostName
                    }: ${interpreter.formatLocation()}`
                );
            }
            return BrsBoolean.from(this.valid);
        },
    });
}

function toUint16(value: number): number {
    // Use modulo to handle overflow and ensure the value is within the 16-bit range
    value = value % 65536;
    // If the value is negative, rotate it within the 16-bit range
    if (value < 0) {
        value += 65536;
    }
    return value >>> 0;
}
