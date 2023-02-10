import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoScreen, RoRegion } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { RoBitmap, rgbaIntToHex } from "./RoBitmap";
import { RoSprite } from "./RoSprite";
import { RoArray } from "./RoArray";

export class RoCompositor extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    readonly sprites = new Map<number, RoSprite[]>();
    readonly animations = new Array<RoSprite>();
    private canvas: OffscreenCanvas;
    private context: OffscreenCanvasRenderingContext2D;
    private destBitmap?: RoBitmap | RoScreen | RoRegion;
    private rgbaBackground?: number;
    private spriteId: number;

    constructor() {
        super("roCompositor");
        this.canvas = new OffscreenCanvas(10, 10);
        let context = this.canvas.getContext("2d", {
            alpha: true,
        }) as OffscreenCanvasRenderingContext2D;
        this.context = context;
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
            let sprite;
            layer.some(function (element, index, object) {
                if (element.getId() === id) {
                    object.splice(index, 1);
                    sprite = element;
                    return true; // break
                }
                return false;
            });
            if (sprite) {
                let newLayer = this.sprites.get(newZ);
                newLayer ? newLayer.push(sprite) : (newLayer = [sprite]);
                this.sprites.set(newZ, newLayer);
            }
        }
    }

    removeSprite(id: number, animation: boolean) {
        this.sprites.forEach(function (layer) {
            layer.some(function (sprite, index, object) {
                if (sprite.getId() === id) {
                    object.splice(index, 1);
                    return true; // break
                }
                return false;
            });
        });
        if (animation) {
            this.animations.some(function (sprite, index, object) {
                if (sprite.getId() === id) {
                    object.splice(index, 1);
                    return true; // break
                }
                return false;
            });
        }
    }

    checkCollision(source: RoSprite, multiple: boolean): BrsType {
        const sourceFlags = source.getFlags();
        const sourceCircle = source.getCircle();
        const sourceRect = source.getRect();
        const sourceType = source.getType();
        let collision: BrsType;
        let collisions: RoSprite[] = [];
        collision = BrsInvalid.Instance;
        for (let [z, layer] of this.sprites) {
            layer.some(function (target, index, object) {
                if (source.getId() !== target.getId()) {
                    let targetFlags = target.getFlags();
                    let targetType = target.getType();
                    if (sourceFlags.memberFlags === targetFlags.memberFlags) {
                        // TODO: Correctly check the flags using bitwise operation
                        let collided = false;
                        if (sourceType < 2 && targetType < 2) {
                            collided = RectRect(sourceRect, target.getRect());
                        } else if (sourceType === 2 && targetType === 2) {
                            collided = CircleCircle(sourceCircle, target.getCircle());
                        } else if (sourceType === 2) {
                            collided = RectCircle(target.getRect(), sourceCircle);
                        } else {
                            collided = RectCircle(sourceRect, target.getCircle());
                        }
                        if (collided) {
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

    drawSprites() {
        let ctx = this.context;
        let rgba = this.rgbaBackground ? this.rgbaBackground : 0;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = rgbaIntToHex(rgba);
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.destBitmap) {
            this.destBitmap.drawImage(this.canvas, 0, 0);
        }
        let layers = [...this.sprites.keys()].sort((a, b) => a - b);
        layers.forEach((z) => {
            const layer = this.sprites.get(z);
            if (layer) {
                layer.forEach((sprite) => {
                    if (sprite.visible()) {
                        ctx.putImageData(sprite.getImageData(), sprite.getPosX(), sprite.getPosY());
                        if (this.destBitmap) {
                            this.destBitmap.drawImage(this.canvas, 0, 0);
                        }
                    }
                });
            }
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roCompositor>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Set the destBitmap (roBitmap or roScreen) and the background color */
    private setDrawTo = new Callable("setDrawTo", {
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
            this.destBitmap = destBitmap;
            this.canvas.width = destBitmap.getCanvas().width;
            this.canvas.height = destBitmap.getCanvas().height;
            this.rgbaBackground = rgbaBackground.getValue();
            return BrsInvalid.Instance;
        },
    });

    /** Create a new sprite, using an roRegion to define the sprite's bitmap. */
    private newSprite = new Callable("newSprite", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("region", ValueKind.Object),
                new StdlibArgument("z", ValueKind.Int32, new Int32(0)),
            ],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, x: Int32, y: Int32, region: RoRegion, z: Int32) => {
            if (region instanceof RoRegion) {
                let sprite = new RoSprite(x, y, region, z, this.spriteId++, this);
                let layer = this.sprites.get(z.getValue());
                layer ? layer.push(sprite) : (layer = [sprite]);
                this.sprites.set(z.getValue(), layer);
                return sprite;
            } else {
                postMessage("warning,BRIGHTSCRIPT: ERROR: roCompositor.newSprite: invalid region parameter type roInvalid:"); // TODO: add location
            }
            return BrsInvalid.Instance;
        },
    });

    /** Create a new sprite that consists of a sequence of frames to be animated. The frames are defined by the regionArray which is an roArray of roRegions. */
    private newAnimatedSprite = new Callable("newAnimatedSprite", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("regionArray", ValueKind.Object),
                new StdlibArgument("z", ValueKind.Int32, new Int32(0)),
            ],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, x: Int32, y: Int32, regionArray: RoArray, z: Int32) => {
            if (regionArray instanceof RoArray) {
                const regions = regionArray.getElements();
                if (regions && regions.length > 0) {
                    if (regions[0] instanceof RoRegion) {
                        let sprite = new RoSprite(x, y, regionArray, z, this.spriteId++, this);
                        let layer = this.sprites.get(z.getValue());
                        layer ? layer.push(sprite) : (layer = [sprite]);
                        this.sprites.set(z.getValue(), layer);
                        this.animations.push(sprite);
                        return sprite;
                    } else {
                        postMessage("warning,BRIGHTSCRIPT: ERROR: roCompositor.newAnimatedSprite: invalid regionArray item type is roInvalid:"); // TODO: add location
                    }
                } else {
                    postMessage("warning,BRIGHTSCRIPT: ERROR: roCompositor.newAnimatedSprite: invalid regionArray is empty:"); // TODO: add location
                }
            } else {
                postMessage("warning,BRIGHTSCRIPT: ERROR: roCompositor.newAnimatedSprite: invalid regionArray parameter type roInvalid:"); // TODO: add location
            }
            return BrsInvalid.Instance;
        },
    });

    /** Duration is the number of ms since the last call. Moves all animated sprites. Sprites will not animate unless you call this function regularly  */
    private animationTick = new Callable("animationTick", {
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
    private draw = new Callable("draw", {
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
    private drawAll = new Callable("drawAll", {
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

export interface Circle {
    x: number;
    y: number;
    r: number;
}

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

function RectRect(rect1: Rect, rect2: Rect): boolean {
    return (
        rect1.x < rect2.x + rect2.w &&
        rect1.x + rect1.w > rect2.x &&
        rect1.y < rect2.y + rect2.h &&
        rect1.y + rect1.h > rect2.y
    );
}

// return true if the rectangle and circle are colliding
// from: https://stackoverflow.com/questions/21089959/detecting-collision-of-rectangle-with-circle
function RectCircle(rect: Rect, circle: Circle): boolean {
    var distX = Math.abs(circle.x - rect.x - rect.w / 2);
    var distY = Math.abs(circle.y - rect.y - rect.h / 2);

    if (distX > rect.w / 2 + circle.r) {
        return false;
    }
    if (distY > rect.h / 2 + circle.r) {
        return false;
    }

    if (distX <= rect.w / 2) {
        return true;
    }
    if (distY <= rect.h / 2) {
        return true;
    }

    var dx = distX - rect.w / 2;
    var dy = distY - rect.h / 2;
    return dx * dx + dy * dy <= circle.r * circle.r;
}

// ported from: https://github.com/Romans-I-XVI/monoEngine/blob/master/MonoEngine/CollisionChecking.cs
function CircleCircle(circle1: Circle, circle2: Circle): boolean {
    let distanceX = circle1.x - circle2.x;
    let distanceY = circle1.y - circle2.y;
    var dist = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    return dist <= circle1.r + circle2.r;
}
