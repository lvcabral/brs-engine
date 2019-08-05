import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { RoBitmap } from "./RoBitmap";

export class RoRegion extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private bitmap: RoBitmap;
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
    private collisionCircle: object;
    private collisionRect: object;

    constructor(bitmap: RoBitmap, x: Int32, y: Int32, width: Int32, height: Int32) {
        super("RoRegion");
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
        this.collisionCircle = { xOffset: 0, yOffset: 0, radius: width > height ? width : height }; // TODO: double check Roku default
        this.collisionRect = { xOffSet: 0, yOffset: 0, width: width, height: height }; // TODO: double check Roku default

        this.registerMethods([
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
        ]);
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
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("w", ValueKind.Int32),
                new StdlibArgument("h", ValueKind.Int32),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, x: Int32, y: Int32, w: Int32, h: Int32) => {
            this.x += x.getValue();
            this.y += y.getValue();
            this.width += w.getValue();
            this.height += h.getValue();
            // TODO: Check what is the effect on collision parameters
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
                xOffset: xOffset.getValue(),
                yOffset: yOffset.getValue(),
                radius: radius.getValue(),
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
                xOffset: xOffset.getValue(),
                yOffset: yOffset.getValue(),
                width: width.getValue(),
                height: height.getValue(),
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
}
