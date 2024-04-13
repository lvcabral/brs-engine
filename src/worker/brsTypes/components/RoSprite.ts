import { BrsValue, ValueKind, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { RoRegion } from "./RoRegion";
import { RoCompositor, Rect, Circle } from "./RoCompositor";
import { RoArray } from "./RoArray";
import { WorkerImageData } from "../draw2d";

export class RoSprite extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private region: RoRegion;
    private regions?: RoArray;
    private id: number;
    private x: number;
    private y: number;
    private z: number;
    private frame: number;
    private drawable: boolean;
    private memberFlags: number;
    private collidableFlags: number;
    private data: BrsType;
    private compositor: RoCompositor;
    private tickSum: number;

    constructor(
        x: Int32,
        y: Int32,
        region: RoRegion | RoArray,
        z: Int32,
        id: number,
        compositor: RoCompositor
    ) {
        super("roSprite");
        this.id = id;
        this.x = x.getValue();
        this.y = y.getValue();
        this.z = z.getValue();
        this.frame = 0;
        this.collidableFlags = 1;
        this.drawable = true;
        this.memberFlags = 1;
        this.data = BrsInvalid.Instance;
        this.compositor = compositor;
        this.tickSum = 0;
        if (region instanceof RoArray) {
            this.regions = region;
            this.region = region.getElements()[this.frame] as RoRegion;
        } else {
            this.region = region;
        }

        this.registerMethods({
            ifSprite: [
                this.checkCollision,
                this.checkMultipleCollisions,
                this.getRegion,
                this.getCollidableFlags,
                this.getDrawableFlag,
                this.getMemberFlags,
                this.getData,
                this.getX,
                this.getY,
                this.getZ,
                this.moveTo,
                this.moveOffset,
                this.offsetRegion,
                this.setRegion,
                this.setCollidableFlags,
                this.setDrawableFlag,
                this.setMemberFlags,
                this.setData,
                this.setZ,
                this.remove,
            ],
        });
    }

    getImageData(): WorkerImageData {
        return this.region.getImageData();
    }

    getRegionObject(): RoRegion {
        return this.region;
    }

    getId(): number {
        return this.id;
    }

    getPosX(): number {
        return this.x;
    }

    getPosY(): number {
        return this.y;
    }

    getCircle(): Circle {
        const collCircle = this.region.getCollCircle();
        return {
            x: this.x + collCircle.x,
            y: this.y + collCircle.y,
            r: collCircle.r,
        };
    }

    getRect(): Rect {
        const collRect = this.region.getCollRect();
        return {
            x: this.x + collRect.x,
            y: this.y + collRect.y,
            w: collRect.w,
            h: collRect.h,
        };
    }

    getFlags() {
        return { collidableFlags: this.collidableFlags, memberFlags: this.memberFlags };
    }

    getType() {
        return this.region.getCollType();
    }

    visible(): boolean {
        return this.drawable;
    }

    nextFrame(tick: number) {
        if (this.regions) {
            this.tickSum += tick;
            let region = this.regions.getElements()[this.frame] as RoRegion;
            if (this.tickSum >= region.getAnimaTime()) {
                this.frame++;
                this.tickSum = 0;
                if (this.frame >= this.regions.getElements().length) {
                    this.frame = 0;
                }
                this.region = this.regions.getElements()[this.frame] as RoRegion;
            }
        }
    }

    toString(parent?: BrsType): string {
        return "<Component: roSprite>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Returns an roRegion object that specifies the region of a bitmap that is the sprite's display graphic */
    private getRegion = new Callable("getRegion", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.region;
        },
    });

    /** Returns the first roSprite that this sprite collides with. */
    private checkCollision = new Callable("checkCollision", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.compositor.checkCollision(this, false);
        },
    });

    /** Returns an array of all colliding sprites. If there are no collisions return invalid. */
    private checkMultipleCollisions = new Callable("checkMultipleCollisions", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.compositor.checkCollision(this, true);
        },
    });

    /** Returns the value of collidable flags variable. */
    private getCollidableFlags = new Callable("getCollidableFlags", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.collidableFlags); //TODO: Use these flags on collision routine
        },
    });

    /** Returns the value of the Drawable Flag. */
    private getDrawableFlag = new Callable("getDrawableFlag", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.drawable);
        },
    });

    /** Returns the value of member flags variable. */
    private getMemberFlags = new Callable("getMemberFlags", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.memberFlags);
        },
    });

    /** Returns any user data associated with the sprite previously set via SetData(). */
    private getData = new Callable("getData", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.data;
        },
    });

    /** Returns the x coordinate of the sprite. */
    private getX = new Callable("getX", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.x);
        },
    });

    /** Returns the y coordinate of the sprite */
    private getY = new Callable("getY", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.y);
        },
    });

    /** Returns the z (layer) of the sprite */
    private getZ = new Callable("getZ", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.z);
        },
    });

    /** Move the sprite to coordinate x,y. */
    private moveTo = new Callable("moveTo", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, x: Int32, y: Int32) => {
            this.x = x.getValue();
            this.y = y.getValue();
            return BrsInvalid.Instance;
        },
    });

    /** Move the sprite to coordinate x,y. */
    private moveOffset = new Callable("moveOffset", {
        signature: {
            args: [
                new StdlibArgument("xOffset", ValueKind.Int32),
                new StdlibArgument("yOffSet", ValueKind.Int32),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, xOffset: Int32, yOffset: Int32) => {
            this.x += xOffset.getValue();
            this.y += yOffset.getValue();
            return BrsInvalid.Instance;
        },
    });

    /** Adjusts the part of an roRegion's bitmap that is being displayed as the sprite. */
    private offsetRegion = new Callable("offsetRegion", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("width", ValueKind.Int32),
                new StdlibArgument("height", ValueKind.Int32),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, x: Int32, y: Int32, width: Int32, height: Int32) => {
            if (this.regions) {
                // TODO: Double check if Roku does apply offset to all regions
                this.regions.getElements().forEach((element) => {
                    if (element instanceof RoRegion) {
                        element.applyOffset(
                            x.getValue(),
                            y.getValue(),
                            width.getValue(),
                            height.getValue()
                        );
                    }
                });
            } else if (this.region) {
                this.region.applyOffset(
                    x.getValue(),
                    y.getValue(),
                    width.getValue(),
                    height.getValue()
                );
            }
            return BrsInvalid.Instance;
        },
    });

    /** Sets bits to determine what sprites will be checked for collisions. */
    private setCollidableFlags = new Callable("setCollidableFlags", {
        signature: {
            args: [new StdlibArgument("collidableFlags", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, collidableFlags: Int32) => {
            this.collidableFlags = collidableFlags.getValue();
            return BrsInvalid.Instance;
        },
    });

    /** Associate user defined data with the sprite. The data can be any type including intrinsic types or objects. */
    private setData = new Callable("setData", {
        signature: {
            args: [new StdlibArgument("data", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, data: BrsType) => {
            this.data = data;
            return BrsInvalid.Instance;
        },
    });

    /** Sets whether this sprite is drawable or just used for collision tests. */
    private setDrawableFlag = new Callable("setDrawableFlag", {
        signature: {
            args: [new StdlibArgument("drawable", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, drawable: BrsBoolean) => {
            this.drawable = drawable.toBoolean();
            return BrsInvalid.Instance;
        },
    });

    /** Sets flags to define the sprite membership. These flags are used with CollidableFlags to define what sprites are allowed to collide. */
    private setMemberFlags = new Callable("setMemberFlags", {
        signature: {
            args: [new StdlibArgument("memberFlags", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, memberFlags: Int32) => {
            this.memberFlags = memberFlags.getValue();
            return BrsInvalid.Instance;
        },
    });

    /** Set the region of the sprite to the passed roRegion object. */
    private setRegion = new Callable("setRegion", {
        signature: {
            args: [new StdlibArgument("region", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, region: RoRegion) => {
            this.region = region;
            return BrsInvalid.Instance;
        },
    });

    /** Sets the z value of the sprite. The z value defines the order in which sprites are drawn. */
    private setZ = new Callable("setZ", {
        signature: {
            args: [new StdlibArgument("z", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, z: Int32) => {
            if (this.z !== z.getValue()) {
                this.compositor.setSpriteZ(this.id, this.z, z.getValue());
                this.z = z.getValue();
            }
            return BrsInvalid.Instance;
        },
    });

    /** Removes the sprite from the managing roComposite object and deletes the sprite. */
    private remove = new Callable("remove", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, z: Int32) => {
            this.compositor.removeSprite(this.id, this.regions !== null);
            return BrsInvalid.Instance;
        },
    });
}
