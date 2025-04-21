import { BrsValue, ValueKind, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoScreen, RoRegion } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { RoBitmap } from "./RoBitmap";
import { RoSprite } from "./RoSprite";
import { RoArray } from "./RoArray";
import {
    BrsCanvas,
    BrsCanvasContext2D,
    Circle,
    CircleCircle,
    createNewCanvas,
    drawObjectToComponent,
    getDimensions,
    Rect,
    RectCircle,
    RectRect,
    releaseCanvas,
    rgbaIntToHex,
} from "../interfaces/IfDraw2D";
import { BrsDevice } from "../../device/BrsDevice";

export class RoCompositor extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    readonly sprites = new Map<number, RoSprite[]>();
    readonly animations = new Array<RoSprite>();
    private readonly canvas: BrsCanvas;
    private readonly context: BrsCanvasContext2D;
    private destBitmap?: RoBitmap | RoScreen | RoRegion;
    private rgbaBackground?: number;
    private spriteId: number;
    private previousSpriteDraws: Rect[] = [];

    constructor() {
        super("roCompositor");
        this.canvas = createNewCanvas(10, 10);
        this.context = this.canvas.getContext("2d") as BrsCanvasContext2D;
        this.spriteId = 0;
        this.registerMethods({
            ifCompositor: [
                this.setDrawTo,
                this.draw,
                this.drawAll,
                this.newSprite,
                this.newAnimatedSprite,
                this.animationTick,
                // this.changeMatchingRegions,
            ],
        });
    }

    setSpriteZ(id: number, currentZ: number, newZ: number) {
        let layer = this.sprites.get(currentZ);
        if (layer) {
            layer.some((element, index, object) => {
                if (element.getId() === id) {
                    object.splice(index, 1);
                    this.setSpriteLayer(element, newZ);
                    return true; // break
                }
                return false;
            });
        }
    }

    setSpriteLayer(sprite: RoSprite, z: number) {
        let newLayer = this.sprites.get(z);
        if (newLayer) {
            newLayer.push(sprite);
        } else {
            newLayer = [sprite];
        }
        this.sprites.set(z, newLayer);
    }

    removeSprite(id: number, animation: boolean) {
        this.sprites.forEach(function (layer) {
            layer.some((sprite, index, object) => {
                if (sprite.getId() === id) {
                    object.splice(index, 1).forEach((sprite) => {
                        sprite.removeReference();
                    });
                    return true; // break
                }
                return false;
            });
        });
        if (animation) {
            this.animations.some((sprite, index, object) => {
                if (sprite.getId() === id) {
                    object.splice(index, 1).forEach((sprite) => {
                        sprite.removeReference();
                    });
                    return true; // break
                }
                return false;
            });
        }
    }

    getCanvasAlpha(): boolean {
        return !!this.destBitmap?.getCanvasAlpha();
    }

    getContext(): BrsCanvasContext2D {
        return this.context;
    }

    checkCollision(source: RoSprite, multiple: boolean): BrsType {
        const sourceFlags = source.getFlags();
        const sourceCircle = source.getCircle();
        const sourceRect = source.getRect();
        const sourceType = source.getType();
        const collisions: RoSprite[] = [];
        let collision: BrsType;
        collision = BrsInvalid.Instance;
        for (let [, layer] of this.sprites) {
            layer.some((target, _index, _object) => {
                if (source.getId() !== target.getId()) {
                    const targetFlags = target.getFlags();
                    const targetType = target.getType();
                    if (sourceFlags.memberFlags === targetFlags.memberFlags) {
                        // TODO: Correctly check the flags using bitwise operation
                        if (hasCollided(sourceType, sourceRect, sourceCircle, targetType, target)) {
                            if (multiple) {
                                collisions.push(target);
                            } else {
                                collision = target;
                                return true; // break
                            }
                        }
                    }
                }
                return false;
            });
            if (collision instanceof RoSprite) {
                break;
            }
        }
        if (multiple && collisions.length > 0) {
            return new RoArray(collisions);
        }
        return collision;
    }

    clearPreviousSpriteDraws() {
        let ctx = this.context;
        let rgba = this.rgbaBackground ? this.rgbaBackground : 0;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (rgba !== 0) {
            // Only color over where the last drawing happened
            ctx.fillStyle = rgbaIntToHex(rgba);
            for (const prevDraw of this.previousSpriteDraws) {
                ctx.fillRect(prevDraw.x, prevDraw.y, prevDraw.width, prevDraw.height);
            }
        }
        this.previousSpriteDraws = [];
    }

    drawSprites() {
        this.clearPreviousSpriteDraws();
        if (this.destBitmap) {
            this.destBitmap.drawImageToContext(this.canvas, 0, 0);
            let layers = [...this.sprites.keys()].sort((a, b) => a - b);
            layers.forEach((z) => {
                const layer = this.sprites.get(z);
                if (layer) {
                    layer.forEach((sprite) => {
                        if (sprite.visible()) {
                            drawObjectToComponent(
                                this,
                                sprite.getRegionObject(),
                                sprite.getPosX(),
                                sprite.getPosY()
                            );
                            this.previousSpriteDraws.push(sprite.getRect());
                        }
                    });
                    this.destBitmap?.drawImageToContext(this.canvas, 0, 0);
                }
            });
        }
    }

    toString(_parent?: BrsType): string {
        return "<Component: roCompositor>";
    }

    equalTo(_other: BrsType) {
        return BrsBoolean.False;
    }

    dispose() {
        this.destBitmap?.removeReference();
        this.sprites.forEach((layer) => {
            layer.forEach((sprite) => {
                sprite.removeReference();
            });
        });
        this.animations.forEach((sprite) => {
            sprite.removeReference();
        });
        releaseCanvas(this.canvas);
    }

    /** Set the destBitmap (roBitmap or roScreen) and the background color */
    private readonly setDrawTo = new Callable("setDrawTo", {
        signature: {
            args: [
                new StdlibArgument("destBitmap", ValueKind.Object),
                new StdlibArgument("rgbaBackground", ValueKind.Int32),
            ],
            returns: ValueKind.Void,
        },
        impl: (
            _: Interpreter,
            destBitmap: RoBitmap | RoScreen | RoRegion,
            rgbaBackground: Int32
        ) => {
            destBitmap.addReference();
            this.destBitmap?.removeReference();
            this.destBitmap = destBitmap;
            const destDimensions = getDimensions(destBitmap);
            this.canvas.width = destDimensions.width;
            this.canvas.height = destDimensions.height;
            this.rgbaBackground = rgbaBackground.getValue();
            return BrsInvalid.Instance;
        },
    });

    /** Create a new sprite, using an roRegion to define the sprite's bitmap. */
    private readonly newSprite = new Callable("newSprite", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("region", ValueKind.Object),
                new StdlibArgument("z", ValueKind.Int32, new Int32(0)),
            ],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, x: Int32, y: Int32, region: RoRegion, z: Int32) => {
            if (region instanceof RoRegion) {
                let sprite = new RoSprite(x, y, region, z, this.spriteId++, this);
                sprite.addReference();
                this.setSpriteLayer(sprite, z.getValue());
                return sprite;
            } else {
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roCompositor.newSprite: invalid region parameter type roInvalid: ${interpreter.formatLocation()}`
                );
            }
            return BrsInvalid.Instance;
        },
    });

    /** Create a new sprite that consists of a sequence of frames to be animated. The frames are defined by the regionArray which is an roArray of roRegions. */
    private readonly newAnimatedSprite = new Callable("newAnimatedSprite", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("regionArray", ValueKind.Object),
                new StdlibArgument("z", ValueKind.Int32, new Int32(0)),
            ],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, x: Int32, y: Int32, regionArray: RoArray, z: Int32) => {
            let warning = "";
            if (regionArray instanceof RoArray) {
                const regions = regionArray.getElements();
                if (regions && regions.length > 0) {
                    if (regions[0] instanceof RoRegion) {
                        let sprite = new RoSprite(x, y, regionArray, z, this.spriteId++, this);
                        sprite.addReference();
                        this.setSpriteLayer(sprite, z.getValue());
                        sprite.addReference();
                        this.animations.push(sprite);
                        return sprite;
                    } else {
                        warning = "invalid regionArray item type is roInvalid";
                    }
                } else {
                    warning = "invalid regionArray is empty";
                }
            } else {
                warning = "invalid regionArray parameter type roInvalid";
            }
            if (warning.length) {
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roCompositor.newAnimatedSprite: ${warning}: ${interpreter.formatLocation()}`
                );
            }
            return BrsInvalid.Instance;
        },
    });

    /** Duration is the number of ms since the last call. Moves all animated sprites. Sprites will not animate unless you call this function regularly  */
    private readonly animationTick = new Callable("animationTick", {
        signature: {
            args: [new StdlibArgument("duration", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, duration: Int32) => {
            this.animations.forEach((sprite) => {
                sprite.nextFrame(duration.getValue());
            });
            return BrsInvalid.Instance;
        },
    });

    /** Draw any dirty sprites (that is, whatever is new or has changed since the last Draw). */
    private readonly draw = new Callable("draw", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.drawSprites();
            return BrsInvalid.Instance;
        },
    });

    /** Redraw all sprites even if not dirty. */
    private readonly drawAll = new Callable("drawAll", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.drawSprites();
            return BrsInvalid.Instance;
        },
    });
}

function hasCollided(
    sourceType: number,
    sourceRect: Rect,
    sourceCircle: Circle,
    targetType: number,
    target: RoSprite
) {
    if (sourceType < 2 && targetType < 2) {
        return RectRect(sourceRect, target.getRect());
    } else if (sourceType === 2 && targetType === 2) {
        return CircleCircle(sourceCircle, target.getCircle());
    } else if (sourceType === 2) {
        return RectCircle(target.getRect(), sourceCircle);
    } else {
        return RectCircle(sourceRect, target.getCircle());
    }
}
