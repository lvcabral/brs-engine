import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { RoRegion } from "./RoRegion";
import { RoCompositor } from "./RoCompositor";
import { RoArray } from "./RoArray";

export class RoSprite extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private region?: RoRegion;
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
    private dirty: boolean;

    constructor(
        x: Int32,
        y: Int32,
        region: BrsComponent,
        z: Int32,
        id: number,
        compositor: RoCompositor
    ) {
        super("roSprite");
        if (region instanceof RoRegion) {
            this.region = region;
        } else if (region instanceof RoArray) {
            this.regions = region;
        } else {
            //TODO: Raise an exception
        }
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
        this.dirty = true;

        this.registerMethods([
            //this.checkCollision,
            //this.checkMultipleCollisions,
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
        ]);
    }

    getImageData(): ImageData {
        let image = new ImageData(1, 1);
        if (this.region) {
            image = this.region.getImageData();
        } else if (this.regions) {
            let region = this.regions.getElements()[this.frame] as RoRegion;
            image = region.getImageData();
        }
        return image;
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

    visible(): boolean {
        return this.drawable;
    }

    nextFrame(tick: number) {
        if (this.regions) {
            let region = this.regions.getElements()[this.frame] as RoRegion;
            if (tick >= region.getAnimaTime()) {
                this.frame++;
                if (this.frame >= this.regions.getElements().length) {
                    this.frame = 0;
                }
            }
        }
    }

    toString(parent?: BrsType): string {
        return "<Component: roSprite>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /**  */
    private getRegion = new Callable("getRegion", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.region
                ? this.region
                : this.regions
                ? this.regions.getElements()[this.frame]
                : BrsInvalid.Instance;
        },
    });

    /**  */
    private getCollidableFlags = new Callable("getCollidableFlags", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.collidableFlags); //TODO: Use these flags on collision routine
        },
    });

    /**  */
    private getDrawableFlag = new Callable("getDrawableFlag", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.drawable);
        },
    });

    /**  */
    private getMemberFlags = new Callable("getMemberFlags", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.memberFlags);
        },
    });

    /**  */
    private getData = new Callable("getData", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.data;
        },
    });

    /**  */
    private getX = new Callable("getX", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.x);
        },
    });

    /**  */
    private getY = new Callable("getY", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.y);
        },
    });

    /**  */
    private getZ = new Callable("getZ", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.z);
        },
    });

    /**  */
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
            this.dirty = true;
            return BrsInvalid.Instance;
        },
    });

    /**  */
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
            this.dirty = true;
            return BrsInvalid.Instance;
        },
    });

    /**  */
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
            if (this.region) {
                this.region.applyOffset(
                    x.getValue(),
                    y.getValue(),
                    width.getValue(),
                    height.getValue()
                );
            } else if (this.regions) {
                this.regions.getElements().forEach(element => {
                    if (element instanceof RoRegion) {
                        element.applyOffset(
                            x.getValue(),
                            y.getValue(),
                            width.getValue(),
                            height.getValue()
                        );
                    }
                });
            }
            this.dirty = true;
            return BrsInvalid.Instance;
        },
    });

    /**  */
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

    /**  */
    private setData = new Callable("setData", {
        signature: {
            args: [new StdlibArgument("data", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, data: BrsType) => {
            this.data = data;
            return BrsInvalid.Instance;
        },
    });

    /**  */
    private setDrawableFlag = new Callable("setDrawableFlag", {
        signature: {
            args: [new StdlibArgument("drawable", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, drawable: BrsBoolean) => {
            this.drawable = drawable.toBoolean();
            this.dirty = true;
            return BrsInvalid.Instance;
        },
    });

    /**  */
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

    /**  */
    private setRegion = new Callable("setRegion", {
        signature: {
            args: [new StdlibArgument("reion", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, region: RoRegion) => {
            this.region = region;
            this.dirty = true;
            return BrsInvalid.Instance;
        },
    });

    /**  */
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
            this.dirty = true;
            return BrsInvalid.Instance;
        },
    });

    /**  */
    private remove = new Callable("remove", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, z: Int32) => {
            this.compositor.removeSprite(this.id, this.regions !== null);
            this.dirty = true;
            return BrsInvalid.Instance;
        },
    });
}
