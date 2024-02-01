import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { RoMessagePort } from "./RoMessagePort";
import { BrsType, RoArray } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { RoURLEvent } from "./RoURLEvent";
import { RoAssociativeArray } from "./RoAssociativeArray";
import { FileSystem } from "../../interpreter/FileSystem";
import { audioExt, videoExt } from "../../enums";
import fileType from "file-type";

export class RoURLTransfer extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private identity: number;
    private url: string;
    private reqMethod: string;
    private failureReason: string;
    private cookiesEnabled: boolean;
    private xhr: XMLHttpRequest;
    private freshConnection: boolean;
    private customHeaders: Map<string, string>;
    private port?: RoMessagePort;
    private inFile: string[];
    private outFile: string[];
    private postBody: string[];
    private interpreter: Interpreter;
    private user?: string;
    private password?: string;

    // Constructor can only be used by RoFontRegistry()
    constructor(interpreter: Interpreter) {
        super("roUrlTransfer");
        this.identity = Math.trunc(Math.random() * 10 * 8);
        this.url = "";
        this.reqMethod = "";
        this.failureReason = "";
        this.cookiesEnabled = false;
        this.xhr = new XMLHttpRequest();
        this.freshConnection = false;
        this.customHeaders = new Map<string, string>();
        this.inFile = new Array<string>();
        this.outFile = new Array<string>();
        this.postBody = new Array<string>();
        this.interpreter = interpreter;
        this.registerMethods({
            ifUrlTransfer: [
                this.getIdentity,
                this.setUrl,
                this.getUrl,
                this.setRequest,
                this.getRequest,
                this.getToString,
                this.getToFile,
                this.asyncGetToString,
                this.asyncGetToFile,
                this.asyncCancel,
                this.head,
                this.asyncHead,
                this.postFromString,
                this.postFromFile,
                this.asyncPostFromString,
                this.asyncPostFromFile,
                this.asyncPostFromFileToFile,
                this.retainBodyOnError,
                this.setUserAndPassword,
                this.setMinimumTransferRate,
                this.getFailureReason,
                this.escape,
                this.unescape,
                this.urlEncode,
                this.enableEncodings,
                this.enableResume,
                this.enablePeerVerification,
                this.enableHostVerification,
                this.enableFreshConnection,
                this.setHttpVersion,
            ],
            ifHttpAgent: [
                this.addHeader,
                this.setHeaders,
                this.initClientCertificates,
                this.setCertificatesFile,
                this.setCertificatesDepth,
                this.enableCookies,
                this.getCookies,
                this.addCookies,
                this.clearCookies,
            ],
            ifSetMessagePort: [this.setMessagePort, this.setPort],
            ifGetMessagePort: [this.getMessagePort, this.getPort],
        });
    }
    getConnection(methodParam: string, typeParam: XMLHttpRequestResponseType) {
        if (this.freshConnection) {
            this.xhr = new XMLHttpRequest();
        }
        let method = this.reqMethod === "" ? methodParam : this.reqMethod;
        this.xhr.open(method, this.url, false, this.user, this.password);
        this.xhr.responseType = typeParam;
        this.customHeaders.forEach((value: string, key: string) => {
            this.xhr.setRequestHeader(key, value);
        });
        this.xhr.withCredentials = this.cookiesEnabled;
        return this.xhr;
    }

    getToStringSync(): BrsType {
        try {
            const xhr = this.getConnection("GET", "text");
            xhr.send();
            this.failureReason = xhr.statusText;
            return new RoURLEvent(
                this.identity,
                xhr.responseText,
                xhr.status,
                xhr.statusText,
                xhr.getAllResponseHeaders()
            );
        } catch (e: any) {
            postMessage(`warning,[getToStringSync] Error getting ${this.url}: ${e.message}`);
            return BrsInvalid.Instance;
        }
    }

    getToFileSync(filePath: string): BrsType {
        try {
            const path = new URL(filePath);
            const volume = this.interpreter.fileSystem.get(path.protocol);
            const xhr = this.getConnection("GET", "arraybuffer");
            xhr.send();
            this.failureReason = xhr.statusText;
            if (xhr.status === 200 && volume) {
                this.saveDownloadedFile(volume, path, xhr.response);
            }
            return new RoURLEvent(
                this.identity,
                "",
                xhr.status,
                xhr.statusText,
                xhr.getAllResponseHeaders()
            );
        } catch (e: any) {
            postMessage(`warning,[getToFileSync] Error getting ${this.url}: ${e.message}`);
            return BrsInvalid.Instance;
        }
    }

    getToFileAsync(): BrsType {
        const filePath = this.outFile.shift();
        if (!filePath) {
            return BrsInvalid.Instance;
        }
        return this.getToFileSync(filePath);
    }

    postFromStringSync(body: string): BrsType {
        try {
            const xhr = this.getConnection("POST", "text");
            xhr.send(body);
            this.failureReason = xhr.statusText;
            return new RoURLEvent(
                this.identity,
                xhr.responseText || "",
                xhr.status,
                xhr.statusText,
                xhr.getAllResponseHeaders()
            );
        } catch (e: any) {
            postMessage(`warning,[postFromStringSync] Error posting to ${this.url}: ${e.message}`);
            return BrsInvalid.Instance;
        }
    }

    postFromStringAsync(): BrsType {
        const request = this.postBody.shift();
        if (!request) {
            return BrsInvalid.Instance;
        }
        return this.postFromStringSync(request);
    }

    postFromFileSync(filePath: string): BrsType {
        try {
            const xhr = this.getConnection("POST", "text");
            const path = new URL(filePath);
            const volume = this.interpreter.fileSystem.get(path.protocol);
            if (volume) {
                let body = volume.readFileSync(path.pathname, xhr.response);
                xhr.send(body);
                this.failureReason = xhr.statusText;
            } else {
                postMessage(`warning,[postFromFileSync] Invalid volume: ${filePath}`);
                return BrsInvalid.Instance;
            }
            return new RoURLEvent(
                this.identity,
                xhr.responseText || "",
                xhr.status,
                xhr.statusText,
                xhr.getAllResponseHeaders()
            );
        } catch (e: any) {
            postMessage(`warning,[postFromFileSync] Error posting to ${this.url}: ${e.message}`);
            return BrsInvalid.Instance;
        }
    }

    postFromFileAsync(): BrsType {
        const filePath = this.inFile.shift();
        if (!filePath) {
            return BrsInvalid.Instance;
        }
        return this.postFromFileSync(filePath);
    }

    postFromFileToFileSync(inputPath: string, outputPath: string): BrsType {
        try {
            const xhr = this.getConnection("POST", "arraybuffer");
            const inPath = new URL(inputPath);
            const inVolume = this.interpreter.fileSystem.get(inPath.protocol);
            if (inVolume) {
                let body = inVolume.readFileSync(inPath.pathname, xhr.response);
                xhr.send(body);
                const outPath = new URL(outputPath);
                const outVolume = this.interpreter.fileSystem.get(outPath.protocol);
                if (xhr.status === 200 && outVolume) {
                    this.saveDownloadedFile(outVolume, outPath, xhr.response);
                }
                this.failureReason = xhr.statusText;
            } else {
                postMessage(`warning,[postFromFileToFileSync] Invalid volume: ${inputPath}`);
                return BrsInvalid.Instance;
            }
            return new RoURLEvent(
                this.identity,
                "",
                xhr.status,
                xhr.statusText,
                xhr.getAllResponseHeaders()
            );
        } catch (e: any) {
            postMessage(
                `warning,[postFromFileToFileSync] Error posting to ${this.url}: ${e.message}`
            );
            return BrsInvalid.Instance;
        }
    }

    postFromFileToFileAsync(): BrsType {
        const inPath = this.inFile.shift();
        const outPath = this.outFile.shift();
        if (!inPath || !outPath) {
            return BrsInvalid.Instance;
        }
        return this.postFromFileToFileSync(inPath, outPath);
    }

    saveDownloadedFile(volume: FileSystem, path: URL, data: any) {
        const bytes = data.slice(0, fileType.minimumBytes);
        const type = fileType(bytes);
        if (type && audioExt.has(type.ext)) {
            this.interpreter.audioId++;
            volume.writeFileSync(path.pathname, this.interpreter.audioId.toString());
            postMessage({
                audioPath: path.protocol + path.pathname,
                audioFormat: type.ext,
                audioData: data,
            });
        } else if (type && videoExt.has(type.ext)) {
            volume.writeFileSync(path.pathname, "video");
            postMessage({
                videoPath: path.protocol + path.pathname,
                videoData: data,
            });
        } else {
            volume.writeFileSync(path.pathname, data);
        }
    }

    requestHead(): BrsType {
        try {
            const xhr = this.getConnection("HEAD", "text");
            xhr.send();
            this.failureReason = xhr.statusText;
            return new RoURLEvent(
                this.identity,
                xhr.responseText,
                xhr.status,
                xhr.statusText,
                xhr.getAllResponseHeaders()
            );
        } catch (e: any) {
            postMessage(`warning,[requestHead] Error requesting from ${this.url}: ${e.message}`);
            return BrsInvalid.Instance;
        }
    }

    toString(parent?: BrsType): string {
        return "<Component: roUrlTransfer>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    // ifUrlTransfer ----------------------------------------------------------------------------------

    /** Returns a unique number for this object that can be used to identify whether events originated from this object. */
    private getIdentity = new Callable("getIdentity", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.identity);
        },
    });

    /** Sets the URL to use for the transfer request. */
    private setUrl = new Callable("setUrl", {
        signature: {
            args: [new StdlibArgument("url", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, url: BrsString) => {
            this.url = url.value;
            return BrsInvalid.Instance;
        },
    });

    /** Returns the current URL. */
    private getUrl = new Callable("getUrl", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.url);
        },
    });

    /** Changes the request method from the normal GET, HEAD or POST to the value passed as a string. */
    private setRequest = new Callable("setRequest", {
        signature: {
            args: [new StdlibArgument("reqMethod", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, reqMethod: BrsString) => {
            this.reqMethod = reqMethod.value;
            return BrsInvalid.Instance;
        },
    });

    /** Returns the current request method. */
    private getRequest = new Callable("getRequest", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.reqMethod);
        },
    });

    /** Connect to the remote service as specified in the URL and return the response body as a string. */
    private getToString = new Callable("getToString", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            const reply = this.getToStringSync();
            if (reply instanceof RoURLEvent) {
                return new BrsString(reply.getResponseText());
            }
            return new BrsString("");
        },
    });

    /** Connect to the remote URL and write the response body to a file on the filesystem. */
    private getToFile = new Callable("getToFile", {
        signature: {
            args: [new StdlibArgument("filePath", ValueKind.String)],
            returns: ValueKind.Int32,
        },
        impl: (interpreter: Interpreter, filePath: BrsString) => {
            const reply = this.getToFileSync(filePath.value);
            if (reply instanceof RoURLEvent) {
                return new Int32(reply.getStatus());
            }
            return new Int32(400); // Bad Request;
        },
    });

    /** Starts a GET request to a server, but does not wait for the transfer to complete. */
    private asyncGetToString = new Callable("asyncGetToString", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            if (this.port) {
                this.failureReason = "";
                this.port.registerCallback(this.getToStringSync.bind(this));
                return BrsBoolean.True;
            } else {
                postMessage("warning,No message port assigned to this roUrlTransfer instance!");
                return BrsBoolean.False;
            }
        },
    });

    /** Like AsyncGetToString, this starts a transfer without waiting for it to complete. */
    /** However, the response body will be written to a file on the device's filesystem */
    /** instead of being returned in a String object. */
    private asyncGetToFile = new Callable("asyncGetToFile", {
        signature: {
            args: [new StdlibArgument("filePath", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, filePath: BrsString) => {
            if (this.port) {
                this.failureReason = "";
                this.outFile.push(filePath.value);
                this.port.registerCallback(this.getToFileAsync.bind(this));
                return BrsBoolean.True;
            } else {
                postMessage("warning,No message port assigned to this roUrlTransfer instance!");
                return BrsBoolean.False;
            }
        },
    });

    /** Cancel any outstanding async requests on the roUrlEvent object. */
    private asyncCancel = new Callable("asyncCancel", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            if (this.port) {
                this.failureReason = "";
                this.outFile = [];
                this.postBody = [];
                this.port.asyncCancel();
            }
            return BrsBoolean.True;
        },
    });

    /** Synchronously perform an HTTP HEAD request and return an roUrlEvent object. */
    private head = new Callable("head", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.requestHead();
        },
    });

    /** Begin an HTTP HEAD request without waiting for it to complete.. */
    private asyncHead = new Callable("asyncHead", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            if (this.port) {
                this.failureReason = "";
                this.port.registerCallback(this.requestHead.bind(this));
                return BrsBoolean.True;
            } else {
                postMessage("warning,No message port assigned to this roUrlTransfer instance!");
                return BrsBoolean.False;
            }
        },
    });

    /** Use the HTTP POST method to send the supplied string to the current URL. */
    private postFromString = new Callable("postFromString", {
        signature: {
            args: [new StdlibArgument("request", ValueKind.String)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, request: BrsString) => {
            const reply = this.postFromStringSync(request.value);
            if (reply instanceof RoURLEvent) {
                return new Int32(reply.getStatus());
            }
            return new Int32(400); // Bad Request;
        },
    });

    /** Use the HTTP POST method to send the supplied string to the current URL. When the POST completes, */
    /** an roUrlEvent will be sent to the message port associated with the object. */
    private asyncPostFromString = new Callable("asyncPostFromString", {
        signature: {
            args: [new StdlibArgument("request", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, request: BrsString) => {
            if (this.port) {
                this.failureReason = "";
                this.postBody.push(request.value);
                this.port.registerCallback(this.postFromStringAsync.bind(this));
                return BrsBoolean.True;
            } else {
                postMessage("warning,No message port assigned to this roUrlTransfer instance!");
                return BrsBoolean.False;
            }
        },
    });

    /** Use the HTTP POST method to send the contents of the specified file to the current URL. */
    /** The HTTP response code is returned. */
    private postFromFile = new Callable("postFromFile", {
        signature: {
            args: [new StdlibArgument("filePath", ValueKind.String)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, filePath: BrsString) => {
            const reply = this.postFromFileSync(filePath.value);
            if (reply instanceof RoURLEvent) {
                return new Int32(reply.getStatus());
            }
            return new Int32(400); // Bad Request;
        },
    });

    /** Use the HTTP POST method to send the contents of the specified file to the current URL. */
    private asyncPostFromFile = new Callable("asyncPostFromFile", {
        signature: {
            args: [new StdlibArgument("filePath", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, filePath: BrsString) => {
            if (this.port) {
                this.failureReason = "";
                this.inFile.push(filePath.value);
                this.port.registerCallback(this.postFromFileAsync.bind(this));
                return BrsBoolean.True;
            } else {
                postMessage("warning,No message port assigned to this roUrlTransfer instance!");
                return BrsBoolean.False;
            }
        },
    });

    /** Use the HTTP POST method to send the contents of the specified file to the current URL. */
    private asyncPostFromFileToFile = new Callable("asyncPostFromFileToFile", {
        signature: {
            args: [
                new StdlibArgument("fromFile", ValueKind.String),
                new StdlibArgument("toFile", ValueKind.String),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, fromFile: BrsString, toFile: BrsString) => {
            if (this.port) {
                this.failureReason = "";
                this.inFile.push(fromFile.value);
                this.outFile.push(toFile.value);
                this.port.registerCallback(this.postFromFileToFileAsync.bind(this));
                return BrsBoolean.True;
            } else {
                postMessage("warning,No message port assigned to this roUrlTransfer instance!");
                return BrsBoolean.False;
            }
        },
    });

    /** If retain is true, return the body of the response even if the HTTP status code indicates that an error occurred. */
    private retainBodyOnError = new Callable("retainBodyOnError", {
        signature: {
            args: [new StdlibArgument("retain", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, retain: BrsBoolean) => {
            return BrsBoolean.True;
        },
    });

    /** Enables HTTP authentication using the specified user name and password. */
    private setUserAndPassword = new Callable("setUserAndPassword", {
        signature: {
            args: [
                new StdlibArgument("user", ValueKind.String),
                new StdlibArgument("password", ValueKind.String),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, user: BrsString, password: BrsString) => {
            this.user = user.value;
            this.password = password.value;
            return BrsBoolean.True;
        },
    });

    /** Terminates the transfer automatically if the transfer rate drops below the */
    /** specified rate (bytes_per_second) over a specific interval (period_in_seconds). */
    private setMinimumTransferRate = new Callable("setMinimumTransferRate", {
        signature: {
            args: [
                new StdlibArgument("bytes_per_second", ValueKind.Int32),
                new StdlibArgument("period_in_seconds", ValueKind.Int32),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, bps: Int32, period: Int32) => {
            // This method is mocked for compatibility
            // returns false to allow proper handling on BrightScript code
            return BrsBoolean.False;
        },
    });

    /** Returns a description of the failure that occurred. */
    private getFailureReason = new Callable("getFailureReason", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.failureReason);
        },
    });

    /** URL encode the specified string per RFC 3986 and return the encoded string. */
    private escape = new Callable("escape", {
        signature: {
            args: [new StdlibArgument("text", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, text: BrsString) => {
            return new BrsString(encodeURI(text.value));
        },
    });

    /** URL encode the specified string per RFC 3986 and return the encoded string. */
    private urlEncode = new Callable("urlEncode", {
        signature: {
            args: [new StdlibArgument("text", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, text: BrsString) => {
            return new BrsString(encodeURI(text.value));
        },
    });

    /** Decode the specified string per RFC 3986 and return the unencoded string. */
    private unescape = new Callable("unescape", {
        signature: {
            args: [new StdlibArgument("text", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, text: BrsString) => {
            return new BrsString(decodeURI(text.value));
        },
    });

    /** Specify whether to enable gzip encoding of transfers. */
    private enableEncodings = new Callable("enableEncodings", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            return BrsBoolean.True;
        },
    });

    /** Enables automatic resumption of AsyncGetToFile and GetToFile requests. */
    private enableResume = new Callable("enableResume", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            // This method is mocked for compatibility
            // returns false to allow proper handling on BrightScript code
            return BrsBoolean.False;
        },
    });

    /** Verifies that the certificate has a chain of trust up to a valid root certificate. */
    private enablePeerVerification = new Callable("enablePeerVerification", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            // This method is mocked for compatibility
            // returns false to allow proper handling on BrightScript code
            return BrsBoolean.False;
        },
    });

    /** Verifies that the certificate belongs to the host. */
    private enableHostVerification = new Callable("enableHostVerification", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            // This method is mocked for compatibility
            // returns false to allow proper handling on BrightScript code
            return BrsBoolean.False;
        },
    });

    /** Specify whether to enable fresh connections. */
    private enableFreshConnection = new Callable("enableFreshConnection", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            this.freshConnection = enable.toBoolean();
            return BrsBoolean.True;
        },
    });

    /** An optional function that enables HTTP/2 support. */
    private setHttpVersion = new Callable("setHttpVersion", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            // This method is mocked for compatibility
            return BrsInvalid.Instance;
        },
    });

    // ifHttpAgent ---------------------------------------------------------------------------------------

    /** Add the specified HTTP header to the list of headers that will be sent in the HTTP request.
     *  If "x-roku-reserved-dev-id" is passed as a name, the value parameter is ignored and in its place,
     *  the devid of the currently running channel is used as the value.
     */
    private addHeader = new Callable("addHeader", {
        signature: {
            args: [
                new StdlibArgument("name", ValueKind.String),
                new StdlibArgument("value", ValueKind.String),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, name: BrsString, value: BrsString) => {
            if (name.value.toLowerCase() === "x-roku-reserved-dev-id") {
                this.customHeaders.set(name.value, interpreter.deviceInfo.get("developerId"));
            } else {
                this.customHeaders.set(name.value, value.value);
            }
            return BrsBoolean.True;
        },
    });

    /** Each name/value in the passed AA is added as an HTTP header. */
    private setHeaders = new Callable("setHeaders", {
        signature: {
            args: [new StdlibArgument("headers", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, headers: RoAssociativeArray) => {
            this.customHeaders = new Map<string, string>();
            headers.elements.forEach((value: BrsType, key: string) => {
                if (key.toLowerCase() === "x-roku-reserved-dev-id") {
                    this.customHeaders.set(key, interpreter.deviceInfo.get("developerId"));
                } else {
                    this.customHeaders.set(key, (value as BrsString).value);
                }
            });
            return BrsBoolean.True;
        },
    });

    /** Initialize the object to send the Roku client certificate. */
    private initClientCertificates = new Callable("initClientCertificates", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.True;
        },
    });

    /** Set the certificates file used for SSL to the .pem file specified. */
    private setCertificatesFile = new Callable("setCertificatesFile", {
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
    private setCertificatesDepth = new Callable("setCertificatesDepth", {
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
    private enableCookies = new Callable("enableCookies", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.cookiesEnabled = true;
            return BrsInvalid.Instance;
        },
    });

    /** Returns any cookies from the cookie cache that match the specified domain and path. */
    private getCookies = new Callable("getCookies", {
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
    private addCookies = new Callable("addCookies", {
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
    private clearCookies = new Callable("clearCookies", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            // This method is mocked for compatibility
            return BrsInvalid.Instance;
        },
    });

    // ifGetMessagePort ----------------------------------------------------------------------------------

    /** Returns the message port (if any) currently associated with the object */
    private getMessagePort = new Callable("getMessagePort", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.port ?? BrsInvalid.Instance;
        },
    });

    /** Returns the message port (if any) currently associated with the object */
    private getPort = new Callable("getPort", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.port ?? BrsInvalid.Instance;
        },
    });

    // ifSetMessagePort ----------------------------------------------------------------------------------

    /** Sets the roMessagePort to be used for all events from the audio player */
    private setMessagePort = new Callable("setMessagePort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, port: RoMessagePort) => {
            this.port = port;
            return BrsInvalid.Instance;
        },
    });

    /** Sets the roMessagePort to be used for all events from the audio player */
    private setPort = new Callable("setPort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, port: RoMessagePort) => {
            this.port = port;
            return BrsInvalid.Instance;
        },
    });
}
