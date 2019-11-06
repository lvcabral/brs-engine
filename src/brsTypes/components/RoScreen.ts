import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { Float } from "../Float";
import { RoBitmap, rgbaIntToHex } from "./RoBitmap";
import { RoRegion } from "./RoRegion";
import { RoMessagePort } from "./RoMessagePort";
import { RoFont } from "./RoFont";
import { RoByteArray } from "./RoByteArray";
import UPNG from "upng-js";

export class RoScreen extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private alphaEnable: boolean;
    private doubleBuffer: boolean;
    private currentBuffer: number;
    private width: number;
    private height: number;
    //private display: HTMLCanvasElement;
    private canvas: OffscreenCanvas[];
    private context: OffscreenCanvasRenderingContext2D[];
    private port?: RoMessagePort;

    // TODO: Check the Roku behavior on 4:3 resolutions in HD/FHD devices
    constructor(
        interpreter: Interpreter,
        doubleBuffer?: BrsBoolean,
        width?: Int32,
        height?: Int32
    ) {
        super("roScreen", ["ifScreen", "ifDraw2D", "ifGetMessagePort", "ifSetMessagePort"]);
        let defaultWidth, defaultHeight;
        if (interpreter.deviceInfo.get("displayMode") === "1080p") {
            defaultWidth = 1920;
            defaultHeight = 1080;
        } else if (interpreter.deviceInfo.get("displayMode") === "720p") {
            defaultWidth = 1280;
            defaultHeight = 720;
        } else {
            defaultWidth = 720;
            defaultHeight = 480;
        }
        this.width =
            (width instanceof Int32 && width.getValue() && width.getValue()) || defaultWidth;
        this.height = (height instanceof Int32 && height.getValue()) || defaultHeight;
        if (this.width <= 0) {
            this.width = defaultWidth;
        }
        if (this.height <= 0) {
            this.height = defaultHeight;
        }
        this.doubleBuffer =
            (doubleBuffer instanceof BrsBoolean && doubleBuffer.toBoolean()) || false;
        this.currentBuffer = 0;
        this.canvas = new Array<OffscreenCanvas>(this.doubleBuffer ? 3 : 1);
        this.context = new Array<OffscreenCanvasRenderingContext2D>(this.doubleBuffer ? 3 : 1);
        for (let index = 0; index < this.canvas.length; index++) {
            this.canvas[index] = new OffscreenCanvas(this.width, this.height);
            this.context[index] = this.canvas[index].getContext("2d", {
                alpha: false,
            }) as OffscreenCanvasRenderingContext2D;
            this.canvas[index].width = this.width;
            this.canvas[index].height = this.height;
        }
        this.alphaEnable = false;
        this.registerMethods([
            this.swapBuffers,
            this.clear,
            this.drawObject,
            this.drawRotatedObject,
            this.drawScaledObject,
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
            this.getMessagePort,
            this.setMessagePort,
            this.setPort,
        ]);
    }
    getCanvas(): OffscreenCanvas {
        return this.canvas[this.currentBuffer];
    }

    getContext(): OffscreenCanvasRenderingContext2D {
        return this.context[this.currentBuffer];
    }

    clearCanvas(rgba: number) {
        let ctx = this.context[this.currentBuffer];
        ctx.fillStyle = rgbaIntToHex(rgba);
        ctx.fillRect(0, 0, this.width, this.height);
        return BrsInvalid.Instance;
    }

    drawImage(image: OffscreenCanvas, x: number, y: number) {
        this.context[this.currentBuffer].drawImage(image, x, y);
    }

    setCanvasAlpha(enable: boolean) {
        this.alphaEnable = enable;
        for (let index = 0; index < this.canvas.length; index++) {
            this.context[index] = this.canvas[index].getContext("2d", {
                alpha: this.alphaEnable,
            }) as OffscreenCanvasRenderingContext2D;
        }
        return BrsInvalid.Instance;
    }

    toString(parent?: BrsType): string {
        return "<Component: roScreen>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    // ifScreen ------------------------------------------------------------------------------------

    /** If the screen is double buffered, SwapBuffers swaps the back buffer with the front buffer */
    private swapBuffers = new Callable("swapBuffers", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            postMessage(
                this.context[this.currentBuffer].getImageData(0, 0, this.width, this.height)
            );
            if (this.doubleBuffer) {
                this.currentBuffer++;
                if (this.currentBuffer === this.canvas.length) {
                    this.currentBuffer = 0;
                }
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
                new StdlibArgument("rgba", ValueKind.Object, BrsInvalid.Instance),
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
            let cvs: OffscreenCanvas;
            if (object instanceof RoBitmap || object instanceof RoRegion) {
                if (rgba instanceof Int32) {
                    const alpha = rgba.getValue() & 255;
                    if (alpha < 255) {
                        ctx.globalAlpha = alpha / 255;
                    }
                    cvs = object.getRgbaCanvas(rgba.getValue());
                } else {
                    cvs = object.getCanvas();
                }
            } else {
                return BrsBoolean.False;
            }
            if (object instanceof RoBitmap) {
                ctx.drawImage(cvs, x.getValue(), y.getValue());
            } else {
                ctx.drawImage(
                    cvs,
                    object.getPosX(),
                    object.getPosY(),
                    object.getImageWidth(),
                    object.getImageHeight(),
                    x.getValue() + object.getTransX(),
                    y.getValue() + object.getTransY(),
                    object.getImageWidth(),
                    object.getImageHeight()
                );
            }
            ctx.globalAlpha = 1.0;
            return BrsBoolean.True;
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
                new StdlibArgument("rgba", ValueKind.Object, BrsInvalid.Instance),
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
            let cvs: OffscreenCanvas;
            if (object instanceof RoBitmap || object instanceof RoRegion) {
                if (rgba instanceof Int32) {
                    const alpha = rgba.getValue() & 255;
                    if (alpha < 255) {
                        ctx.globalAlpha = alpha / 255;
                    }
                    cvs = object.getRgbaCanvas(rgba.getValue());
                } else {
                    cvs = object.getCanvas();
                }
            } else {
                return BrsBoolean.False;
            }
            const positionX = x.getValue();
            const positionY = y.getValue();
            const angleInRad = (-theta.getValue() * Math.PI) / 180;
            ctx.translate(positionX, positionY);
            ctx.rotate(angleInRad);
            if (object instanceof RoBitmap) {
                ctx.drawImage(cvs, 0, 0, cvs.width, cvs.height);
            } else {
                ctx.drawImage(
                    cvs,
                    object.getPosX(),
                    object.getPosY(),
                    object.getImageWidth(),
                    object.getImageHeight(),
                    object.getTransX(),
                    object.getTransY(),
                    object.getImageWidth(),
                    object.getImageHeight()
                );
            }
            ctx.rotate(-angleInRad);
            ctx.translate(-positionX, -positionY);
            ctx.globalAlpha = 1.0;
            return BrsBoolean.True;
        },
    });

    /** Draw the source object, at position x,y, scaled horizotally by scaleX and vertically by scaleY. */
    private drawScaledObject = new Callable("drawScaledObject", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("scaleX", ValueKind.Float),
                new StdlibArgument("scaleY", ValueKind.Float),
                new StdlibArgument("object", ValueKind.Object),
                new StdlibArgument("rgba", ValueKind.Object, BrsInvalid.Instance), // TODO: add support to rgba
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
            ctx.imageSmoothingEnabled = false;
            let cvs: OffscreenCanvas;
            if (object instanceof RoBitmap || object instanceof RoRegion) {
                if (rgba instanceof Int32) {
                    const alpha = rgba.getValue() & 255;
                    if (alpha < 255) {
                        ctx.globalAlpha = alpha / 255;
                    }
                    cvs = object.getRgbaCanvas(rgba.getValue());
                } else {
                    cvs = object.getCanvas();
                }
            } else {
                return BrsBoolean.False;
            }
            if (object instanceof RoBitmap) {
                ctx.drawImage(
                    cvs,
                    x.getValue(),
                    y.getValue(),
                    cvs.width * scaleX.getValue(),
                    cvs.height * scaleY.getValue()
                );
            } else if (object instanceof RoRegion) {
                let tx = object.getTransX() * scaleX.getValue();
                let ty = object.getTransY() * scaleY.getValue();
                ctx.drawImage(
                    cvs,
                    object.getPosX(),
                    object.getPosY(),
                    object.getImageWidth(),
                    object.getImageHeight(),
                    x.getValue() + tx,
                    y.getValue() + ty,
                    object.getImageWidth() * scaleX.getValue(),
                    object.getImageHeight() * scaleY.getValue()
                );
            }
            ctx.globalAlpha = 1.0;
            return BrsBoolean.True;
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
            ctx.strokeStyle = rgbaIntToHex(rgba.getValue());
            ctx.moveTo(xStart.getValue(), yStart.getValue());
            ctx.lineTo(xEnd.getValue(), yEnd.getValue());
            ctx.stroke();
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
            ctx.fillStyle = rgbaIntToHex(rgba.getValue());
            ctx.fillRect(x.getValue(), y.getValue(), size.getValue(), size.getValue());
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
            ctx.fillStyle = rgbaIntToHex(rgba.getValue());
            ctx.fillRect(x.getValue(), y.getValue(), width.getValue(), height.getValue());
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
            ctx.fillStyle = rgbaIntToHex(rgba.getValue());
            ctx.font = font.toFontString();
            ctx.textBaseline = "top";
            ctx.fillText(text.value, x.getValue(), y.getValue() + font.getTopAdjust());
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
            if (!this.doubleBuffer) {
                postMessage(this.context[0].getImageData(0, 0, this.width, this.height));
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
            args: [new StdlibArgument("alphaEnabled", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, alphaEnabled: BrsBoolean) => {
            return this.setCanvasAlpha(alphaEnabled.toBoolean());
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
            let imgData = this.context[this.currentBuffer].getImageData(
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
            let imgData = this.context[this.currentBuffer].getImageData(
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
            return this.port === undefined ? BrsInvalid.Instance : this.port;
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
            this.port = port;
            return BrsInvalid.Instance;
        },
    });
}
