import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { Float } from "../Float";
import { RoString } from "./RoString";
import { RoRegion } from "./RoRegion";
import { RoFont } from "./RoFont";
import { RoAssociativeArray } from "./RoAssociativeArray";
import { images } from "../..";

export class RoBitmap extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private alphaEnable: boolean;
    private canvas: OffscreenCanvas;
    private context: OffscreenCanvasRenderingContext2D;

    constructor(param: BrsComponent) {
        super("roBitmap", ["ifDraw2D"]);
        let filePath = "";
        let width = 300;
        let height = 150;
        this.alphaEnable = false;
        if (param instanceof BrsString) {
            filePath = param.value;
            if (filePath.substr(0, 4) === "pkg:") {
                //let filePath = path.join(interpreter.options.root, url.pathname);
                filePath = filePath.substr(5); // TODO: Use options configuration that defines root
            }
            this.alphaEnable = true;
        } else if (param instanceof RoAssociativeArray) {
            let paramWidth = param.get(new BrsString("width"));
            if (paramWidth instanceof Int32) {
                width = paramWidth.getValue();
            }
            let paramHeight = param.get(new BrsString("height"));
            if (paramHeight instanceof Int32) {
                height = paramHeight.getValue();
            }
            let alphaEnable = param.get(new BrsString("alphaEnable"));
            if (alphaEnable instanceof BrsBoolean) {
                this.alphaEnable = alphaEnable.toBoolean();
            }
        }
        this.canvas = new OffscreenCanvas(width, height);
        //TODO: Review alpha enable, it should only affect bitmap as destination.
        this.context = this.canvas.getContext("2d", {
            alpha: this.alphaEnable,
        }) as OffscreenCanvasRenderingContext2D;
        if (filePath !== "") {
            let image = images.get(filePath);
            if (image) {
                this.canvas.width = image.width;
                this.canvas.height = image.height;
                this.context.drawImage(image, 0, 0);
            }
        }

        this.registerMethods([
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
        ]);
    }
    drawImage(image: OffscreenCanvas, x: number, y: number) {
        this.context.drawImage(image, x, y);
    }

    getCanvas(): OffscreenCanvas {
        return this.canvas;
    }

    getContext(): OffscreenCanvasRenderingContext2D {
        return this.context;
    }

    toString(parent?: BrsType): string {
        return "<Component: roBitmap>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    // ifDraw2D  -----------------------------------------------------------------------------------

    /** Clear the bitmap, and fill with the specified RGBA color */
    private clear = new Callable("clear", {
        signature: {
            args: [new StdlibArgument("rgba", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, rgba: Int32) => {
            let ctx = this.context;
            ctx.fillStyle = rgbaIntToHex(rgba.getValue());
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            return BrsInvalid.Instance;
        },
    });

    /** Draw the source object, where src is an roBitmap or an roRegion object, at position x,y */
    private drawObject = new Callable("drawObject", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("object", ValueKind.Object),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, x: Int32, y: Int32, object: BrsComponent) => {
            let ctx = this.context;
            let result = BrsBoolean.True;
            if (object instanceof RoBitmap) {
                ctx.drawImage(object.getCanvas(), x.getValue(), y.getValue());
            } else if (object instanceof RoRegion) {
                ctx.putImageData(object.getImageData(), x.getValue(), y.getValue());
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
            let ctx = this.context;
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
            let ctx = this.context;
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
            let ctx = this.context;
            ctx.fillStyle = rgbaIntToHex(rgba.getValue());
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
            let context = this.canvas.getContext("2d", {
                alpha: this.alphaEnable,
            }) as OffscreenCanvasRenderingContext2D;
            this.context = context;
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
            return new Int32(this.canvas.width);
        },
    });

    /** Return the height of the screen/bitmap/region. */
    private getHeight = new Callable("getHeight", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.canvas.height);
        },
    });
}

export function rgbaIntToHex(rgba: number): string {
    var hex = rgba.toString(16);
    while (hex.length < 8) {
        hex = "0" + hex;
    }
    return "#" + hex;
}
