import { BrsValue, ValueKind, BrsInvalid, BrsBoolean, Uninitialized } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, Float, isAnyNumber, jsValueOf } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RuntimeError, RuntimeErrorDetail } from "../../error/BrsError";
import { Int32 } from "../Int32";
import { RoBitmap } from "./RoBitmap";
import { RoScreen } from "./RoScreen";
import {
    BrsCanvas,
    BrsCanvasContext2D,
    BrsDraw2D,
    BrsImageData,
    Circle,
    drawImageToContext,
    drawObjectToComponent,
    IfDraw2D,
    Rect,
    rgbaIntToHex,
} from "../interfaces/IfDraw2D";

export class RoRegion extends BrsComponent implements BrsValue, BrsDraw2D {
    readonly kind = ValueKind.Object;
    private readonly valid: boolean;
    private alphaEnable: boolean;
    private bitmap: RoBitmap | RoScreen;
    private collisionType: number;
    private translationX: number;
    private translationY: number;
    private time: number;
    private wrap: boolean;
    private collisionCircle: Circle;
    private collisionRect: Rect;
    x: number;
    y: number;
    width: number;
    height: number;
    scaleMode: number;

    constructor(bitmap: RoBitmap | RoScreen, x: Int32, y: Int32, width: Int32, height: Int32) {
        super("roRegion");
        this.valid = false;
        if (
            !(bitmap instanceof RoBitmap || bitmap instanceof RoScreen) ||
            !isAnyNumber(x) ||
            !isAnyNumber(y) ||
            !isAnyNumber(width) ||
            !isAnyNumber(height)
        ) {
            const detail =
                bitmap instanceof Uninitialized
                    ? RuntimeErrorDetail.UninitializedVariable
                    : RuntimeErrorDetail.TypeMismatch;
            throw new RuntimeError(detail);
        }
        bitmap.addReference();
        this.bitmap = bitmap;
        this.collisionType = 0; // Valid: 0=All area 1=User defined rect 2=Used defined circle
        this.x = 0;
        this.x = Math.trunc(jsValueOf(x));
        this.y = 0;
        this.y = Math.trunc(jsValueOf(y));
        this.width = bitmap.width;
        this.width = Math.trunc(jsValueOf(width));
        this.height = bitmap.height;
        this.height = Math.trunc(jsValueOf(height));
        this.translationX = 0;
        this.translationY = 0;
        this.scaleMode = 0; // Valid: 0=fast 1=smooth (maybe slow)
        this.time = 0;
        this.wrap = false;
        this.collisionCircle = { x: 0, y: 0, r: this.width };
        this.collisionRect = { x: 0, y: 0, width: this.width, height: this.height };
        this.alphaEnable = true;

        if (this.x + this.width <= bitmap.width && this.y + this.height <= bitmap.height) {
            this.valid = true;
        }
        const ifDraw2D = new IfDraw2D(this);
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
        //TODO: Check the edge cases when both positions and dimensions are changed
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
        this.bitmap.makeDirty();
        // TODO: Check what is the effect on collision parameters
    }

    clearCanvas(rgba: number) {
        const ctx = this.bitmap.getContext();
        ctx.fillStyle = rgbaIntToHex(rgba);
        ctx.fillRect(this.x, this.y, this.width, this.height);
        this.bitmap.makeDirty();
    }

    drawImage(object: BrsComponent, x: number, y: number, scaleX: number = 1, scaleY: number = 1, rgba?: number) {
        const isDirty = drawObjectToComponent(this, object, x, y, scaleX, scaleY, rgba);
        if (isDirty) {
            this.bitmap.makeDirty();
        }
        return isDirty;
    }

    drawImageToContext(image: BrsCanvas, x: number, y: number): boolean {
        const ctx = this.bitmap.getContext();
        const isDirty = drawImageToContext(ctx, image, this.alphaEnable, x + this.getPosX(), y + this.getPosY());
        if (isDirty) {
            this.bitmap.makeDirty();
        }
        return isDirty;
    }

    getCanvas(): BrsCanvas {
        return this.bitmap.getCanvas();
    }

    getContext(): BrsCanvasContext2D {
        return this.bitmap.getContext();
    }

    getRgbaCanvas(rgba: number): BrsCanvas {
        if (this.bitmap instanceof RoBitmap) {
            return this.bitmap.getRgbaCanvas(rgba);
        }
        return this.bitmap.getCanvas();
    }

    setCanvasAlpha(alphaEnable: boolean) {
        this.alphaEnable = alphaEnable;
        this.bitmap.setCanvasAlpha(alphaEnable);
    }

