import { BrsValue, ValueKind, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsEvent, BrsType, Double, KeyEvent, RoUniversalControlEvent } from "..";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { Float } from "../Float";
import { RoMessagePort } from "./RoMessagePort";
import {
    BrsCanvas,
    BrsCanvasContext2D,
    BrsDraw2D,
    createNewCanvas,
    drawImageToContext,
    drawObjectToComponent,
    IfDraw2D,
    releaseCanvas,
    rgbaIntToHex,
} from "../interfaces/IfDraw2D";
import { DataType, keyArraySpots, keyBufferSize, RemoteType } from "../../common";
import { IfSetMessagePort, IfGetMessagePort } from "../interfaces/IfMessagePort";
import { BrsDevice } from "../../device/BrsDevice";

export class RoScreen extends BrsComponent implements BrsValue, BrsDraw2D {
    readonly kind = ValueKind.Object;
    readonly x: number = 0;
    readonly y: number = 0;
    readonly width: number;
    readonly height: number;
    private readonly doubleBuffer: boolean;
    private readonly maxMs: number;
    private readonly disposeCanvas: boolean;
    private readonly valid: boolean;
    private readonly keysBuffer: KeyEvent[];
    private alphaEnable: boolean;
    private currentBuffer: number;
    private lastBuffer: number;
    private canvas: BrsCanvas[];
    private context: BrsCanvasContext2D[];
    private port?: RoMessagePort;
    private isDirty: boolean;
    private lastMessage: number;
    private lastKey: number;
    private lastMod: number;

    constructor(doubleBuffer?: BrsBoolean, width?: Int32, height?: Int32) {
        super("roScreen");

        let defaultWidth = 854;
        let defaultHeight = 480;
        if (BrsDevice.deviceInfo.displayMode === "1080p") {
            defaultWidth = 1920;
            defaultHeight = 1080;
        } else if (BrsDevice.deviceInfo.displayMode === "720p") {
            defaultWidth = 1280;
            defaultHeight = 720;
        }
        this.disposeCanvas = BrsDevice.deviceInfo.platform?.inIOS ?? false;
        this.lastMessage = performance.now();
        this.isDirty = true;
        this.width = defaultWidth;
        this.height = defaultHeight;
        this.valid = true;
        this.lastKey = -1;
        this.lastMod = -1;
        this.keysBuffer = [];
        if (width instanceof Float || width instanceof Double || width instanceof Int32) {
            this.width = Math.trunc(width.getValue());
            if (this.width <= 0) {
                this.width = defaultWidth;
            }
        } else if (width !== undefined) {
            this.valid = false;
        }
        if (height instanceof Float || height instanceof Double || height instanceof Int32) {
            this.height = Math.trunc(height.getValue());
            if (this.height <= 0) {
                this.height = defaultHeight;
            }
        } else if (height !== undefined) {
            this.valid = false;
        }
        this.doubleBuffer = false;
        if (doubleBuffer instanceof BrsBoolean) {
            this.doubleBuffer = doubleBuffer.toBoolean();
        } else if (doubleBuffer !== undefined) {
            this.valid = false;
        }
        this.currentBuffer = 0;
        this.lastBuffer = 0;
        this.canvas = new Array<BrsCanvas>(this.doubleBuffer ? 2 : 1);
        this.context = new Array<BrsCanvasContext2D>(this.doubleBuffer ? 2 : 1);
        this.createDisplayBuffer();
        this.alphaEnable = false;
        const maxFps = BrsDevice.deviceInfo.maxFps;
        this.maxMs = Math.trunc((1 / maxFps) * 1000);
        const ifDraw2D = new IfDraw2D(this);
        const ifSetMsgPort = new IfSetMessagePort(this, this.getNewEvents.bind(this));
        const ifGetMsgPort = new IfGetMessagePort(this);
        this.registerMethods({
            ifScreen: [this.swapBuffers],
            ifDraw2D: [
                ifDraw2D.clear,
                ifDraw2D.drawObject,
                ifDraw2D.drawRotatedObject,
                ifDraw2D.drawScaledObject,
                ifDraw2D.drawTransformedObject,
                ifDraw2D.drawLine,
                ifDraw2D.drawPoint,
                ifDraw2D.drawRect,
                ifDraw2D.drawText,
                ifDraw2D.finish,
                ifDraw2D.getAlphaEnable,
                ifDraw2D.setAlphaEnable,
                ifDraw2D.getByteArray,
                ifDraw2D.getPng,
                ifDraw2D.getWidth,
                ifDraw2D.getHeight,
            ],
            ifSetMessagePort: [ifSetMsgPort.setMessagePort, ifSetMsgPort.setPort],
            ifGetMessagePort: [ifGetMsgPort.getMessagePort, ifGetMsgPort.getPort],
        });
    }

    createDisplayBuffer() {
        for (let index = 0; index < this.canvas.length; index++) {
            this.canvas[index] = createNewCanvas(this.width, this.height);
            if (this.canvas[index]) {
                this.context[index] = this.canvas[index].getContext("2d") as BrsCanvasContext2D;
                this.canvas[index].width = this.width;
                this.canvas[index].height = this.height;
            }
        }
    }

