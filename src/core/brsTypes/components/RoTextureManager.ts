import {
    Callable,
    ValueKind,
    StdlibArgument,
    BrsBoolean,
    BrsType,
    BrsComponent,
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
import { Interpreter } from "../../interpreter";
import { validUri } from "../../FileSystem";
import { download } from "../../interpreter/Network";
import { RoTextureRequestEvent } from "../events/RoTextureRequestEvent";
import { drawObjectToComponent } from "../interfaces/IfDraw2D";
import { BrsHttpAgent, IfHttpAgent } from "../interfaces/IfHttpAgent";
import { IfGetMessagePort, IfSetMessagePort } from "../interfaces/IfMessagePort";
import { BrsDevice } from "../../BrsDevice";

// Singleton instance of RoTextureManager
let textureManager: RoTextureManager;

export class RoTextureManager extends BrsComponent implements BrsValue, BrsHttpAgent {
    readonly kind = ValueKind.Object;
    private readonly interpreter: Interpreter;
    private readonly textures: Map<string, RoBitmap>;
    readonly requests: Map<number, RoTextureRequest>;
    readonly customHeaders: Map<string, string>;
    private port?: RoMessagePort;
    cookiesEnabled: boolean;

    constructor(interpreter: Interpreter) {
        super("roTextureManager");
        this.interpreter = interpreter;
        this.cookiesEnabled = false;
        this.requests = new Map<number, RoTextureRequest>();
        this.textures = new Map<string, RoBitmap>();
        this.customHeaders = new Map<string, string>();
        const ifHttpAgent = new IfHttpAgent(this);
        const setPortIface = new IfSetMessagePort(this, this.getNewEvents.bind(this));
        const getPortIface = new IfGetMessagePort(this);
        this.registerMethods({
            ifTextureManager: [
                this.requestTexture,
                this.cancelRequest,
                this.unloadBitmap,
                this.cleanup,
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

    toString(parent?: BrsType): string {
        return "<Component: roTextureManager>";
    }

    equalTo(other: BrsType): BrsBoolean {
        return BrsBoolean.False;
    }

    count() {
        return this.textures.size;
    }

    private getNewEvents() {
        const events: RoTextureRequestEvent[] = [];
        for (let request of this.requests.values()) {
            events.push(this.createEvent(request));
            this.requests.delete(request.identity);
        }
        return events;
    }

    private createEvent(request: RoTextureRequest) {
        let bitmap = this.loadTexture(request.uri) ?? BrsInvalid.Instance;
        if (bitmap instanceof RoBitmap && bitmap.isValid()) {
            if (
                request.size &&
                (request.size.width !== bitmap.width || request.size.height !== bitmap.height)
            ) {
                const newDim = toAssociativeArray(request.size);
                const newBmp = new RoBitmap(this.interpreter, newDim);
                const scaleX = request.size.width / bitmap.width;
                const scaleY = request.size.height / bitmap.height;
                const valid = drawObjectToComponent(
                    newBmp,
                    bitmap,
                    0,
                    0,
                    scaleX,
                    scaleY,
                    undefined,
                    request.scaleMode
                );
                bitmap = valid ? newBmp : BrsInvalid.Instance;
            }
        }
        request.state =
            bitmap instanceof RoBitmap && bitmap.isValid()
                ? RequestState.Ready
                : RequestState.Failed;
        return new RoTextureRequestEvent(request, bitmap);
    }

    loadTexture(uri: string): RoBitmap | undefined {
        const bitmap = this.textures.get(uri);
        if (bitmap) {
            return bitmap;
        }
        let data: ArrayBuffer | undefined;
        if (uri.startsWith("http")) {
            data = download(uri, "arraybuffer", this.customHeaders, this.cookiesEnabled);
        } else {
            try {
                return BrsDevice.fileSystem.readFileSync(request.uri);
            } catch (err: any) {
                if (this.interpreter.isDevMode) {
                    this.interpreter.stderr.write(
                        `warning,[roTextureManager] Error requesting texture ${uri}: ${err.message}`
                    );
                }
            }
        }
        if (data) {
            const bitmap = new RoBitmap(this.interpreter, data);
            if (bitmap instanceof RoBitmap && bitmap.isValid()) {
                this.textures.set(uri, bitmap);
                return bitmap;
            }
        }
        return undefined;
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
                this.interpreter.stderr.write(
                    `warning,*** ERROR: Missing or invalid PHY: '${req.uri}'`
                );
                req.state = RequestState.Failed;
                this.port?.pushMessage(new RoTextureRequestEvent(req, BrsInvalid.Instance));
            } else if (req.async) {
                this.requests.set(req.identity, req);
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
            return Uninitialized.Instance;
        },
    });

    /** Removes all bitmaps from the roTextureManager. */
    private readonly cleanup = new Callable("cleanup", {
        signature: { args: [], returns: ValueKind.Void },
        impl: (_: Interpreter) => {
            this.textures.clear();
            return Uninitialized.Instance;
        },
    });
}

// Function to get the singleton instance of RoTextureManager
export function getTextureManager(interpreter: Interpreter): RoTextureManager {
    if (!textureManager) {
        textureManager = new RoTextureManager(interpreter);
    }
    return textureManager;
}