    getCanvasAlpha(): boolean {
        return this.alphaEnable;
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
            return { x: 0, y: 0, width: this.width, height: this.height };
        }
    }

    getCollType(): number {
        return this.collisionType;
    }

    getImageData(): BrsImageData {
        return this.bitmap.getContext().getImageData(this.x, this.y, this.width, this.height);
    }

    getWrapValue(): boolean {
        return this.wrap;
    }

    getAnimaTime(): number {
        return this.time;
    }

    getSourceBitmap(): RoBitmap | RoScreen {
        return this.bitmap;
    }

    makeDirty() {
        this.bitmap.makeDirty();
    }

    finishDraw(): void {
        this.bitmap.finishDraw();
    }

    toString(parent?: BrsType): string {
        return "<Component: roRegion>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    dispose() {
        this.bitmap.removeReference();
    }

    /** Returns a newly created copy of the region as a new roRegion object */
    private readonly copy = new Callable("copy", {
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
    private readonly getBitmap = new Callable("getBitmap", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.bitmap;
        },
    });

    /** Gets the type of region to be used for collision tests with the sprite */
    private readonly getCollisionType = new Callable("getCollisionType", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.collisionType);
        },
    });

    /** Returns the height of the region */
    private readonly getHeight = new Callable("getHeight", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.height);
        },
    });

    /** Returns the pretranslation x value */
    private readonly getPretranslationX = new Callable("getPretranslationX", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.translationX);
        },
    });

    /** Returns the pretranslation y value */
    private readonly getPretranslationY = new Callable("getPretranslationY", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.translationY);
        },
    });

    /** Returns the scaling mode of the region */
    private readonly getScaleMode = new Callable("getScaleMode", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.scaleMode);
        },
    });

    /** Returns the "frame hold time" in milliseconds */
    private readonly getTime = new Callable("getTime", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.time);
        },
    });

    /** Returns the width of the region */
    private readonly getWidth = new Callable("getWidth", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.width);
        },
    });

    /** Returns true if the region can be wrapped */
    private readonly getWrap = new Callable("getWrap", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.wrap);
        },
    });

    /** Returns the x coordinate of the region in its bitmap */
    private readonly getX = new Callable("getX", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.x);
        },
    });

    /** Returns the y coordinate of the region in its bitmap */
    private readonly getY = new Callable("getY", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.y);
        },
    });

    /** Adds the passed parameters x,y, w, and h to the values of those roRegion fields. */
    private readonly offset = new Callable("offset", {
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
    private readonly set = new Callable("set", {
        signature: {
            args: [new StdlibArgument("srcRegion", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, srcRegion: RoRegion) => {
            this.x = srcRegion.x;
            this.y = srcRegion.y;
            this.width = srcRegion.width;
            this.height = srcRegion.height;
            srcRegion.bitmap?.addReference();
            this.bitmap?.removeReference();
            this.bitmap = srcRegion.bitmap;
            this.collisionType = srcRegion.collisionType;
            this.translationX = srcRegion.translationX;
            this.translationY = srcRegion.translationY;
            this.scaleMode = srcRegion.scaleMode;
            this.time = srcRegion.time;
            this.wrap = srcRegion.wrap;
            this.collisionCircle = srcRegion.collisionCircle;
            this.collisionRect = srcRegion.collisionRect;
            this.bitmap.makeDirty();
            return BrsInvalid.Instance;
        },
    });

    /** Sets the type of region to be used for collision tests with the sprite */
    private readonly setCollisionType = new Callable("setCollisionType", {
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
    private readonly setCollisionCircle = new Callable("setCollisionCircle", {
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
    private readonly setCollisionRectangle = new Callable("setCollisionRectangle", {
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
                width: width.getValue(),
                height: height.getValue(),
            };
            return BrsInvalid.Instance;
        },
    });

    /** Set the pretranslation for DrawObject, DrawRotatedObject and DrawScaledObject */
    private readonly setPretranslation = new Callable("setPretranslation", {
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
            this.bitmap.makeDirty();
            return BrsInvalid.Instance;
        },
    });

    /** Sets the scaling mode of the region  */
    private readonly setScaleMode = new Callable("setScaleMode", {
        signature: {
            args: [new StdlibArgument("scaleMode", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, scaleMode: Int32) => {
            this.scaleMode = scaleMode.getValue();
            this.bitmap.makeDirty();
            return BrsInvalid.Instance;
        },
    });

    /** Returns the "frame hold time" in milliseconds  */
    private readonly setTime = new Callable("setTime", {
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
    private readonly setWrap = new Callable("setWrap", {
        signature: {
            args: [new StdlibArgument("wrap", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, wrap: BrsBoolean) => {
            this.wrap = wrap.toBoolean();
            this.bitmap.makeDirty();
            return BrsInvalid.Instance;
        },
    });
}

export function createRegion(bitmap: RoBitmap | RoScreen, x: Int32, y: Int32, width: Int32, height: Int32) {
    const reg = new RoRegion(bitmap, x, y, width, height);
    return reg.isValid() ? reg : BrsInvalid.Instance;
}
