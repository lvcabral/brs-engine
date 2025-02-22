import {
    BrsBoolean,
    BrsInvalid,
    BrsString,
    BrsType,
    Callable,
    Int32,
    RoArray,
    RoAssociativeArray,
    StdlibArgument,
    ValueKind,
} from "..";
import { BrsDevice } from "../../device/BrsDevice";
import { Interpreter } from "../../interpreter";

/**
 * BrightScript Interface ifHttpAgent
 * https://developer.roku.com/docs/references/brightscript/interfaces/ifhttpagent.md
 */

export class IfHttpAgent {
    private readonly component: BrsHttpAgent;

    constructor(value: BrsHttpAgent) {
        this.component = value;
    }

    /** Add the specified HTTP header to the list of headers that will be sent in the HTTP request.
     *  If "x-roku-reserved-dev-id" is passed as a name, the value parameter is ignored and in its place,
     *  the devId of the currently running app is used as the value.
     */
    readonly addHeader = new Callable("addHeader", {
        signature: {
            args: [
                new StdlibArgument("name", ValueKind.String),
                new StdlibArgument("value", ValueKind.String),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, name: BrsString, value: BrsString) => {
            if (name.value.toLowerCase() === "x-roku-reserved-dev-id") {
                this.component.customHeaders.set(name.value, BrsDevice.deviceInfo.developerId);
            } else {
                this.component.customHeaders.set(name.value, value.value);
            }
            return BrsBoolean.True;
        },
    });

    /** Each name/value in the passed AA is added as an HTTP header. */
    readonly setHeaders = new Callable("setHeaders", {
        signature: {
            args: [new StdlibArgument("headers", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, headers: RoAssociativeArray) => {
            this.component.customHeaders.clear();
            headers.elements.forEach((value: BrsType, key: string) => {
                if (key.toLowerCase() === "x-roku-reserved-dev-id") {
                    this.component.customHeaders.set(key, BrsDevice.deviceInfo.developerId);
                } else {
                    this.component.customHeaders.set(key, (value as BrsString).value);
                }
            });
            return BrsBoolean.True;
        },
    });

    /** Initialize the object to send the Roku client certificate. */
    readonly initClientCertificates = new Callable("initClientCertificates", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.True;
        },
    });

    /** Set the certificates file used for SSL to the .pem file specified. */
    readonly setCertificatesFile = new Callable("setCertificatesFile", {
        signature: {
            args: [new StdlibArgument("certificate", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, certificate: BrsString) => {
            // SetCertificatesFile() parameter is ignored, default browser client certificate is be used."
            return BrsBoolean.True;
        },
    });

    /** Sets the maximum depth of the certificate chain that will be accepted. */
    readonly setCertificatesDepth = new Callable("setCertificatesDepth", {
        signature: {
            args: [new StdlibArgument("depth", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, depth: Int32) => {
            // This method is mocked for compatibility
            return BrsInvalid.Instance;
        },
    });

    /** Causes any Set-Cookie headers returned from the request to be interpreted. */
    readonly enableCookies = new Callable("enableCookies", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.component.cookiesEnabled = true;
            return BrsInvalid.Instance;
        },
    });

    /** Returns any cookies from the cookie cache that match the specified domain and path. */
    readonly getCookies = new Callable("getCookies", {
        signature: {
            args: [
                new StdlibArgument("domain", ValueKind.String),
                new StdlibArgument("path", ValueKind.String),
            ],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, domain: BrsString, path: BrsString) => {
            // This method is mocked for compatibility
            return new RoArray([]);
        },
    });

    /** Verifies that the certificate belongs to the host. */
    readonly addCookies = new Callable("addCookies", {
        signature: {
            args: [new StdlibArgument("cookies", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, cookies: BrsType) => {
            // This method is mocked for compatibility
            // returns false to allow proper handling on BrightScript code
            return BrsBoolean.False;
        },
    });

    /** Removes all cookies from the cookie cache. */
    readonly clearCookies = new Callable("clearCookies", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            // This method is mocked for compatibility
            return BrsInvalid.Instance;
        },
    });
}

export interface BrsHttpAgent {
    readonly customHeaders: Map<string, string>;
    cookiesEnabled: boolean;
}
