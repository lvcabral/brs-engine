import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, Float, RoFont } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { RoBitmap, rgbaIntToHex } from "./RoBitmap";
import { RoScreen } from "./RoScreen";
import { Rect, Circle } from "./RoCompositor";

export class RoRegion extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private valid: boolean;
    private bitmap: RoBitmap | RoScreen;
    private canvas: OffscreenCanvas;
    private context: OffscreenCanvasRenderingContext2D;
    private x: number;
    private y: number;
    private width: number;
    private height: number;
    private collisionType: number;
    private translationX: number;
    private translationY: number;
    private scaleMode: number;
    private time: number;
    private wrap: boolean;
    private collisionCircle: Circle;
    private collisionRect: Rect;

    constructor(bitmap: RoBitmap | RoScreen, x: Int32, y: Int32, width: Int32, height: Int32) {
        super("roRegion");
        this.valid = false;
        this.bitmap = bitmap;
        this.collisionType = 0; // Valid: 0=All area 1=User defined rect 2=Used defined circle
        this.x = x.getValue();
        this.y = y.getValue();
        this.width = width.getValue();
        this.height = height.getValue();
        this.translationX = 0;
        this.translationY = 0;
        this.scaleMode = 0; // Valid: 0=fast 1=smooth (maybe slow)
        this.time = 0;
        this.wrap = false;
        this.collisionCircle = { x: 0, y: 0, r: width.getValue() }; // TODO: double check Roku default
        this.collisionRect = { x: 0, y: 0, w: width.getValue(), h: height.getValue() }; // TODO: double check Roku default
        // Create new canvas
        this.canvas = new OffscreenCanvas(this.width, this.height);
        this.context = this.canvas.getContext("2d", {
            alpha: true,
            willReadFrequently: true,
        }) as OffscreenCanvasRenderingContext2D;
        if (
            this.x + this.width <= bitmap.getCanvas().width &&
            this.y + this.height <= bitmap.getCanvas().height
        ) {
            this.redrawCanvas();
            this.valid = true;
        }
        this.registerMethods({
            ifRegion: [
                this.copy,
                this.getBitmap,
                this.getCollisionType,
                this.getHeight,
                this.getPretranslationX,
                this.getPretranslationY,
                this.getScaleMode,
                this.getTime,
                this.getWidth,
                this.getWrap,
                this.getX,
                this.getY,
                this.offset,
                this.set,
                this.setCollisionCircle,
                this.setCollisionRectangle,
                this.setCollisionType,
                this.setPretranslation,
                this.setScaleMode,
                this.setTime,
                this.setWrap,
            ],
            ifDraw2D: [
                this.clear,
                this.drawObject,
                // this.drawRotatedObject,
                // this.drawScaledObject,
                this.drawLine,
                this.drawPoint,
                this.drawRect,
                this.drawText,
                // this.finish,
                // this.getAlphaEnable,
                this.setAlphaEnable,
                // this.getByteArray,
                // this.getPng,
            ],
        });
    }

    isValid() {
        return this.valid;
    }

    applyOffset(x: number, y: number, width: number, height: number) {
        const bmp = this.bitmap.getCanvas();
        let newX = this.x + x;
        let newY = this.y + y;
        this.width += width;
        this.height += height;
        //TODO: Check the edge cases when both positions and dimentions are changed
        if (this.wrap) {
            if (newX > 0 && x !== 0) {
                this.x = newX % bmp.width;
            } else if (newX < 0) {
                this.x = newX + bmp.width;
            } else {
                this.x = newX;
            }
            if (newY > 0 && y !== 0) {
                this.y = newY % bmp.height;
            } else if (newY < 0) {
                this.y = newY + bmp.height;
            } else {
                this.y = newY;
            }
        } else {
            if (newX >= 0 && newX + this.width <= bmp.width) {
                this.x = newX;
            }
            if (newY >= 0 && newY + this.height <= bmp.height) {
                this.y = newY;
            }
        }
        this.redrawCanvas();
        // TODO: Check what is the effect on collision parameters
    }

    clearCanvas(rgba: number) {
        const ctx = this.bitmap.getContext();
        ctx.fillStyle = rgbaIntToHex(rgba);
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    drawImage(image: OffscreenCanvas, x: number, y: number) {
        const ctx = this.bitmap.getContext();
        ctx.drawImage(
            image,
            0,
            0,
            image.width,
            image.height,
            this.x + x,
            this.y + y,
            image.width,
            image.height
        );
    }

    getCanvas(): OffscreenCanvas {
        return this.bitmap.getCanvas();
    }

    getRegionCanvas(): OffscreenCanvas {
        return this.canvas;
    }

    getRgbaCanvas(rgba: number): OffscreenCanvas {
        if (this.bitmap instanceof RoBitmap) {
            return this.bitmap.getRgbaCanvas(rgba);
        }
        return this.bitmap.getCanvas();
    }

    getPosX(): number {
        return this.x;
    }

    getPosY(): number {
        return this.y;
    }

    getTransX(): number {
        return this.translationX;
    }

    getTransY(): number {
        return this.translationY;
    }

    getImageWidth(): number {
        return this.width;
    }

    getImageHeight(): number {
        return this.height;
    }

    getCollCircle(): Circle {
        return this.collisionCircle;
    }

    getCollRect(): Rect {
        if (this.collisionType === 1) {
            return this.collisionRect;
        } else {
            return { x: 0, y: 0, w: this.width, h: this.height };
        }
    }

    getCollType(): number {
        return this.collisionType;
    }

    getImageData(): ImageData {
        let ctx = this.context;
        return ctx.getImageData(0, 0, this.width, this.height);
    }

    redrawCanvas(): void {
        // TODO: Check the impact of translate on this method
        const bmp = this.bitmap.getCanvas();
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        let ctx = this.context;
        if (
            this.wrap &&
            (this.x + this.width > bmp.width ||
                this.y + this.height > bmp.height ||
                this.x < 0 ||
                this.y < 0)
        ) {
            let clippedWidth = Math.min(bmp.width - this.x, this.width);
            let clippedHeight = Math.min(bmp.height - this.y, this.height);
            // fill top/left part of canvas with (clipped) image.
            ctx.drawImage(
                bmp,
                this.x,
                this.y,
                clippedWidth,
                clippedHeight,
                0,
                0,
                clippedWidth,
                clippedHeight
            );
            if (clippedWidth < this.width && clippedHeight < this.height) {
                // wrap both horizontal and vertical
                let diffWidth = this.width - clippedWidth;
                let diffHeight = this.height - clippedHeight;
                ctx.drawImage(
                    bmp,
                    0,
                    this.y,
                    diffWidth,
                    clippedHeight,
                    clippedWidth,
                    0,
                    diffWidth,
                    clippedHeight
                );
                ctx.drawImage(
                    bmp,
                    this.x,
                    0,
                    clippedWidth,
                    diffHeight,
                    0,
                    clippedHeight,
                    clippedWidth,
                    diffHeight
                );
                ctx.drawImage(
                    bmp,
                    0,
                    0,
                    diffWidth,
                    diffHeight,
                    clippedWidth,
                    clippedHeight,
                    diffWidth,
                    diffHeight
                );
            } else if (clippedWidth < this.width) {
                // wrap horizontal
                let diffWidth = this.width - clippedWidth;
                ctx.drawImage(
                    bmp,
                    0,
                    this.y,
                    diffWidth,
                    this.height,
                    clippedWidth,
                    0,
                    diffWidth,
                    this.height
                );
            } else if (clippedHeight < this.height) {
                // wrap vertical
                let diffHeight = this.height - clippedHeight;
                ctx.drawImage(
                    bmp,
                    this.x,
                    0,
                    this.width,
                    diffHeight,
                    0,
                    clippedHeight,
                    this.width,
                    diffHeight
                );
            }
        } else {
            ctx.drawImage(
                bmp,
                this.x,
                this.y,
                this.width,
                this.height,
                0,
                0,
                this.width,
                this.height
            );
        }
    }

    getAnimaTime(): number {
        return this.time;
    }

    toString(parent?: BrsType): string {
        return "<Component: roRegion>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Returns a newly created copy of the region as a new roRegion object */
    private copy = new Callable("copy", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return new RoRegion(
                this.bitmap,
                new Int32(this.x),
                new Int32(this.y),
                new Int32(this.width),
                new Int32(this.height)
            );
        },
    });

    /** Returns the roBitmap object of the bitmap this region refers to	 */
    private getBitmap = new Callable("getBitmap", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.bitmap;
        },
    });

    /** Gets the type of region to be used for collision tests with the sprite */
    private getCollisionType = new Callable("getCollisionType", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.collisionType);
        },
    });

    /** Returns the height of the region */
    private getHeight = new Callable("getHeight", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.height);
        },
    });

    /** Returns the pretranslation x value */
    private getPretranslationX = new Callable("getPretranslationX", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.translationX);
        },
    });

    /** Returns the pretranslation y value */
    private getPretranslationY = new Callable("getPretranslationY", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.translationY);
        },
    });

    /** Returns the scaling mode of the region */
    private getScaleMode = new Callable("getScaleMode", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.scaleMode);
        },
    });

    /** Returns the "frame hold time" in milliseconds */
    private getTime = new Callable("getTime", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.time);
        },
    });

    /** Returns the width of the region */
    private getWidth = new Callable("getWidth", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.width);
        },
    });

    /** Returns true if the region can be wrapped */
    private getWrap = new Callable("getWrap", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.wrap);
        },
    });

    /** Returns the x coordinate of the region in its bitmap */
    private getX = new Callable("getX", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.x);
        },
    });

    /** Returns the y coordinate of the region in its bitmap */
    private getY = new Callable("getY", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.y);
        },
    });

    /** Adds the passed parameters x,y, w, and h to the values of those roRegion fields. */
    private offset = new Callable("offset", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Dynamic),
                new StdlibArgument("y", ValueKind.Dynamic),
                new StdlibArgument("w", ValueKind.Dynamic),
                new StdlibArgument("h", ValueKind.Dynamic),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, x: Float, y: Float, w: Float, h: Float) => {
            this.applyOffset(x.getValue(), y.getValue(), w.getValue(), h.getValue());
            return BrsInvalid.Instance;
        },
    });

    /** Initializes the fields of the region with the values of the fields in the srcRegion */
    private set = new Callable("set", {
        signature: {
            args: [new StdlibArgument("srcRegion", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, srcRegion: RoRegion) => {
            this.x = srcRegion.x;
            this.y = srcRegion.y;
            this.width = srcRegion.width;
            this.height = srcRegion.height;
            this.bitmap = srcRegion.bitmap;
            this.bitmap = srcRegion.bitmap;
            this.collisionType = srcRegion.collisionType;
            this.translationX = srcRegion.translationX;
            this.translationY = srcRegion.translationY;
            this.scaleMode = srcRegion.scaleMode;
            this.time = srcRegion.time;
            this.wrap = srcRegion.wrap;
            this.collisionCircle = srcRegion.collisionCircle;
            this.collisionRect = srcRegion.collisionRect;
            return BrsInvalid.Instance;
        },
    });

    /** Sets the type of region to be used for collision tests with the sprite */
    private setCollisionType = new Callable("setCollisionType", {
        signature: {
            args: [new StdlibArgument("collisionType", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, collisionType: Int32) => {
            this.collisionType = collisionType.getValue();
            return BrsInvalid.Instance;
        },
    });

    /** Sets the collision circle used for type 2 collision tests. */
    private setCollisionCircle = new Callable("setCollisionCircle", {
        signature: {
            args: [
                new StdlibArgument("xOffset", ValueKind.Int32),
                new StdlibArgument("yOffset", ValueKind.Int32),
                new StdlibArgument("radius", ValueKind.Int32),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, xOffset: Int32, yOffset: Int32, radius: Int32) => {
            this.collisionCircle = {
                x: xOffset.getValue(),
                y: yOffset.getValue(),
                r: radius.getValue(),
            };
            return BrsInvalid.Instance;
        },
    });

    /** Sets the collision rectangle used for type 1 collision tests. */
    private setCollisionRectangle = new Callable("setCollisionRectangle", {
        signature: {
            args: [
                new StdlibArgument("xOffset", ValueKind.Int32),
                new StdlibArgument("yOffset", ValueKind.Int32),
                new StdlibArgument("width", ValueKind.Int32),
                new StdlibArgument("height", ValueKind.Int32),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, xOffset: Int32, yOffset: Int32, width: Int32, height: Int32) => {
            this.collisionRect = {
                x: xOffset.getValue(),
                y: yOffset.getValue(),
                w: width.getValue(),
                h: height.getValue(),
            };
            return BrsInvalid.Instance;
        },
    });

    /** Set the pretranslation for DrawObject, DrawRotatedObject and DrawScaledObject */
    private setPretranslation = new Callable("setPretranslation", {
        signature: {
            args: [
                new StdlibArgument("translationX", ValueKind.Int32),
                new StdlibArgument("translationX", ValueKind.Int32),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, translationX: Int32, translationY: Int32) => {
            this.translationX = translationX.getValue();
            this.translationY = translationY.getValue();
            return BrsInvalid.Instance;
        },
    });

    /** Sets the scaling mode of the region  */
    private setScaleMode = new Callable("setScaleMode", {
        signature: {
            args: [new StdlibArgument("scaleMode", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, scaleMode: Int32) => {
            this.scaleMode = scaleMode.getValue();
            return BrsInvalid.Instance;
        },
    });

    /** Returns the "frame hold time" in milliseconds  */
    private setTime = new Callable("setTime", {
        signature: {
            args: [new StdlibArgument("time", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, time: Int32) => {
            this.time = time.getValue();
            return BrsInvalid.Instance;
        },
    });

    /** If true, any part of region that goes beyond the bounds of its bitmap "wraps" to the other side of the bitmap and is rendered there. */
    private setWrap = new Callable("setWrap", {
        signature: {
            args: [new StdlibArgument("wrap", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, wrap: BrsBoolean) => {
            this.wrap = wrap.toBoolean();
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
            this.clearCanvas(rgba.getValue());
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
            const ctx = this.bitmap.getContext();
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
                this.drawImage(cvs, x.getValue(), y.getValue());
            } else if (object instanceof RoRegion) {
                let rcv = object.getRegionCanvas();
                ctx.drawImage(
                    rcv,
                    this.x + x.getValue() + object.getTransX(),
                    this.y + y.getValue() + object.getTransY()
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
            let ctx = this.bitmap.getContext();
            ctx.beginPath();
            ctx.strokeStyle = rgbaIntToHex(rgba.getValue());
            ctx.moveTo(this.x + xStart.getValue(), this.y + yStart.getValue());
            ctx.lineTo(this.x + xEnd.getValue(), this.y + yEnd.getValue());
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
            let ctx = this.bitmap.getContext();
            ctx.fillStyle = rgbaIntToHex(rgba.getValue());
            ctx.fillRect(
                this.x + x.getValue(),
                this.y + y.getValue(),
                size.getValue(),
                size.getValue()
            );
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
            let ctx = this.bitmap.getContext();
            ctx.fillStyle = rgbaIntToHex(rgba.getValue());
            ctx.fillRect(
                this.x + x.getValue(),
                this.y + y.getValue(),
                width.getValue(),
                height.getValue()
            );
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
            const ctx = this.bitmap.getContext();
            ctx.fillStyle = rgbaIntToHex(rgba.getValue());
            ctx.font = font.toFontString();
            ctx.textBaseline = "top";
            ctx.fillText(
                text.value,
                this.x + x.getValue(),
                this.y + y.getValue() + font.getTopAdjust()
            );
            return BrsBoolean.True;
        },
    });

    /** If enable is true, do alpha blending when this bitmap is the destination */
    private setAlphaEnable = new Callable("setAlphaEnable", {
        signature: {
            args: [new StdlibArgument("alphaEnabled", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, alphaEnabled: BrsBoolean) => {
            return this.bitmap.setCanvasAlpha(alphaEnabled.toBoolean());
        },
    });
}

export function createRegion(
    bitmap: RoBitmap | RoScreen,
    x: Int32,
    y: Int32,
    width: Int32,
    height: Int32
) {
    const reg = new RoRegion(bitmap, x, y, width, height);
    return reg.isValid() ? reg : BrsInvalid.Instance;
}
