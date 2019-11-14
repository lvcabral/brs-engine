import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { RoMessagePort } from "./RoMessagePort";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { RoURLEvent } from "./RoURLEvent";
import { RoAssociativeArray } from "./RoAssociativeArray";
import fileType from "file-type";

export class RoURLTransfer extends BrsComponent implements BrsValue {
    readonly audio = new Set<string>([
        "wav",
        "mp2",
        "mp3",
        "mp4",
        "m4a",
        "aac",
        "ogg",
        "oga",
        "ac3",
        "wma",
        "flac",
    ]);
    readonly kind = ValueKind.Object;
    private identity: number;
    private url: string;
    private reqMethod: string;
    private failureReason: string;
    private encodings: boolean;
    private xhr: XMLHttpRequest;
    private freshConnection: boolean;
    private customHeaders: Map<string, string>;
    private port?: RoMessagePort;
    private inFile: Array<string>;
    private outFile: Array<string>;
    private postBody: Array<string>;
    private interpreter: Interpreter;
    private user?: string;
    private password?: string;

    // Constructor can only be used by RoFontRegistry()
    constructor(interpreter: Interpreter) {
        super("roUrlTransfer", [
            "ifUrlTransfer",
            "ifHttpAgent",
            "ifSetMessagePort",
            "ifGetMessagePort",
        ]);
        this.identity = Math.trunc(Math.random() * 10 * 8);
        this.url = "";
        this.reqMethod = "";
        this.failureReason = "";
        this.encodings = false;
        this.xhr = new XMLHttpRequest();
        this.freshConnection = false;
        this.customHeaders = new Map<string, string>();
        this.inFile = new Array<string>();
        this.outFile = new Array<string>();
        this.postBody = new Array<string>();
        this.interpreter = interpreter;
        this.registerMethods([
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
            // this.asyncPostFromFileToFile,
            // this.retainBodyOnError,
            this.setUserAndPassword,
            // this.setMinimumTransferRate,
            this.getFailureReason,
            this.escape,
            this.unescape,
            this.urlEncode,
            this.enableEncodings,
            // this.enableResume,
            // this.enablePeerVerification,
            // this.enableHostVerification,
            this.enableFreshConnection,
            // this.setHttpVersion,
            this.addHeader,
            this.setHeaders,
            this.initClientCertificates,
            this.setCertificatesFile,
            // this.setCertificatesDepth,
            // this.enableCookies,
            // this.getCookies,
            // this.addCookies,
            // this.clearCookies,
            this.getMessagePort,
            this.getPort,
            this.setMessagePort,
            this.setPort,
        ]);
    }
    getConnection() {
        if (this.freshConnection) {
            this.xhr = new XMLHttpRequest();
        }
        return this.xhr;
    }

    getToStringSync(): BrsType {
        const xhr = this.getConnection();
        try {
            let method = this.reqMethod === "" ? "GET" : this.reqMethod;
            xhr.open(method, this.url, false, this.user, this.password);
            xhr.responseType = "text";
            this.customHeaders.forEach((value: string, key: string) => {
                xhr.setRequestHeader(key, value);
            });
            xhr.send();
            this.failureReason = xhr.statusText;
        } catch (e) {
            postMessage(`warning,[getToStringSync] Error getting ${this.url}: ${e.message}`);
            return BrsInvalid.Instance;
        }
        return new RoURLEvent(
            this.identity,
            xhr.responseText,
            xhr.status,
            xhr.statusText,
            xhr.getAllResponseHeaders()
        );
    }

    getToFileSync(filePath: string): BrsType {
        const path = new URL(filePath);
        const volume = this.interpreter.fileSystem.get(path.protocol);
        const xhr = this.getConnection();
        try {
            let method = this.reqMethod === "" ? "GET" : this.reqMethod;
            xhr.open(method, this.url, false, this.user, this.password);
            this.customHeaders.forEach((value: string, key: string) => {
                xhr.setRequestHeader(key, value);
            });
            xhr.responseType = "arraybuffer";
            xhr.send();
            this.failureReason = xhr.statusText;
            if (xhr.status === 200 && volume) {
                const bytes = xhr.response.slice(0, fileType.minimumBytes);
                const type = fileType(bytes);
                if (type && this.audio.has(type.ext)) {
                    this.interpreter.audioId++;
                    volume.writeFileSync(path.pathname, this.interpreter.audioId.toString());
                    postMessage({
                        audioPath: filePath,
                        audioFormat: type.ext,
                        audioData: xhr.response,
                    });
                } else {
                    volume.writeFileSync(path.pathname, xhr.response);
                }
            }
        } catch (e) {
            postMessage(`warning,[getToFileSync] Error getting ${this.url}: ${e.message}`);
            return BrsInvalid.Instance;
        }
        return new RoURLEvent(
            this.identity,
            "",
            xhr.status,
            xhr.statusText,
            xhr.getAllResponseHeaders()
        );
    }

