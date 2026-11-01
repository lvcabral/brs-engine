import { BrsDevice } from "../../device/BrsDevice";
import { FileSystem } from "../../device/FileSystem";
import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { RoMessagePort } from "./RoMessagePort";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { RoURLEvent, UrlEventType } from "../events/RoURLEvent";
import { RoSSEvent } from "../events/RoSSEvent";
import { BrsEvent } from "../events/BrsEvent";
import { AudioExt, DefaultCertificatesFile, VideoExt, getRokuOSVersion } from "../../common";
import { IfSetMessagePort, IfGetMessagePort } from "../interfaces/IfMessagePort";
import { BrsHttpAgent, HttpError, IfHttpAgent } from "../interfaces/IfHttpAgent";
import { getHost } from "../../interpreter/Network";
import { generateUniqueId } from "../interfaces/IfSocket";
import fileType from "file-type";
import { ServerSentEvent, SseParser } from "../../device/SseParser";
import { BackgroundJob, HttpJobResult, backgroundAvailable, startBackgroundJob } from "../../device/BackgroundWorker";
import { SseEventPayload, SseTransport } from "../../device/SseTransport";
/// #if BROWSER
import { SseBridge } from "../../device/SseBridge";
/// #else
import { XMLHttpRequest } from "../../polyfill/XMLHttpRequest";
import { SseNodeBridge } from "../../device/SseNodeBridge";
/// #endif

/** Percent-encodes a string per RFC 3986, closing the gap left by `encodeURIComponent()`
 *  (which leaves `!'()*` unescaped for legacy `escape()` compatibility). */
