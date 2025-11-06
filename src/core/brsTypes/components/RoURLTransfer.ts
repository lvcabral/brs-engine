import { BrsDevice } from "../../device/BrsDevice";
import { FileSystem } from "../../device/FileSystem";
import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { RoMessagePort } from "./RoMessagePort";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { RoURLEvent } from "../events/RoURLEvent";
import { AudioExt, DefaultCertificatesFile, VideoExt, getRokuOSVersion } from "../../common";
import { IfSetMessagePort, IfGetMessagePort } from "../interfaces/IfMessagePort";
import { BrsHttpAgent, HttpError, IfHttpAgent } from "../interfaces/IfHttpAgent";
import { getHost } from "../../interpreter/Network";
import fileType from "file-type";
/// #if !BROWSER
import { XMLHttpRequest } from "../../polyfill/XMLHttpRequest";
/// #endif

interface RequestOptions {
    method: string;
    responseType: XMLHttpRequestResponseType;
    scope: string;
    body?: any;
    bodyFilePath?: string;
    onSuccess?: (xhr: XMLHttpRequest) => void;
    errorMessage?: (error: any) => string;
    logToStdout?: boolean;
}

export class RoURLTransfer extends BrsComponent implements BrsValue, BrsHttpAgent {
    readonly kind = ValueKind.Object;
    private readonly identity: number;
    private readonly inFile: string[];
    private readonly fs: FileSystem;
    private url: string;
    private host: string;
    private reqMethod: string;
    private failureReason: string;
    private xhr: XMLHttpRequest;
    private freshConnection: boolean;
    private port?: RoMessagePort;
    private outFile: string[];
    private postBody: string[];
    private user?: string;
    private password?: string;
    // ifHttpAgent Interface
    readonly customHeaders: Map<string, string>;
    cookiesEnabled: boolean;
    certificatesFile: string;

