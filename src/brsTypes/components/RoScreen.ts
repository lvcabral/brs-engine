import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { Float } from "../Float";
import { RoBitmap } from "./RoBitmap";
import { RoRegion } from "./RoRegion";
import { RoMessagePort } from "./RoMessagePort";
import { RoFont } from "./RoFont";

export class RoScreen extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private alphaEnable: boolean;
    private dblBuffer: boolean;
    private width: number;
    private height: number;
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private port?: RoMessagePort;

    // TODO: Only allow the screensizes below, return invalid if bad resolution is passed
    // HD mode screensizes
    // 1280x720PAR=1:1 (default for HD)
    // 854x480 PAR=1:1 useful for higher performance HD games, also for 640x480 games
    // 940x480 PAR=1.1:1 used for displaying a RokuSD (720x480) games

    // SD mode screensizes
    // 720x480 PAR=1.1:1 (default for SD)
    // 640x480 PAR=1:1 (used for 640x480 games)
    // 854x626 PAR=1:1 (used for 854x480 HD games)
    constructor(doubleBuffer?: BrsBoolean, width?: Int32, height?: Int32) {
        super("roScreen", ["ifScreen", "ifDraw2D"]);
        let canvas = document.getElementById("display") as HTMLCanvasElement; //TODO: Create an empty canvas and use the browser one as TV Display
        this.canvas = canvas;
        let context = canvas.getContext("2d", { alpha: false });
        this.context =
            (context && canvas.getContext("2d", { alpha: false })) ||
            new CanvasRenderingContext2D();
        this.alphaEnable = false;
        this.dblBuffer = (doubleBuffer instanceof BrsBoolean && doubleBuffer.toBoolean()) || false;
        this.width = (width instanceof Int32 && width.getValue()) || canvas.width; // TODO: Get default width from display
        this.height = (height instanceof Int32 && height.getValue()) || canvas.height; // TODO: Get default height from display
        canvas.width = this.width;
        canvas.height = this.height;
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
            // this.getByteArray,
            // this.getPng,
            this.getWidth,
            this.getHeight,
            this.getMessagePort,
            this.setMessagePort,
        ]);
    }
    getCanvas(): HTMLCanvasElement {
        return this.canvas;
    }

    drawImage(image: HTMLCanvasElement, x: number, y: number) {
        this.context.drawImage(image, x, y);
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
            if (this.dblBuffer) {
                //TODO: Swap buffers (not sure if needed as the browser handles it)
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
            let ctx = this.context;
            ctx.fillStyle = this.rgbToHex(rgba.getValue());
            ctx.fillRect(0, 0, this.width, this.height);
            return BrsInvalid.Instance;
        },
    });

    /** Draw the source object, where src is an roBitmap or an roRegion object, at position x,y */
    private drawObject = new Callable("drawObject", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("object", ValueKind.Object), // TODO: Add support to roRegion
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, x: Int32, y: Int32, object: BrsComponent) => {
            let ctx = this.context;
            let result = BrsBoolean.True;
            if (object instanceof RoBitmap) {
                this.drawImage(object.getCanvas(), x.getValue(), y.getValue());
            } else if (object instanceof RoRegion) {
                const region = document.createElement("canvas");
                region.width = object.getImageWidth();
                region.height = object.getImageHeight();
                const rctx = region.getContext("2d", { alpha: true });
                if (rctx) {
                    rctx.putImageData(object.getImageData(), 0, 0);
                    this.drawImage(region, x.getValue(), y.getValue());
                }
            } else {
                result = BrsBoolean.False;
            }
            return result;
        },
    });

    /** Draw the source object at position x,y rotated by angle theta degrees. */
    private drawRotatedObject = new Callable("drawRotatedObject", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("theta", ValueKind.Float),
                new StdlibArgument("object", ValueKind.Object), // TODO: Add support to roRegion
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, x: Int32, y: Int32, theta: Float, object: RoBitmap) => {
            let ctx = this.context;
            let obj = object.getCanvas();
            let positionX = x.getValue();
            let positionY = y.getValue();
            let angleInRad = (-theta.getValue() * Math.PI) / 180;
            let width = obj.width;
            let height = obj.height;

            ctx.translate(positionX, positionY);
            ctx.rotate(angleInRad);
            ctx.drawImage(obj, 0, 0, width, height);
            ctx.rotate(-angleInRad);
            ctx.translate(-positionX, -positionY);

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
                new StdlibArgument("object", ValueKind.Object), // TODO: Add support to roRegion
            ],
            returns: ValueKind.Boolean,
        },
        impl: (
            _: Interpreter,
            x: Int32,
            y: Int32,
            scaleX: Float,
            scaleY: Float,
            object: RoBitmap
        ) => {
            let ctx = this.context;
            let obj = object.getCanvas();
            ctx.drawImage(
                obj,
                x.getValue(),
                y.getValue(),
                obj.width * scaleX.getValue(),
                obj.height * scaleY.getValue()
            );
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
            let ctx = this.context;
            ctx.strokeStyle = this.rgbToHex(rgba.getValue());
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
            let ctx = this.context;
            ctx.fillStyle = this.rgbToHex(rgba.getValue());
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
            let ctx = this.context;
            ctx.fillStyle = this.rgbToHex(rgba.getValue());
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
            let ctx = this.context;
            ctx.fillStyle = this.rgbToHex(rgba.getValue());
            ctx.font = font.toFontString();
            ctx.textBaseline = "top";
            ctx.fillText(text.toString(), x.getValue(), y.getValue());
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
            if (this.dblBuffer) {
                //TODO: Show pending paint
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
            this.alphaEnable = alphaEnabled.toBoolean();
            let context = this.canvas.getContext("2d", { alpha: this.alphaEnable });
            this.context =
                (context && this.canvas.getContext("2d", { alpha: this.alphaEnable })) ||
                new CanvasRenderingContext2D();
            return BrsInvalid.Instance;
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
            this.port = port;
            return BrsInvalid.Instance;
        },
    });

    // Aux functions  ------------------------------------------------------------------------------------
    // TODO: Review color conversion of hex numbers
    private rgbToHex = function(rgb: number) {
        var hex = Number(rgb).toString(16);
        if (hex.length < 2) {
            hex = "0" + hex;
        }
        return "#" + hex;
    };
}