    getCanvas(): BrsCanvas {
        return this.canvas[this.lastBuffer];
    }

    getRgbaCanvas(_: number): BrsCanvas {
        return this.canvas[this.lastBuffer];
    }

    getContext(): BrsCanvasContext2D {
        return this.context[this.currentBuffer];
    }

    clearCanvas(rgba: number) {
        let ctx = this.context[this.currentBuffer];
        ctx.fillStyle = rgbaIntToHex(rgba, false);
        ctx.fillRect(0, 0, this.width, this.height);
        this.isDirty = true;
    }

    drawImage(
        object: BrsComponent,
        x: number,
        y: number,
        scaleX: number = 1,
        scaleY: number = 1,
        rgba?: number
    ): boolean {
        this.isDirty = drawObjectToComponent(this, object, x, y, scaleX, scaleY, rgba);
        return this.isDirty;
    }

    drawImageToContext(image: BrsCanvas, x: number, y: number): boolean {
        const ctx = this.context[this.currentBuffer];
        this.isDirty = drawImageToContext(ctx, image, this.alphaEnable, x, y);
        return this.isDirty;
    }

    setCanvasAlpha(enable: boolean) {
        this.alphaEnable = enable;
        return BrsInvalid.Instance;
    }

    getCanvasAlpha(): boolean {
        return this.alphaEnable;
    }

    toString(parent?: BrsType): string {
        return "<Component: roScreen>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    makeDirty() {
        this.isDirty = true;
    }

    finishDraw(): void {
        if (!this.doubleBuffer && this.isDirty) {
            postMessage(this.context[0].getImageData(0, 0, this.width, this.height));
            this.isDirty = false;
        }
    }

    dispose() {
        this.port?.unregisterCallback(this.getComponentName());
        if (this.disposeCanvas) {
            for (const c of this.canvas) {
                releaseCanvas(c);
            }
        }
    }
    isValid() {
        return this.valid;
    }

    // Control Key Events
    private getNewEvents() {
        const events: BrsEvent[] = [];
        this.updateKeysBuffer();
        const nextKey = this.keysBuffer.shift();
        if (nextKey && nextKey.key !== this.lastKey) {
            if (BrsDevice.singleKeyEvents) {
                if (nextKey.mod === 0) {
                    if (this.lastMod === 0) {
                        this.keysBuffer.unshift({ ...nextKey });
                        nextKey.key = this.lastKey + 100;
                        nextKey.mod = 100;
                    }
                } else if (nextKey.key !== this.lastKey + 100) {
                    return events;
                }
            }
            BrsDevice.lastKeyTime = BrsDevice.currKeyTime;
            BrsDevice.currKeyTime = Date.now();
            this.lastKey = nextKey.key;
            this.lastMod = nextKey.mod;
            events.push(new RoUniversalControlEvent(nextKey));
        }
        return events;
    }

    private updateKeysBuffer() {
        for (let i = 0; i < keyBufferSize; i++) {
            const idx = i * keyArraySpots;
            const key = Atomics.load(BrsDevice.sharedArray, DataType.KEY + idx);
            if (key === -1) {
                return;
            } else if (this.keysBuffer.length === 0 || key !== this.keysBuffer.at(-1)?.key) {
                const remoteId = Atomics.load(BrsDevice.sharedArray, DataType.RID + idx);
                const remoteType = Math.trunc(remoteId / 10) * 10;
                const remoteStr = RemoteType[remoteType] ?? RemoteType[RemoteType.SIM];
                const remoteIdx = remoteId - remoteType;
                const mod = Atomics.load(BrsDevice.sharedArray, DataType.MOD + idx);
                Atomics.store(BrsDevice.sharedArray, DataType.KEY + idx, -1);
                this.keysBuffer.push({ remote: `${remoteStr}:${remoteIdx}`, key: key, mod: mod });
                BrsDevice.lastRemote = remoteIdx;
            }
        }
    }

    // ifScreen ------------------------------------------------------------------------------------

    /** If the screen is double buffered, SwapBuffers swaps the back buffer with the front buffer */
    private readonly swapBuffers = new Callable("swapBuffers", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            if (this.isDirty) {
                let timeStamp = performance.now();
                while (timeStamp - this.lastMessage < this.maxMs) {
                    timeStamp = performance.now();
                }
                postMessage(this.context[this.currentBuffer].getImageData(0, 0, this.width, this.height));
                if (this.doubleBuffer) {
                    this.lastBuffer = this.currentBuffer;
                    this.currentBuffer++;
                    if (this.currentBuffer === this.canvas.length) {
                        this.currentBuffer = 0;
                    }
                }
                this.clearCanvas(0xff);
                this.isDirty = false;
                this.lastMessage = timeStamp;
            }
            return BrsInvalid.Instance;
        },
    });
}

export function createScreen(doubleBuffer?: BrsBoolean, width?: Int32, height?: Int32) {
    if ((width !== undefined && height === undefined) || (width === undefined && height !== undefined)) {
        return BrsInvalid.Instance;
    }
    const screen = new RoScreen(doubleBuffer, width, height);
    return screen.isValid() ? screen : BrsInvalid.Instance;
}