    constructor() {
        super("roUrlTransfer");
        this.identity = Math.trunc(Math.random() * 10 * 8);
        this.fs = BrsDevice.fileSystem;
        this.url = "";
        this.host = "";
        this.reqMethod = "";
        this.failureReason = "";
        this.xhr = new XMLHttpRequest();
        this.freshConnection = false;
        this.cookiesEnabled = false;
        this.customHeaders = new Map<string, string>();
        this.certificatesFile = DefaultCertificatesFile;
        this.inFile = new Array<string>();
        this.outFile = new Array<string>();
        this.postBody = new Array<string>();
        const ifHttpAgent = new IfHttpAgent(this);
        const setPortIface = new IfSetMessagePort(this);
        const getPortIface = new IfGetMessagePort(this);
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
                this.getUserAgent, // Since OS 12.5
            ],
            ifHttpAgent: [
                ifHttpAgent.addHeader,
                ifHttpAgent.setHeaders,
                ifHttpAgent.initClientCertificates,
                ifHttpAgent.setCertificatesFile,
                ifHttpAgent.setCertificatesDepth,
                ifHttpAgent.enableCookies,
                ifHttpAgent.getCookies,
                ifHttpAgent.addCookies,
                ifHttpAgent.clearCookies,
            ],
            ifSetMessagePort: [setPortIface.setMessagePort, setPortIface.setPort],
            ifGetMessagePort: [getPortIface.getMessagePort, getPortIface.getPort],
        });
    }

    private executeRequest(options: RequestOptions): RoURLEvent {
        const { method, responseType, scope, body, bodyFilePath, onSuccess, errorMessage, logToStdout } = options;
        let status = -1;
        let headers = "";
        let responseText = "";
        let xhr: XMLHttpRequest | undefined;

        try {
            xhr = this.getConnection(method, responseType);
            let requestBody = body;
            if (bodyFilePath) {
                if (!this.fs.existsSync(bodyFilePath)) {
                    throw new HttpError(-26, `Invalid path: ${bodyFilePath}`);
                }
                requestBody = this.fs.readFileSync(bodyFilePath);
            }
            if (requestBody !== undefined) {
                xhr.send(requestBody);
            } else {
                xhr.send();
            }
            status = xhr.status;
            const headerValue = xhr.getAllResponseHeaders();
            headers = typeof headerValue === "string" ? headerValue : headers;
            this.failureReason = xhr.statusText ?? "";
            responseText = responseType === "text" ? xhr.responseText : "";
            onSuccess?.(xhr);
        } catch (error: any) {
            if (error instanceof HttpError) {
                status = error.status;
            } else if (xhr && typeof xhr.status === "number") {
                status = xhr.status;
            }
            this.failureReason = error?.message ?? "Unknown error";
            if (BrsDevice.isDevMode) {
                const logger = logToStdout ? BrsDevice.stdout : BrsDevice.stderr;
                const message = errorMessage
                    ? errorMessage(error)
                    : `Error transferring ${this.url}: ${this.failureReason}`;
                logger.write(`warning,[${scope}] ${message}`);
            }
        }
        return new RoURLEvent(this.identity, this.host, responseText, status, this.failureReason, headers);
    }

    getConnection(methodParam: string, typeParam: XMLHttpRequestResponseType) {
        if (this.freshConnection) {
            this.xhr = new XMLHttpRequest();
        }
        if (this.url.toLowerCase().startsWith("https:") && !this.fs.existsSync(this.certificatesFile)) {
            throw new HttpError(-77, `error setting certificate file: ${this.certificatesFile}`);
        }
        const method = this.reqMethod === "" ? methodParam : this.reqMethod;
        this.xhr.open(method, BrsDevice.getCORSProxy(this.url), false, this.user, this.password);
        this.xhr.responseType = typeParam;
        for (const [key, value] of this.customHeaders) {
            this.xhr.setRequestHeader(key, value);
        }
        this.xhr.withCredentials = this.cookiesEnabled;
        return this.xhr;
    }

    getToStringEvent(): RoURLEvent {
        const event = this.executeRequest({
            method: "GET",
            responseType: "text",
            scope: "getToStringEvent",
            errorMessage: (error) => `Error getting ${this.url}: ${error?.message ?? error}`,
        });
        return event;
    }

    getToFileEvent(filePath: string): RoURLEvent {
        const event = this.executeRequest({
            method: "GET",
            responseType: "arraybuffer",
            scope: "getToFileEvent",
            onSuccess: (xhr) => {
                if (xhr.status === 200) {
                    this.saveDownloadedFile(filePath, xhr.response);
                }
            },
            errorMessage: (error) => `Error getting ${this.url}: ${error?.message ?? error}`,
        });
        return event;
    }

    getToFileAsync(): BrsType {
        const filePath = this.outFile.shift();
        if (!filePath) {
            return BrsInvalid.Instance;
        }
        return this.getToFileEvent(filePath);
    }

    postFromStringEvent(body: string): RoURLEvent {
        const event = this.executeRequest({
            method: "POST",
            responseType: "text",
            scope: "postFromStringEvent",
            body,
            logToStdout: true,
            errorMessage: (error) => `Error posting to ${this.url}: ${error?.message ?? error}`,
        });
        return event;
    }

    postFromStringAsync(): BrsType {
        const request = this.postBody.shift();
        if (!request) {
            return BrsInvalid.Instance;
        }
        return this.postFromStringEvent(request);
    }

    postFromFileToFileEvent(inputPath: string, outputPath: string): RoURLEvent {
        const event = this.executeRequest({
            method: "POST",
            responseType: "arraybuffer",
            scope: "postFromFileToFileEvent",
            bodyFilePath: inputPath,
            onSuccess: (xhr) => {
                if (xhr.status === 200) {
                    this.saveDownloadedFile(outputPath, xhr.response);
                }
            },
            errorMessage: (error) => `Error posting to ${this.url}: ${error?.message ?? error}`,
        });
        return event;
    }

    postFromFileToFileAsync(): BrsType {
        const inPath = this.inFile.shift();
        const outPath = this.outFile.shift();
        if (!inPath || !outPath) {
            return BrsInvalid.Instance;
        }
        return this.postFromFileToFileEvent(inPath, outPath);
    }

    saveDownloadedFile(filePath: string, data: any) {
        const bytes = data.slice(0, fileType.minimumBytes);
        const type = fileType(bytes);
        if (type && AudioExt.has(type.ext)) {
            this.fs.writeFileSync(filePath, Buffer.from(data));
            postMessage({
                audioPath: filePath,
                audioFormat: type.ext,
                audioData: data,
            });
        } else if (type && VideoExt.has(type.ext)) {
            this.fs.writeFileSync(filePath, "video");
            postMessage({
                videoPath: filePath,
                videoData: data,
            });
        } else {
            this.fs.writeFileSync(filePath, Buffer.from(data));
        }
    }

    requestHead(): BrsType {
        const event = this.executeRequest({
            method: "HEAD",
            responseType: "text",
            scope: "requestHead",
            errorMessage: (error) => `Error requesting from ${this.url}: ${error?.message ?? error}`,
        });
        return event;
    }

    toString(parent?: BrsType): string {
        return "<Component: roUrlTransfer>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    dispose() {
        this.port?.removeReference();
    }

    // ifUrlTransfer ----------------------------------------------------------------------------------

    /** Returns a unique number for this object that can be used to identify whether events originated from this object. */
    private readonly getIdentity = new Callable("getIdentity", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.identity);
        },
    });

    /** Sets the URL to use for the transfer request. */
    private readonly setUrl = new Callable("setUrl", {
        signature: {
            args: [new StdlibArgument("url", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, url: BrsString) => {
            this.url = url.value;
            this.host = getHost(url.value);
            return BrsInvalid.Instance;
        },
    });

    /** Returns the current URL. */
    private readonly getUrl = new Callable("getUrl", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.url);
        },
    });

    /** Changes the request method from the normal GET, HEAD or POST to the value passed as a string. */
    private readonly setRequest = new Callable("setRequest", {
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
    private readonly getRequest = new Callable("getRequest", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.reqMethod);
        },
    });

    /** Connect to the remote service as specified in the URL and return the response body as a string. */
    private readonly getToString = new Callable("getToString", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            const reply = this.getToStringEvent();
            return new BrsString(reply.toString());
        },
    });

    /** Connect to the remote URL and write the response body to a file on the filesystem. */
    private readonly getToFile = new Callable("getToFile", {
        signature: {
            args: [new StdlibArgument("filePath", ValueKind.String)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, filePath: BrsString) => {
            const reply = this.getToFileEvent(filePath.value);
            return new Int32(reply.getStatus());
        },
    });

    /** Starts a GET request to a server, but does not wait for the transfer to complete. */
    private readonly asyncGetToString = new Callable("asyncGetToString", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            if (this.port) {
                this.failureReason = "";
                this.port.pushCallback(this.getToStringEvent.bind(this));
            } else if (BrsDevice.isDevMode) {
                BrsDevice.stderr.write("warning,No message port assigned to this roUrlTransfer instance!");
            }
            return BrsBoolean.True;
        },
    });

    /** Like AsyncGetToString, this starts a transfer without waiting for it to complete. */
    /** However, the response body will be written to a file on the device's filesystem */
    /** instead of being returned in a String object. */
    private readonly asyncGetToFile = new Callable("asyncGetToFile", {
        signature: {
            args: [new StdlibArgument("filePath", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, filePath: BrsString) => {
            if (this.port) {
                this.failureReason = "";
                this.outFile.push(filePath.value);
                this.port.pushCallback(this.getToFileAsync.bind(this));
            } else if (BrsDevice.isDevMode) {
                BrsDevice.stderr.write("warning,No message port assigned to this roUrlTransfer instance!");
            }
            return BrsBoolean.True;
        },
    });

    /** Cancel any outstanding async requests on the roUrlEvent object. */
    private readonly asyncCancel = new Callable("asyncCancel", {
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
    private readonly head = new Callable("head", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.requestHead();
        },
    });

    /** Begin an HTTP HEAD request without waiting for it to complete.. */
    private readonly asyncHead = new Callable("asyncHead", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            if (this.port) {
                this.failureReason = "";
                this.port.pushCallback(this.requestHead.bind(this));
            } else if (BrsDevice.isDevMode) {
                BrsDevice.stderr.write("warning,No message port assigned to this roUrlTransfer instance!");
            }
            return BrsBoolean.True;
        },
    });

    /** Use the HTTP POST method to send the supplied string to the current URL. */
    private readonly postFromString = new Callable("postFromString", {
        signature: {
            args: [new StdlibArgument("request", ValueKind.String)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, request: BrsString) => {
            const reply = this.postFromStringEvent(request.value);
            return new Int32(reply.getStatus());
        },
    });

    /** Use the HTTP POST method to send the supplied string to the current URL. When the POST completes, */
    /** an roUrlEvent will be sent to the message port associated with the object. */
    private readonly asyncPostFromString = new Callable("asyncPostFromString", {
        signature: {
            args: [new StdlibArgument("request", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, request: BrsString) => {
            if (this.port) {
                this.failureReason = "";
                this.postBody.push(request.value);
                this.port.pushCallback(this.postFromStringAsync.bind(this));
            } else if (BrsDevice.isDevMode) {
                BrsDevice.stderr.write("warning,No message port assigned to this roUrlTransfer instance!");
            }
            return BrsBoolean.True;
        },
    });

    /** Use the HTTP POST method to send the contents of the specified file to the current URL. */
    /** The HTTP response code is returned. */
    private readonly postFromFile = new Callable("postFromFile", {
        signature: {
            args: [new StdlibArgument("filePath", ValueKind.String)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, filePath: BrsString) => {
            if (this.fs.existsSync(filePath.value)) {
                const body = this.fs.readFileSync(filePath.value);
                const reply = this.postFromStringEvent(body);
                return new Int32(reply.getStatus());
            } else if (BrsDevice.isDevMode) {
                BrsDevice.stderr.write(`warning,[postFromFile] Invalid path: ${filePath.value}`);
            }
            return new Int32(-26);
        },
    });

    /** Use the HTTP POST method to send the contents of the specified file to the current URL. */
    private readonly asyncPostFromFile = new Callable("asyncPostFromFile", {
        signature: {
            args: [new StdlibArgument("filePath", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, filePath: BrsString) => {
            if (!this.fs.existsSync(filePath.value)) {
                return BrsBoolean.False;
            }
            if (this.port) {
                this.failureReason = "";
                this.postBody.push(this.fs.readFileSync(filePath.value, "utf8"));
                this.port.pushCallback(this.postFromStringAsync.bind(this));
            } else if (BrsDevice.isDevMode) {
                BrsDevice.stderr.write("warning,No message port assigned to this roUrlTransfer instance!");
            }
            return BrsBoolean.True;
        },
    });

    /** Use the HTTP POST method to send the contents of the specified file to the current URL. */
    private readonly asyncPostFromFileToFile = new Callable("asyncPostFromFileToFile", {
        signature: {
            args: [new StdlibArgument("fromFile", ValueKind.String), new StdlibArgument("toFile", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, fromFile: BrsString, toFile: BrsString) => {
            if (!this.fs.existsSync(fromFile.value)) {
                return BrsBoolean.False;
            }
            if (this.port) {
                this.failureReason = "";
                this.inFile.push(fromFile.value);
                this.outFile.push(toFile.value);
                this.port.pushCallback(this.postFromFileToFileAsync.bind(this));
            } else {
                BrsDevice.stderr.write("warning,No message port assigned to this roUrlTransfer instance!");
            }
            return BrsBoolean.True;
        },
    });

    /** If retain is true, return the body of the response even if the HTTP status code indicates that an error occurred. */
    private readonly retainBodyOnError = new Callable("retainBodyOnError", {
        signature: {
            args: [new StdlibArgument("retain", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, retain: BrsBoolean) => {
            // This method is mocked for compatibility
            return BrsBoolean.True;
        },
    });

    /** Enables HTTP authentication using the specified user name and password. */
    private readonly setUserAndPassword = new Callable("setUserAndPassword", {
        signature: {
            args: [new StdlibArgument("user", ValueKind.String), new StdlibArgument("password", ValueKind.String)],
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
    private readonly setMinimumTransferRate = new Callable("setMinimumTransferRate", {
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
    private readonly getFailureReason = new Callable("getFailureReason", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.failureReason);
        },
    });

    /** URL encode the specified string per RFC 3986 and return the encoded string. */
    private readonly escape = new Callable("escape", {
        signature: {
            args: [new StdlibArgument("text", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, text: BrsString) => {
            return new BrsString(encodeURI(text.value));
        },
    });

    /** URL encode the specified string per RFC 3986 and return the encoded string. */
    private readonly urlEncode = new Callable("urlEncode", {
        signature: {
            args: [new StdlibArgument("text", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, text: BrsString) => {
            return new BrsString(encodeURI(text.value));
        },
    });

    /** Decode the specified string per RFC 3986 and return the unencoded string. */
    private readonly unescape = new Callable("unescape", {
        signature: {
            args: [new StdlibArgument("text", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, text: BrsString) => {
            return new BrsString(decodeURI(text.value));
        },
    });

    /** Specify whether to enable gzip encoding of transfers. */
    private readonly enableEncodings = new Callable("enableEncodings", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            // This method is mocked for compatibility
            return BrsBoolean.True;
        },
    });

    /** Enables automatic resumption of AsyncGetToFile and GetToFile requests. */
    private readonly enableResume = new Callable("enableResume", {
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
    private readonly enablePeerVerification = new Callable("enablePeerVerification", {
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
    private readonly enableHostVerification = new Callable("enableHostVerification", {
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
    private readonly enableFreshConnection = new Callable("enableFreshConnection", {
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
    private readonly setHttpVersion = new Callable("setHttpVersion", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            // This method is mocked for compatibility
            return BrsInvalid.Instance;
        },
    });

    /** Returns the user agent of the device, which can then be passed into server-side ad requests. */
    private readonly getUserAgent = new Callable("getUserAgent", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            const firmware = BrsDevice.deviceInfo.firmwareVersion;
            const os = getRokuOSVersion(firmware);
            const short = `${os.get("major")}.${os.get("minor")}`;
            const long = `${short}.${os.get("revision")}.${os.get("build")}-${os.get("plid")}`;
            return new BrsString(`Roku/DVP-${short} (${long})`);
        },
    });
}