    getToFileAsync(): BrsType {
        const filePath = this.outFile.shift();
        if (!filePath) {
            return BrsInvalid.Instance;
        }
        return this.getToFileSync(filePath);
    }

    postFromStringSync(body: string): BrsType {
        const xhr = this.getConnection();
        try {
            let method = this.reqMethod === "" ? "POST" : this.reqMethod;
            xhr.open(method, this.url, false, this.user, this.password);
            this.customHeaders.forEach((value: string, key: string) => {
                xhr.setRequestHeader(key, value);
            });
            xhr.send(body);
            this.failureReason = xhr.statusText;
        } catch (e) {
            postMessage(`warning,[postFromStringSync] Error posting to ${this.url}: ${e.message}`);
            return BrsInvalid.Instance;
        }
        return new RoURLEvent(
            this.identity,
            xhr.responseText || "",
            xhr.status,
            xhr.statusText,
            xhr.getAllResponseHeaders()
        );
    }

    postFromStringAsync(): BrsType {
        const request = this.postBody.shift();
        if (!request) {
            return BrsInvalid.Instance;
        }
        return this.postFromStringSync(request);
    }

    postFromFileSync(filePath: string): BrsType {
        const xhr = this.getConnection();
        try {
            let method = this.reqMethod === "" ? "POST" : this.reqMethod;
            const path = new URL(filePath);
            const volume = this.interpreter.fileSystem.get(path.protocol);
            xhr.open(method, this.url, false, this.user, this.password);
            this.customHeaders.forEach((value: string, key: string) => {
                xhr.setRequestHeader(key, value);
            });
            if (volume) {
                let body = volume.readFileSync(path.pathname, xhr.response);
                xhr.send(body);
                this.failureReason = xhr.statusText;
            } else {
                postMessage(`warning,[postFromFileSync] Invalid volume: ${filePath}`);
                return BrsInvalid.Instance;
            }
        } catch (e) {
            postMessage(`warning,[postFromFileSync] Error posting to ${this.url}: ${e.message}`);
            return BrsInvalid.Instance;
        }
        return new RoURLEvent(
            this.identity,
            xhr.responseText || "",
            xhr.status,
            xhr.statusText,
            xhr.getAllResponseHeaders()
        );
    }

    postFromFileAsync(): BrsType {
        const filePath = this.inFile.shift();
        if (!filePath) {
            return BrsInvalid.Instance;
        }
        return this.postFromFileSync(filePath);
    }

    requestHead(): BrsType {
        const xhr = this.getConnection();
        try {
            let method = this.reqMethod === "" ? "HEAD" : this.reqMethod;
            xhr.open(method, this.url, false, this.user, this.password);
            this.customHeaders.forEach((value: string, key: string) => {
                xhr.setRequestHeader(key, value);
            });
            xhr.send();
            this.failureReason = xhr.statusText;
            return new RoURLEvent(
                this.identity,
                xhr.responseText,
                xhr.status,
                xhr.statusText,
                xhr.getAllResponseHeaders()
            );
        } catch (e) {
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
            } else {
                postMessage("warning,No message port assigned to this roUrlTransfer instance!");
            }
            return BrsBoolean.True;
        },
    });

    /** Like AsyncGetToString, this starts a transfer without waiting for it to complete.
     *  However, the response body will be written to a file on the device's filesystem
     *  instead of being returned in a String object. */
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
            } else {
                postMessage("warning,No message port assigned to this roUrlTransfer instance!");
            }
            return BrsBoolean.True;
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
            } else {
                postMessage("warning,No message port assigned to this roUrlTransfer instance!");
            }
            return BrsBoolean.True;
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

    /** Use the HTTP POST method to send the supplied string to the current URL. When the POST completes,
     *  an roUrlEvent will be sent to the message port associated with the object. */
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
            } else {
                postMessage("warning,No message port assigned to this roUrlTransfer instance!");
            }
            return BrsBoolean.True;
        },
    });

    /** Use the HTTP POST method to send the contents of the specified file to the current URL.
     *  The HTTP response code is returned. */
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
            } else {
                postMessage("warning,No message port assigned to this roUrlTransfer instance!");
            }
            return BrsBoolean.True;
        },
    });

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
            this.encodings = enable.toBoolean();
            // TODO: Reflect this config on gzip encoding usage
            return enable;
        },
    });

    /** Specify whether to enable fresh connections. */
    private enableFreshConnection = new Callable("enableFreshConnection", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            this.freshConnection = true;
            return enable;
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
            postMessage(
                "warning,[roUrlTransfer] SetCertificatesFile() parameter was ignored, default browser client certificate will be used."
            );
            return BrsBoolean.True;
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
            return this.port || BrsInvalid.Instance;
        },
    });

    /** Returns the message port (if any) currently associated with the object */
    private getPort = new Callable("getPort", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.port || BrsInvalid.Instance;
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
