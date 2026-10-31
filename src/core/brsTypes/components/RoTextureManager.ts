import {
    Callable,
    ValueKind,
    StdlibArgument,
    BrsBoolean,
    BrsType,
    BrsValue,
    Uninitialized,
    RoMessagePort,
    RoTextureRequest,
    RequestState,
    BrsString,
    RoBitmap,
    BrsInvalid,
    toAssociativeArray,
} from "..";
import { BrsComponent } from "./BrsComponent";
import { Interpreter } from "../../interpreter";
import { getVolume, validUri } from "../../device/FileSystem";
import { download } from "../../interpreter/Network";
import { RoTextureRequestEvent } from "../events/RoTextureRequestEvent";
import { drawBitmapOnBitmap } from "../interfaces/IfDraw2D";
import { BrsHttpAgent, IfHttpAgent } from "../interfaces/IfHttpAgent";
import { IfGetMessagePort, IfSetMessagePort } from "../interfaces/IfMessagePort";
import { BrsDevice } from "../../device/BrsDevice";
import { DefaultCertificatesFile } from "../../common";
import {
    BackgroundJob,
    HttpJobParams,
    ImageJobResult,
    backgroundAvailable,
    startBackgroundJob,
} from "../../device/BackgroundWorker";

/** How long a synchronous load waits for the same image already loading in the background. */
const SyncWaitMs = 30000;
const NoEvents: readonly RoTextureRequestEvent[] = Object.freeze([]);

// Singleton instance of RoTextureManager
let textureManager: RoTextureManager;

export class RoTextureManager extends BrsComponent implements BrsValue, BrsHttpAgent {
    readonly kind = ValueKind.Object;
    private readonly textures: Map<string, RoBitmap>;
    private readonly failedLocalUris: Set<string>;
    private readonly brsFS = BrsDevice.fileSystem;
    readonly requests: Map<number, RoTextureRequest>;
    /** Images loading in the background, each shared by every request for its URI. */
    private readonly jobs: Map<string, BackgroundJob<ImageJobResult>>;
    private port?: RoMessagePort;
    // ifHttpAgent Interface
    readonly customHeaders: Map<string, string>;
    cookiesEnabled: boolean;
    certificatesFile: string;