function encodeUriComponentStrict(text: string): string {
    return encodeURIComponent(text).replaceAll(/[!'()*]/g, (c) => "%" + c.codePointAt(0)!.toString(16).toUpperCase());
}

/** What a transfer sends and how it reports, shared by its synchronous and asynchronous forms. */
interface RequestOptions {
    method: string;
    responseType: "text" | "arraybuffer";
    scope: string;
    /** Verb of the dev-mode error message, e.g. "getting" in "Error getting <url>". */
    action: string;
    body?: string | Buffer;
    bodyFilePath?: string;
    /** File that a 200 response's body is saved to. */
    outFile?: string;
    logToStdout?: boolean;
}

const Transfers = {
    getToString: { method: "GET", responseType: "text", scope: "getToStringEvent", action: "getting" },
    getToFile: { method: "GET", responseType: "arraybuffer", scope: "getToFileEvent", action: "getting" },
    postFromString: {
        method: "POST",
        responseType: "text",
        scope: "postFromStringEvent",
        action: "posting to",
        logToStdout: true,
    },
    postFromFileToFile: {
        method: "POST",
        responseType: "arraybuffer",
        scope: "postFromFileToFileEvent",
        action: "posting to",
    },
    head: { method: "HEAD", responseType: "text", scope: "requestHead", action: "requesting from" },
} satisfies Record<string, RequestOptions>;

/** An asynchronous transfer running on the background worker. */
interface AsyncTransfer {
    job: BackgroundJob<HttpJobResult>;
    options: RequestOptions;
    url: string;
    host: string;
}

const textDecoder = new TextDecoder();
const NoEvents: readonly BrsEvent[] = Object.freeze([]);

/** State of the current `AsyncGetSSEvents()` transfer. */
interface SseTransfer {
    parser: SseParser;
    status: number;
    statusText: string;
    headers: string;
    isStream: boolean;
    started: boolean;
    body: string[];
}

export class RoURLTransfer extends BrsComponent implements BrsValue, BrsHttpAgent {
    readonly kind = ValueKind.Object;
    private readonly identity: number;
    private readonly fs: FileSystem;
    private url: string;
    private host: string;
    private reqMethod: string;
    private failureReason: string;
    private xhr: XMLHttpRequest;
    private freshConnection: boolean;
    private port?: RoMessagePort;
    private user?: string;
    private password?: string;
    private readonly callbackKey: string;
    private readonly asyncTransfers: AsyncTransfer[] = [];
    private sseTransport?: SseTransport;
    private sseTransfer?: SseTransfer;
    private lastSseEventId: string;
    private lastSseRetry: number;
    // ifHttpAgent Interface
    readonly customHeaders: Map<string, string>;
    cookiesEnabled: boolean;
    certificatesFile: string;

    constructor() {
        super("roUrlTransfer");
        this.identity = generateUniqueId();
        this.callbackKey = `roUrlTransfer:${this.identity}`;
        this.lastSseEventId = "";
        this.lastSseRetry = 0;
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
        const ifHttpAgent = new IfHttpAgent(this);
        const setPortIface = new IfSetMessagePort(this, this.getPortEvents.bind(this), this.callbackKey);
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
                this.asyncGetSSEvents, // Since OS 16.0
                this.sseLastEventId,
                this.sseRetry,
                this.sseClearLastEventId,
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
        const { responseType, body, bodyFilePath, outFile } = options;
        let status = -1;
        let headers = "";
        let responseText = "";
        let xhr: XMLHttpRequest | undefined;

        try {
            xhr = this.getConnection(options.method, responseType);
            let requestBody: any = body;
            if (bodyFilePath) {
                if (!this.fs.existsSync(bodyFilePath)) {
                    throw new HttpError(-26, `Invalid path: ${bodyFilePath}`);
                }
                requestBody = this.fs.readFileSync(bodyFilePath);
            }
            if (requestBody === undefined) {
                xhr.send();
            } else {
                xhr.send(requestBody);
            }
            status = xhr.status;
            const headerValue = xhr.getAllResponseHeaders();
            headers = typeof headerValue === "string" ? headerValue : headers;
            this.failureReason = xhr.statusText ?? "";
            responseText = responseType === "text" ? xhr.responseText : "";
            if (outFile && xhr.status === 200) {
                this.saveDownloadedFile(outFile, xhr.response);
            }
        } catch (error: any) {
            if (error instanceof HttpError) {
                status = error.status;
            } else if (xhr && typeof xhr.status === "number") {
                status = xhr.status;
            }
            this.failureReason = error?.message ?? "Unknown error";
            this.logTransferError(options, this.url, error?.message ?? error);
        }
        return this.newUrlEvent(responseText, status, this.failureReason, headers);
    }

    private logTransferError(options: RequestOptions, url: string, message: string) {
        if (BrsDevice.isDevMode) {
            const logger = options.logToStdout ? BrsDevice.stdout : BrsDevice.stderr;
            logger.write(`warning,[${options.scope}] Error ${options.action} ${url}: ${message}`);
        }
    }

    /** Whether the URL is https but the certificates file doesn't exist (transfer fails with -77). */
    private missingCertificates() {
        return this.url.toLowerCase().startsWith("https:") && !this.fs.existsSync(this.certificatesFile);
    }

    /** The method to send: the one set with `SetRequest()`, or else the transfer's own. */
    private requestMethod(method: string) {
        return this.reqMethod === "" ? method : this.reqMethod;
    }

    getConnection(methodParam: string, typeParam: XMLHttpRequestResponseType) {
        if (this.freshConnection) {
            this.xhr = new XMLHttpRequest();
        }
        if (this.missingCertificates()) {
            throw new HttpError(-77, `error setting certificate file: ${this.certificatesFile}`);
        }
        this.xhr.open(
            this.requestMethod(methodParam),
            BrsDevice.getCORSProxy(this.url),
            false,
            this.user,
            this.password
        );
        this.xhr.responseType = typeParam;
        for (const [key, value] of this.customHeaders) {
            this.xhr.setRequestHeader(key, value);
        }
        this.xhr.withCredentials = this.cookiesEnabled;
        return this.xhr;
    }

    getToStringEvent(): RoURLEvent {
        return this.executeRequest(Transfers.getToString);
    }

    getToFileEvent(filePath: string): RoURLEvent {
        return this.executeRequest({ ...Transfers.getToFile, outFile: filePath });
    }

    postFromStringEvent(body: string | Buffer): RoURLEvent {
        return this.executeRequest({ ...Transfers.postFromString, body });
    }

    postFromFileToFileEvent(inputPath: string, outputPath: string): RoURLEvent {
        return this.executeRequest({ ...Transfers.postFromFileToFile, bodyFilePath: inputPath, outFile: outputPath });
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

    requestHead(): RoURLEvent {
        return this.executeRequest(Transfers.head);
    }

    toString(parent?: BrsType): string {
        return "<Component: roUrlTransfer>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    dispose() {
        this.cancelAsyncTransfers();
        this.port?.unregisterCallback(this.getComponentName(), this.callbackKey);
        this.sseTransport?.dispose();
        this.port?.removeReference();
    }

    // Server-Sent Events -----------------------------------------------------------------------------

    /** Builds the request headers of an SSE transfer, including the automatic `Last-Event-ID`. */
    private getSseHeaders(): Record<string, string> {
        const headers: Record<string, string> = {};
        for (const [key, value] of this.customHeaders) {
            headers[key] = value;
        }
        const names = new Set(Object.keys(headers).map((key) => key.toLowerCase()));
        if (!names.has("accept")) {
            headers["Accept"] = "text/event-stream";
        }
        if (!names.has("cache-control")) {
            headers["Cache-Control"] = "no-cache";
        }
        if (this.user !== undefined && !names.has("authorization")) {
            const credentials = Buffer.from(`${this.user}:${this.password ?? ""}`).toString("base64");
            headers["Authorization"] = `Basic ${credentials}`;
        }
        if (this.lastSseEventId !== "") {
            for (const key of Object.keys(headers)) {
                if (key.toLowerCase() === "last-event-id") {
                    delete headers[key];
                }
            }
            headers["Last-Event-ID"] = this.lastSseEventId;
        }
        return headers;
    }

    /** Starts an SSE transfer, delivering its events to the message port. */
    private startSse(port: RoMessagePort): boolean {
        this.stopSse();
        this.failureReason = "";
        this.lastSseRetry = 0;
        if (this.missingCertificates()) {
            this.failureReason = `error setting certificate file: ${this.certificatesFile}`;
            const event = this.newUrlEvent("", -77, this.failureReason, "", UrlEventType.Completed);
            port.pushCallback(() => event);
            return true;
        }
        this.sseTransport ??= createSseTransport((message) => {
            if (BrsDevice.isDevMode) {
                BrsDevice.stderr.write(`warning,${message}`);
            }
        });
        const started = this.sseTransport.start({
            url: BrsDevice.getCORSProxy(this.url),
            method: this.reqMethod === "" ? "GET" : this.reqMethod,
            headers: this.getSseHeaders(),
        });
        if (!started) {
            return false;
        }
        this.sseTransfer = {
            parser: new SseParser(),
            status: 0,
            statusText: "",
            headers: "",
            isStream: false,
            started: false,
            body: [],
        };
        return true;
    }

    /** Cancels the current SSE transfer, if any, without sending further events. */
    private stopSse() {
        if (this.sseTransfer) {
            this.sseTransport?.abort();
            this.sseTransfer = undefined;
        }
    }

    /** Polled on every message port iteration: delivers settled asynchronous transfers and SSE events. */
    private getPortEvents(): readonly BrsEvent[] {
        if (this.asyncTransfers.length === 0) {
            return this.getSseEvents();
        }
        let events: BrsEvent[] | undefined;
        for (let index = 0; index < this.asyncTransfers.length; ) {
            const transfer = this.asyncTransfers[index];
            if (transfer.job.poll()) {
                this.asyncTransfers.splice(index, 1);
                events ??= [];
                events.push(this.asyncTransferEvent(transfer));
            } else {
                index++;
            }
        }
        const sse = this.getSseEvents();
        if (!events) {
            return sse;
        }
        events.push(...sse);
        return events;
    }

    /**
     * Starts an asynchronous transfer: on the background worker, so it runs while the app keeps
     * going like on a device, or else queued to run synchronously on the next message port poll.
     */
    private queueTransfer(port: RoMessagePort, options: RequestOptions) {
        this.failureReason = "";
        if (!this.startAsyncTransfer(options)) {
            port.pushCallback(() => this.executeRequest(options));
        }
    }

    /**
     * Runs a transfer on the background worker. Returns `false` if it can't run there, including
     * when it would fail before reaching the network: the synchronous path reports those.
     */
    private startAsyncTransfer(options: RequestOptions): boolean {
        const bodyFilePath = options.bodyFilePath;
        if (
            !backgroundAvailable() ||
            this.missingCertificates() ||
            (bodyFilePath && !this.fs.existsSync(bodyFilePath))
        ) {
            return false;
        }
        const body = bodyFilePath ? this.fs.readFileSync(bodyFilePath) : options.body;
        const job = startBackgroundJob<HttpJobResult>({
            kind: "http",
            http: {
                method: this.requestMethod(options.method),
                url: BrsDevice.getCORSProxy(this.url),
                user: this.user,
                password: this.password,
                headers: [...this.customHeaders],
                withCredentials: this.cookiesEnabled,
                responseType: options.responseType,
                // A copy owned by the job (it's transferred), never the file system's cached buffer
                body: typeof body === "string" || !body ? body : new Uint8Array(body),
            },
        });
        if (!job) {
            return false;
        }
        this.asyncTransfers.push({ job, options, url: this.url, host: this.host });
        return true;
    }

    /** Builds the event of a settled asynchronous transfer, saving its response to a file if requested. */
    private asyncTransferEvent(transfer: AsyncTransfer): RoURLEvent {
        const { job, options } = transfer;
        if (!job.result) {
            // The background worker was lost: run the transfer synchronously instead
            return this.executeRequest(options);
        }
        if (job.result.failure !== undefined) {
            // The thread couldn't receive the result (e.g. too large)
            this.failureReason = job.result.failure;
            this.logTransferError(options, transfer.url, this.failureReason);
            return new RoURLEvent(this.identity, transfer.host, "", -1, this.failureReason, "");
        }
        const { meta, payload } = job.result;
        const status = meta.status;
        this.failureReason = meta.statusText;
        if (meta.error) {
            this.logTransferError(options, transfer.url, meta.error);
        }
        // Copied out of shared memory only when used: TextDecoder rejects shared views, and a
        // saved file must outlive the buffer (`Buffer.from` then wraps the copy without another)
        if (options.outFile && status === 200) {
            this.saveDownloadedFile(options.outFile, payload.slice().buffer);
        }
        const text = options.responseType === "text" ? textDecoder.decode(payload.slice()) : "";
        return new RoURLEvent(this.identity, transfer.host, text, status, this.failureReason, meta.headers);
    }

    /** Stops every running asynchronous transfer. */
    private cancelAsyncTransfers() {
        for (const transfer of this.asyncTransfers) {
            transfer.job.cancel();
        }
        this.asyncTransfers.length = 0;
    }

    /** Polled on every message port iteration; drains the active SSE transfer, if any. */
    private getSseEvents(): readonly BrsEvent[] {
        if (!this.sseTransfer || !this.sseTransport) {
            return NoEvents;
        }
        const events: BrsEvent[] = [];
        for (const payload of this.sseTransport.poll()) {
            const transfer = this.sseTransfer;
            if (!transfer) {
                break;
            }
            this.applySsePayload(transfer, payload, events);
        }
        return events;
    }

    private applySsePayload(transfer: SseTransfer, payload: SseEventPayload, events: BrsEvent[]) {
        switch (payload.type) {
            case "response": {
                transfer.status = payload.status;
                transfer.statusText = payload.statusText;
                transfer.headers = payload.headers;
                transfer.isStream =
                    payload.status >= 200 &&
                    payload.status < 300 &&
                    payload.contentType.toLowerCase().startsWith("text/event-stream");
                break;
            }
            case "chunk": {
                if (transfer.isStream) {
                    this.pushServerEvents(transfer, transfer.parser.feed(payload.text), events);
                } else {
                    transfer.body.push(payload.text);
                }
                break;
            }
            case "end": {
                if (transfer.isStream) {
                    this.pushServerEvents(transfer, transfer.parser.end(), events);
                }
                this.failureReason = transfer.statusText;
                const body = transfer.isStream ? "" : transfer.body.join("");
                events.push(this.newUrlEvent(body, transfer.status, this.failureReason, transfer.headers));
                this.stopSse();
                break;
            }
            case "error": {
                this.failureReason = payload.message;
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`warning,[asyncGetSSEvents] Error getting ${this.url}: ${payload.message}`);
                }
                events.push(this.newUrlEvent("", payload.code, payload.message, transfer.headers));
                this.stopSse();
                break;
            }
        }
    }

    private pushServerEvents(transfer: SseTransfer, received: ServerSentEvent[], events: BrsEvent[]) {
        for (const sse of received) {
            if (sse.hasId) {
                this.lastSseEventId = sse.id;
            }
            if (sse.hasRetry) {
                this.lastSseRetry = sse.retry;
            }
            if (!transfer.started) {
                transfer.started = true;
                events.push(
                    this.newUrlEvent("", transfer.status, transfer.statusText, transfer.headers, UrlEventType.Started)
                );
            }
            events.push(new RoSSEvent(this.identity, sse));
        }
    }

    private newUrlEvent(
        body: string,
        status: number,
        reason: string,
        headers: string,
        eventType: UrlEventType = UrlEventType.Completed
    ) {
        return new RoURLEvent(this.identity, this.host, body, status, reason, headers, eventType);
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
                this.queueTransfer(this.port, Transfers.getToString);
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
                this.queueTransfer(this.port, { ...Transfers.getToFile, outFile: filePath.value });
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
            this.stopSse();
            this.cancelAsyncTransfers();
            if (this.port) {
                this.failureReason = "";
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
                this.queueTransfer(this.port, Transfers.head);
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
                this.queueTransfer(this.port, { ...Transfers.postFromString, body: request.value });
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
                const body: string = this.fs.readFileSync(filePath.value, "utf8");
                this.queueTransfer(this.port, { ...Transfers.postFromString, body });
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
                const options = {
                    ...Transfers.postFromFileToFile,
                    bodyFilePath: fromFile.value,
                    outFile: toFile.value,
                };
                this.queueTransfer(this.port, options);
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
            return new BrsString(encodeUriComponentStrict(text.value));
        },
    });

    /** URL encode the specified string per RFC 3986 and return the encoded string. */
    private readonly urlEncode = new Callable("urlEncode", {
        signature: {
            args: [new StdlibArgument("text", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, text: BrsString) => {
            return new BrsString(encodeUriComponentStrict(text.value));
        },
    });

    /** Decode the specified string per RFC 3986 and return the unencoded string. */
    private readonly unescape = new Callable("unescape", {
        signature: {
            args: [new StdlibArgument("text", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, text: BrsString) => {
            return new BrsString(decodeURIComponent(text.value));
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
            args: [new StdlibArgument("version", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, version: BrsString) => {
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

    /** Enables server-sent event handling on the transfer and starts reading the event stream. */
    private readonly asyncGetSSEvents = new Callable("asyncGetSSEvents", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            if (!this.port) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write("warning,No message port assigned to this roUrlTransfer instance!");
                }
                return BrsBoolean.False;
            }
            return BrsBoolean.from(this.startSse(this.port));
        },
    });

    /** Returns the id of the last server-sent event received in the previous SSE transfer. */
    private readonly sseLastEventId = new Callable("sseLastEventId", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.lastSseEventId);
        },
    });

    /** Returns the reconnection interval (ms) sent by the server in the previous SSE transfer, or 0. */
    private readonly sseRetry = new Callable("sseRetry", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.lastSseRetry);
        },
    });

    /** Clears the last event id, suppressing the automatic `Last-Event-ID` header. */
    private readonly sseClearLastEventId = new Callable("sseClearLastEventId", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.lastSseEventId = "";
            return BrsInvalid.Instance;
        },
    });
}

/** Chooses the SSE transport at compile time: the browser streams via the main thread, Node via a helper process. */
function createSseTransport(onError?: (message: string) => void): SseTransport {
    /// #if BROWSER
    return new SseBridge(onError);
    /// #else
    return new SseNodeBridge(onError); // NOSONAR - ifdef-selected branch, not truly unreachable
    /// #endif
}
