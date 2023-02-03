import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoMessagePort } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";

export class RoAppInfo extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private port?: RoMessagePort;

    constructor() {
        super("roAppInfo");
        this.registerMethods({
            ifDeviceInfo: [
                this.getId,
                this.isDev,
                this.getDevId,
                this.getVersion,
                this.getTitle,
                this.getSubtitle,
                this.getValue,
            ],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roAppInfo>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Returns the app's channel ID. */
    private getId = new Callable("getId", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.manifest.get("id") || "dev");
        },
    });

    /** Returns true if the application is sideloaded, i.e. the channel ID is "dev". */
    private isDev = new Callable("isDev", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter) => {
            const id = interpreter.manifest.get("id") || "dev";
            return BrsBoolean.from(id === "dev");
        },
    });

    /** Returns the app's developer ID, or the keyed developer ID, if the application is sideloaded. */
    private getDevId = new Callable("getDevId", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("developerId"));
        },
    });

    /** Returns the conglomerate version from the manifest, as formatted major_version + minor_version + build_version. */
    private getVersion = new Callable("getVersion", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            let majorVersion = parseInt(interpreter.manifest.get("major_version")) || 0;
            let minorVersion = parseInt(interpreter.manifest.get("minor_version")) || 0;
            let buildVersion = parseInt(interpreter.manifest.get("build_version")) || 0;
            return new BrsString(`${majorVersion}.${minorVersion}.${buildVersion}`);
        },
    });

    /** Returns the title value from the manifest. */
    private getTitle = new Callable("getTitle", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.manifest.get("title") || "No Title");
        },
    });

    /** Returns the subtitle value from the manifest. */
    private getSubtitle = new Callable("getSubtitle", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.manifest.get("subtitle") || "");
        },
    });

    /** Returns the named manifest value, or an empty string if the entry is does not exist. */
    private getValue = new Callable("getValue", {
        signature: {
            args: [new StdlibArgument("key", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter, key: BrsString) => {
            const value = interpreter.manifest.get(key.value) || "";
            return new BrsString(value);
        },
    });
}
