import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, Double } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { Float } from "../Float";
import { rgbaIntToHex } from "./RoBitmap";
import { RoMessagePort } from "./RoMessagePort";
import { RoFont } from "./RoFont";
import { RoByteArray } from "./RoByteArray";
import {
    WorkerCanvas,
    WorkerCanvasRenderingContext2D,
    createNewCanvas,
    drawImageToContext,
    drawObjectToComponent,
    drawRotatedObject,
    releaseCanvas,
} from "../draw2d";
import UPNG from "upng-js";

export class RoScreen extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private alphaEnable: boolean;
    private doubleBuffer: boolean;
    private currentBuffer: number;
    private lastBuffer: number;
    private width: number;
    private height: number;
    private canvas: WorkerCanvas[];
    private context: WorkerCanvasRenderingContext2D[];
    private port?: RoMessagePort;
    private isDirty: boolean;
    private lastMessage: number;
    private maxMs: number;

    // TODO: Check the Roku behavior on 4:3 resolutions in HD/FHD devices
    constructor(
        interpreter: Interpreter,
        doubleBuffer?: BrsBoolean,
        width?: Int32,
        height?: Int32
    ) {
        super("roScreen");
        let defaultWidth = 854;
        let defaultHeight = 480;
        if (interpreter.deviceInfo.get("displayMode") === "1080p") {
            defaultWidth = 1920;
            defaultHeight = 1080;
        } else if (interpreter.deviceInfo.get("displayMode") === "720p") {
            defaultWidth = 1280;
            defaultHeight = 720;
        }
        this.lastMessage = performance.now();
        this.isDirty = true;
        this.width = defaultWidth;
        this.height = defaultHeight;
        if (width instanceof Float || width instanceof Double || width instanceof Int32) {
            this.width = Math.trunc(width.getValue());
            if (this.width <= 0) {
                this.width = defaultWidth;
            }
        }
        if (height instanceof Float || height instanceof Double || height instanceof Int32) {
            this.height = Math.trunc(height.getValue());
            if (this.height <= 0) {
                this.height = defaultHeight;
            }
        }
        this.doubleBuffer = doubleBuffer instanceof BrsBoolean && doubleBuffer.toBoolean();
        this.currentBuffer = 0;
        this.lastBuffer = 0;
        this.canvas = new Array<WorkerCanvas>(this.doubleBuffer ? 2 : 1);
        this.context = new Array<WorkerCanvasRenderingContext2D>(this.doubleBuffer ? 2 : 1);
        this.createDisplayBuffer();
        this.alphaEnable = false;
        const maxFps = interpreter.deviceInfo.get("maxFps") || 60;
        this.maxMs = Math.trunc((1 / maxFps) * 1000);
        this.registerMethods({
            ifScreen: [this.swapBuffers],
            ifDraw2D: [
                this.clear,
                this.drawObject,
                this.drawRotatedObject,
                this.drawScaledObject,
                this.drawTransformedObject,
                this.drawLine,
                this.drawPoint,
                this.drawRect,
                this.drawText,
                this.finish,
                this.getAlphaEnable,
                this.setAlphaEnable,
                this.getByteArray,
                this.getPng,
                this.getWidth,
                this.getHeight,
            ],
            ifSetMessagePort: [this.setMessagePort, this.setPort],
            ifGetMessagePort: [this.getMessagePort],
        });
    }

    createDisplayBuffer() {
        for (let index = 0; index < this.canvas.length; index++) {
            this.canvas[index] = createNewCanvas(this.width, this.height);
            if (this.canvas[index]) {
                this.context[index] = this.canvas[index].getContext("2d", {
                    alpha: true,
                }) as WorkerCanvasRenderingContext2D;
                this.canvas[index].width = this.width;
                this.canvas[index].height = this.height;
            }
        }
    }

    getImageWidth(): number {
        return this.canvas[this.lastBuffer].width;
    }

    getImageHeight(): number {
        return this.canvas[this.lastBuffer].height;
    }

    getCanvas(): WorkerCanvas {
        return this.canvas[this.lastBuffer];
    }

    getContext(): WorkerCanvasRenderingContext2D {
        return this.context[this.currentBuffer];
    }

    getAlphaEnableValue(): boolean {
        return this.alphaEnable;
    }

    getId(): number {
        return -1;
    }

    clearCanvas(rgba: number) {
        let ctx = this.context[this.currentBuffer];
        ctx.fillStyle = rgbaIntToHex(rgba, false);
        ctx.fillRect(0, 0, this.width, this.height);
        this.isDirty = true;
        return BrsInvalid.Instance;
    }

    drawImage(
        object: BrsComponent,
        rgba: Int32 | BrsInvalid,
        x: number,
        y: number,
        scaleX: number = 1,
        scaleY: number = 1
    ): boolean {
        this.isDirty = drawObjectToComponent(this, object, rgba, x, y, scaleX, scaleY);
        return this.isDirty;
    }

    drawImageToContext(image: WorkerCanvas, x: number, y: number): boolean {
        const ctx = this.context[this.currentBuffer];
        this.isDirty = drawImageToContext(ctx, image, this.alphaEnable, x, y);
        return this.isDirty;
    }

    setCanvasAlpha(enable: boolean) {
        this.alphaEnable = enable;
        return BrsInvalid.Instance;
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

    removeReference(): void {
        super.removeReference();
        if (this.references === 0) {
            this.port?.removeReference();
            this.dispose();
        }
    }

    dispose(): void {
        this.canvas.forEach((c) => releaseCanvas(c));
    }
    // ifScreen ------------------------------------------------------------------------------------

    /** If the screen is double buffered, SwapBuffers swaps the back buffer with the front buffer */
    private swapBuffers = new Callable("swapBuffers", {
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
                postMessage(
                    this.context[this.currentBuffer].getImageData(0, 0, this.width, this.height)
                );
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

    // ifDraw2D  -----------------------------------------------------------------------------------

    /** Clear the bitmap, and fill with the specified RGBA color */
    private clear = new Callable("clear", {
        signature: {
            args: [new StdlibArgument("rgba", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, rgba: Int32) => {
            return this.clearCanvas(rgba.getValue());
        },
    });

    /** Draw the source object, where src is an roBitmap or an roRegion object, at position x,y */
    private drawObject = new Callable("drawObject", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("object", ValueKind.Object),
                new StdlibArgument("rgba", ValueKind.Int32, BrsInvalid.Instance),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (
            _: Interpreter,
            x: Int32,
            y: Int32,
            object: BrsComponent,
            rgba: Int32 | BrsInvalid
        ) => {
            const ctx = this.context[this.currentBuffer];
            this.drawImage(object, rgba, x.getValue(), y.getValue());
            ctx.globalAlpha = 1.0;
            return BrsBoolean.from(this.isDirty);
        },
    });

    /** Draw the source object at position x,y rotated by angle theta degrees. */
    private drawRotatedObject = new Callable("drawRotatedObject", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("theta", ValueKind.Float),
                new StdlibArgument("object", ValueKind.Object),
                new StdlibArgument("rgba", ValueKind.Int32, BrsInvalid.Instance),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (
            _: Interpreter,
            x: Int32,
            y: Int32,
            theta: Float,
            object: BrsComponent,
            rgba: Int32 | BrsInvalid
        ) => {
            const ctx = this.context[this.currentBuffer];
            drawRotatedObject(
                this,
                ctx,
                object,
                rgba,
                x.getValue(),
                y.getValue(),
                theta.getValue()
            );
            return BrsBoolean.from(this.isDirty);
        },
    });

    /** Draw the source object, at position x,y, scaled horizontally by scaleX and vertically by scaleY. */
    private drawScaledObject = new Callable("drawScaledObject", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("scaleX", ValueKind.Float),
                new StdlibArgument("scaleY", ValueKind.Float),
                new StdlibArgument("object", ValueKind.Object),
                new StdlibArgument("rgba", ValueKind.Int32, BrsInvalid.Instance),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (
            _: Interpreter,
            x: Int32,
            y: Int32,
            scaleX: Float,
            scaleY: Float,
            object: BrsComponent,
            rgba: Int32 | BrsInvalid
        ) => {
            const ctx = this.context[this.currentBuffer];
            this.drawImage(
                object,
                rgba,
                x.getValue(),
                y.getValue(),
                scaleX.getValue(),
                scaleY.getValue()
            );
            ctx.globalAlpha = 1.0;
            return BrsBoolean.from(this.isDirty);
        },
    });

    /** Draw the source object, at position x,y, rotated by theta and scaled horizontally by scaleX and vertically by scaleY. */
    private drawTransformedObject = new Callable("drawTransformedObject", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("theta", ValueKind.Float),
                new StdlibArgument("scaleX", ValueKind.Float),
                new StdlibArgument("scaleY", ValueKind.Float),
                new StdlibArgument("object", ValueKind.Object),
                new StdlibArgument("rgba", ValueKind.Int32, BrsInvalid.Instance),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (
            _: Interpreter,
            x: Int32,
            y: Int32,
            theta: Float,
            scaleX: Float,
            scaleY: Float,
            object: BrsComponent,
            rgba: Int32 | BrsInvalid
        ) => {
            const ctx = this.context[this.currentBuffer];
            const positionX = x.getValue();
            const positionY = y.getValue();
            const angleInRad = (-theta.getValue() * Math.PI) / 180;
            ctx.save();
            ctx.translate(positionX, positionY);
            ctx.rotate(angleInRad);
            this.drawImage(object, rgba, 0, 0, scaleX.getValue(), scaleY.getValue());
            ctx.globalAlpha = 1.0;
            ctx.restore();
            return BrsBoolean.from(this.isDirty);
        },
    });

    /** Draw a line from (xStart, yStart) to (xEnd, yEnd) with RGBA color */
    private drawLine = new Callable("drawLine", {
        signature: {
            args: [
                new StdlibArgument("xStart", ValueKind.Int32),
                new StdlibArgument("yStart", ValueKind.Int32),
                new StdlibArgument("xEnd", ValueKind.Int32),
                new StdlibArgument("yEnd", ValueKind.Int32),
                new StdlibArgument("rgba", ValueKind.Int32),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (
            _: Interpreter,
            xStart: Int32,
            yStart: Int32,
            xEnd: Int32,
            yEnd: Int32,
            rgba: Int32
        ) => {
            let ctx = this.context[this.currentBuffer];
            ctx.beginPath();
            ctx.strokeStyle = rgbaIntToHex(rgba.getValue(), this.alphaEnable);
            ctx.moveTo(xStart.getValue(), yStart.getValue());
            ctx.lineTo(xEnd.getValue(), yEnd.getValue());
            ctx.stroke();
            this.isDirty = true;
            return BrsBoolean.True;
        },
    });

    /** Draws a point at (x,y) with the given size and RGBA color */
    private drawPoint = new Callable("drawPoint", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("size", ValueKind.Float),
                new StdlibArgument("rgba", ValueKind.Int32),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, x: Int32, y: Int32, size: Float, rgba: Int32) => {
            let ctx = this.context[this.currentBuffer];
            ctx.fillStyle = rgbaIntToHex(rgba.getValue(), this.alphaEnable);
            ctx.fillRect(x.getValue(), y.getValue(), size.getValue(), size.getValue());
            this.isDirty = true;
            return BrsBoolean.True;
        },
    });

    /** Fill the specified rectangle from left (x), top (y) to right (x + width), bottom (y + height) with the RGBA color */
    private drawRect = new Callable("drawRect", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("width", ValueKind.Int32),
                new StdlibArgument("height", ValueKind.Int32),
                new StdlibArgument("rgba", ValueKind.Int32),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, x: Int32, y: Int32, width: Int32, height: Int32, rgba: Int32) => {
            let ctx = this.context[this.currentBuffer];
            if (!this.alphaEnable) {
                ctx.clearRect(x.getValue(), y.getValue(), width.getValue(), height.getValue());
            }
            ctx.fillStyle = rgbaIntToHex(rgba.getValue(), true);
            ctx.fillRect(x.getValue(), y.getValue(), width.getValue(), height.getValue());
            this.isDirty = true;
            return BrsBoolean.True;
        },
    });

    /** Draws the text at position (x,y) using the specified RGBA color and roFont font object. */
    private drawText = new Callable("drawText", {
        signature: {
            args: [
                new StdlibArgument("text", ValueKind.String),
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("rgba", ValueKind.Int32),
                new StdlibArgument("font", ValueKind.Object),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, text: BrsString, x: Int32, y: Int32, rgba: Int32, font: RoFont) => {
            const ctx = this.context[this.currentBuffer];
            ctx.fillStyle = rgbaIntToHex(rgba.getValue(), true);
            ctx.font = font.toFontString();
            ctx.textBaseline = "top";
            ctx.fillText(text.value, x.getValue(), y.getValue() + font.getTopAdjust());
            this.isDirty = true;
            return BrsBoolean.True;
        },
    });

    /** Realize the bitmap by finishing all queued draw calls. */
    private finish = new Callable("finish", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            if (!this.doubleBuffer && this.isDirty) {
                postMessage(this.context[0].getImageData(0, 0, this.width, this.height));
                this.isDirty = false;
            }
            return BrsInvalid.Instance;
        },
    });

    /** Returns true if alpha blending is enabled */
    private getAlphaEnable = new Callable("getAlphaEnable", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.alphaEnable);
        },
    });

    /** If enable is true, do alpha blending when this bitmap is the destination */
    private setAlphaEnable = new Callable("setAlphaEnable", {
        signature: {
            args: [new StdlibArgument("alphaEnable", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, alphaEnable: BrsBoolean) => {
            return this.setCanvasAlpha(alphaEnable.toBoolean());
        },
    });

    /** Return the width of the screen/bitmap/region. */
    private getWidth = new Callable("getWidth", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.width);
        },
    });

    /** Return the height of the screen/bitmap/region. */
    private getHeight = new Callable("getHeight", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.height);
        },
    });

    /** Returns an roByteArray representing the RGBA pixel values for the rectangle described by the parameters. */
    private getByteArray = new Callable("getByteArray", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("width", ValueKind.Int32),
                new StdlibArgument("height", ValueKind.Int32),
            ],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, x: Int32, y: Int32, width: Int32, height: Int32) => {
            let imgData = this.context[this.lastBuffer].getImageData(
                x.getValue(),
                y.getValue(),
                width.getValue(),
                height.getValue()
            );
            let byteArray = new Uint8Array(imgData.data.buffer);
            return new RoByteArray(byteArray);
        },
    });

    /** Returns an roByteArray object containing PNG image data for the specified area of the bitmap. */
    private getPng = new Callable("getPng", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("width", ValueKind.Int32),
                new StdlibArgument("height", ValueKind.Int32),
            ],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, x: Int32, y: Int32, width: Int32, height: Int32) => {
            let imgData = this.context[this.lastBuffer].getImageData(
                x.getValue(),
                y.getValue(),
                width.getValue(),
                height.getValue()
            );
            return new RoByteArray(
                new Uint8Array(UPNG.encode([imgData.data.buffer], imgData.width, imgData.height, 0))
            );
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

    // ifSetMessagePort ----------------------------------------------------------------------------------

    /** Sets the roMessagePort to be used for all events from the screen */
    private setMessagePort = new Callable("setMessagePort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, port: RoMessagePort) => {
            port.enableKeys(true);
            port.addReference();
            this.port?.removeReference();
            this.port = port;
            return BrsInvalid.Instance;
        },
    });

    /** Sets the roMessagePort to be used for all events from the screen */
    private setPort = new Callable("setPort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, port: RoMessagePort) => {
            port.enableKeys(true);
            port.addReference();
            this.port?.removeReference();
            this.port = port;
            return BrsInvalid.Instance;
        },
    });
}