    constructor() {
        super("roTextureManager");
        this.cookiesEnabled = false;
        this.certificatesFile = DefaultCertificatesFile;
        this.requests = new Map<number, RoTextureRequest>();
        this.textures = new Map<string, RoBitmap>();
        this.jobs = new Map<string, BackgroundJob<ImageJobResult>>();
        this.failedLocalUris = new Set<string>();
        this.customHeaders = new Map<string, string>();
        const ifHttpAgent = new IfHttpAgent(this);
        const setPortIface = new IfSetMessagePort(this, this.getNewEvents.bind(this));
        const getPortIface = new IfGetMessagePort(this);
        this.registerMethods({
            ifTextureManager: [this.requestTexture, this.cancelRequest, this.unloadBitmap, this.cleanup],
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
        this.brsFS.subscribeUmount("roTextureManager", this.volumeUnmounted.bind(this));
    }

    toString(parent?: BrsType): string {
        return "<Component: roTextureManager>";
    }

    equalTo(other: BrsType): BrsBoolean {
        return BrsBoolean.False;
    }

    count() {
        return this.textures.size;
    }

    dispose() {
        this.textures.clear();
        for (const job of this.jobs.values()) {
            job.cancel();
        }
        this.jobs.clear();
        this.port?.removeReference();
    }

    /**
     * Called on every message port poll. Asynchronous requests whose image is still loading in the
     * background stay queued, so the app keeps running meanwhile, like on a device; the rest are
     * delivered in request order.
     */
    private getNewEvents(): readonly RoTextureRequestEvent[] {
        if (this.requests.size === 0) {
            return NoEvents;
        }
        let failed: Set<string> | undefined;
        for (const [uri, job] of this.jobs) {
            if (job.poll()) {
                this.jobs.delete(uri);
                if (this.applyJobResult(uri, job) === null) {
                    failed ??= new Set<string>();
                    failed.add(uri);
                }
            }
        }
        const events: RoTextureRequestEvent[] = [];
        for (const request of this.requests.values()) {
            if (this.jobs.has(request.uri)) {
                continue;
            }
            events.push(this.createEvent(request, failed?.has(request.uri) ? null : undefined));
            this.requests.delete(request.identity);
        }
        return events;
    }

    /**
     * Caches a settled job's bitmap and returns it. Returns `null` if the download or decode
     * failed, and `undefined` if the job was lost with its worker (load the image synchronously).
     */
    private applyJobResult(uri: string, job: BackgroundJob<ImageJobResult>): RoBitmap | null | undefined {
        const result = job.result;
        if (!result) {
            return undefined;
        }
        const { width, height, error } = result.meta;
        if (error) {
            if (BrsDevice.isDevMode) {
                BrsDevice.stderr.write(`warning,[roTextureManager] Error requesting texture ${uri}: ${error}`);
            }
            return null;
        }
        return this.cacheTexture(uri, new RoBitmap({ width, height, data: result.payload }, uri));
    }

    /**
     * Starts loading an asynchronous request's image in the background: downloading it (remote
     * URIs) and decoding it. Does nothing if it's cached or already loading; if it can't run in the
     * background, the image is loaded synchronously when the request is delivered.
     */
    private startJob(request: RoTextureRequest) {
        const uri = request.uri;
        if (this.textures.has(uri) || this.jobs.has(uri) || !backgroundAvailable()) {
            return;
        }
        let job: BackgroundJob<ImageJobResult> | undefined;
        if (uri.startsWith("http")) {
            job = startBackgroundJob({ kind: "image", http: this.downloadParams(uri) });
        } else {
            const data = this.loadLocalFile(uri);
            if (data) {
                // A copy owned by the job (it's transferred), never the file system's cached buffer
                job = startBackgroundJob({ kind: "image", image: new Uint8Array(data) });
            }
        }
        if (job) {
            this.jobs.set(uri, job);
        }
    }

    private downloadParams(uri: string): HttpJobParams {
        return {
            method: "GET",
            url: BrsDevice.getCORSProxy(uri),
            headers: [...this.customHeaders],
            withCredentials: this.cookiesEnabled,
            responseType: "arraybuffer",
        };
    }

    /** Builds a request's event; `bitmap` is `null` if its image already failed to load. */
    private createEvent(
        request: RoTextureRequest,
        bitmap: RoBitmap | null | undefined = this.loadTexture(request.uri)
    ) {
        if (bitmap?.isValid()) {
            const needsResize =
                !!request.size &&
                request.size.width > 0 &&
                request.size.height > 0 &&
                (request.size.width !== bitmap.width || request.size.height !== bitmap.height);
            // A drawable request always gets its own unique, uncached bitmap (never the one shared
            // out of `this.textures`), even when no resize was requested. A resize also always
            // produces its own private copy, so it's implicitly drawable too — there's no shared
            // cache entry left to protect from being mutated out from under another request.
            if (needsResize || request.drawable) {
                const width = needsResize ? request.size!.width : bitmap.width;
                const height = needsResize ? request.size!.height : bitmap.height;
                const newDim = toAssociativeArray({ width, height });
                const newBmp = new RoBitmap(newDim);
                drawBitmapOnBitmap(bitmap, newBmp, request.scaleMode);
                newBmp.drawable = request.drawable || needsResize;
                bitmap = newBmp;
            }
        }
        request.state = bitmap?.isValid() ? RequestState.Ready : RequestState.Failed;
        return new RoTextureRequestEvent(request, bitmap ?? BrsInvalid.Instance);
    }

    private volumeUnmounted(volume: string) {
        for (const uri of [...this.textures.keys(), ...this.failedLocalUris, ...this.jobs.keys()]) {
            if (getVolume(uri) === volume) {
                this.textures.delete(uri);
                this.failedLocalUris.delete(uri);
                this.jobs.get(uri)?.cancel();
                this.jobs.delete(uri);
            }
        }
    }

    loadTexture(uri: string, headers?: Map<string, string>): RoBitmap | undefined {
        const bitmap = this.textures.get(uri);
        if (bitmap) {
            return bitmap;
        }
        const job = this.jobs.get(uri);
        if (job) {
            // Already loading in the background: wait for it rather than loading the image twice.
            this.jobs.delete(uri);
            if (job.wait(SyncWaitMs)) {
                const loaded = this.applyJobResult(uri, job);
                if (loaded !== undefined) {
                    return loaded ?? undefined;
                }
            } else {
                job.cancel();
            }
        }
        const data = this.loadData(uri, headers);
        if (data) {
            const bitmap = new RoBitmap(data, uri);
            if (bitmap.isValid()) {
                return this.cacheTexture(uri, bitmap);
            }
        }
        return undefined;
    }

    /** Stops loading an image in the background once no request is waiting for it. */
    private cancelUnusedJob(uri: string) {
        const job = this.jobs.get(uri);
        if (!job) {
            return;
        }
        for (const request of this.requests.values()) {
            if (request.uri === uri) {
                return;
            }
        }
        job.cancel();
        this.jobs.delete(uri);
    }

    private cacheTexture(uri: string, bitmap: RoBitmap) {
        // Cached/shared bitmaps are never drawable — a drawable request always gets its own
        // unique copy, made in `createEvent()`.
        bitmap.drawable = false;
        this.textures.set(uri, bitmap);
        return bitmap;
    }

    private loadData(uri: string, headers?: Map<string, string>): Buffer | undefined {
        if (uri.startsWith("http")) {
            return download(
                BrsDevice.getCORSProxy(uri),
                "arraybuffer",
                headers ?? this.customHeaders,
                this.cookiesEnabled
            );
        }
        return this.loadLocalFile(uri);
    }

    resizeTexture(bitmap: RoBitmap, width: number, height: number) {
        if (bitmap.isValid() && width > 0 && height > 0 && (width !== bitmap.width || height !== bitmap.height)) {
            const newDim = toAssociativeArray({ width, height });
            const newBmp = new RoBitmap(newDim);
            drawBitmapOnBitmap(bitmap, newBmp, 1);
            return newBmp;
        }
        return bitmap;
    }

    private loadLocalFile(uri: string) {
        if (this.failedLocalUris.has(uri)) {
            return undefined;
        }
        try {
            const fsys = BrsDevice.fileSystem;
            let assetPath = uri;
            if (uri.startsWith("pkg:/locale/images/") && !fsys.existsSync(uri)) {
                const locale = BrsDevice.deviceInfo.locale;
                const filePath = uri.substring("pkg:/locale/images/".length);
                if (fsys.existsSync(`pkg:/locale/${locale}/images/${filePath}`)) {
                    assetPath = `pkg:/locale/${locale}/images/${filePath}`;
                } else if (fsys.existsSync(`pkg:/locale/default/images/${filePath}`)) {
                    assetPath = `pkg:/locale/default/images/${filePath}`;
                } else if (fsys.existsSync(`pkg:/locale/en_US/images/${filePath}`)) {
                    assetPath = `pkg:/locale/en_US/images/${filePath}`;
                }
            }
            return fsys.readFileSync(assetPath);
        } catch (err: any) {
            this.failedLocalUris.add(uri);
            if (BrsDevice.isDevMode) {
                BrsDevice.stderr.write(`warning,[roTextureManager] Error requesting texture ${uri}: ${err.message}`);
            }
        }
    }

    /** Makes a request for an roBitmap with the attributes specified by the roTextureRequest. */
    private readonly requestTexture = new Callable("requestTexture", {
        signature: {
            args: [new StdlibArgument("req", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, req: RoTextureRequest) => {
            if (!(req instanceof RoTextureRequest)) {
                return Uninitialized.Instance;
            }
            if (!validUri(req.uri)) {
                BrsDevice.stderr.write(`warning,*** ERROR: Missing or invalid PHY: '${req.uri}'`);
                req.state = RequestState.Failed;
                this.port?.pushMessage(new RoTextureRequestEvent(req, BrsInvalid.Instance));
            } else if (req.async) {
                this.requests.set(req.identity, req);
                this.startJob(req);
            } else if (this.port) {
                this.port.pushMessage(this.createEvent(req));
            }
            return Uninitialized.Instance;
        },
    });

    /** Cancels the request specified by req, which should be an roTextureRequest previously passed to the RequestTexture() method. */
    private readonly cancelRequest = new Callable("cancelRequest", {
        signature: {
            args: [new StdlibArgument("req", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, req: RoTextureRequest) => {
            if (req instanceof RoTextureRequest && this.requests.has(req.identity)) {
                req.state = RequestState.Cancelled;
                this.requests.delete(req.identity);
                this.cancelUnusedJob(req.uri);
            }
            return Uninitialized.Instance;
        },
    });

    /** Removes a bitmap from the roTextureManager with the specified URL. */
    private readonly unloadBitmap = new Callable("unloadBitmap", {
        signature: {
            args: [new StdlibArgument("url", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, url: BrsString) => {
            this.textures.delete(url.value);
            this.failedLocalUris.delete(url.value);
            return Uninitialized.Instance;
        },
    });

    /** Removes all bitmaps from the roTextureManager. */
    private readonly cleanup = new Callable("cleanup", {
        signature: { args: [], returns: ValueKind.Void },
        impl: (_: Interpreter) => {
            this.textures.clear();
            this.failedLocalUris.clear();
            return Uninitialized.Instance;
        },
    });
}

// Function to get the singleton instance of RoTextureManager
export function getTextureManager(): RoTextureManager {
    textureManager ||= new RoTextureManager();
    return textureManager;
}
