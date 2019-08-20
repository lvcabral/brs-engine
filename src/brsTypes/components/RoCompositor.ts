import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { RoRegion } from "./RoRegion";
import { RoBitmap, rgbaIntToHex } from "./RoBitmap";
import { RoSprite } from "./RoSprite";
import { RoArray } from "./RoArray";

export class RoCompositor extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    readonly sprites = new Map<number, RoSprite[]>();
    readonly animations = new Array<RoSprite>();
    private canvas: OffscreenCanvas;
    private context: OffscreenCanvasRenderingContext2D;
    private destBitmap?: RoBitmap;
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
        this.registerMethods([
            this.setDrawTo,
            this.draw,
            this.drawAll,
            this.newSprite,
            this.newAnimatedSprite,
            this.animationTick,
            // this.changeMatchingRegions,
        ]);
    }

    setSpriteZ(id: number, currentZ: number, newZ: number) {
        let layer = this.sprites.get(currentZ);
        if (layer) {
            let sprite;
            layer.some(function(element, index, object) {
                if (element.getId() === id) {
                    object.splice(index, 1);
                    sprite = element;
                    return true; // break
                }
                return false;
            });
            if (sprite) {
                if (this.sprites.has(newZ)) {
                    let newLayer = this.sprites.get(newZ);
                    newLayer ? newLayer.push(sprite) : (newLayer = [sprite]);
                    this.sprites.set(newZ, layer);
                } else {
                    this.sprites.set(newZ, [sprite]);
                }
            }
        }
    }

    removeSprite(id: number, animation: boolean) {
        this.sprites.forEach(function(layer) {
            layer.some(function(sprite, index, object) {
                if (sprite.getId() === id) {
                    object.splice(index, 1);
                    return true; // break
                }
                return false;
            });
        });
        if (animation) {
            this.animations.some(function(sprite, index, object) {
                if (sprite.getId() === id) {
                    object.splice(index, 1);
                    return true; // break
                }
                return false;
            });
        }
    }

    checkCollision(id: number, x: number, y: number, width: number, height: number): BrsType {
        let collide: BrsType;
        collide = BrsInvalid.Instance;
        for (let [z, layer] of this.sprites) {
            layer.some(function(sprite, index, object) {
                if (sprite.getId() !== id) {
                    let flags = sprite.getFlags();
                    let rect = sprite.getRect();
                    if (
                        flags.memberFlags > 0 && // TODO: Correctly check the flags using bitwise operation
                        x < rect.x + rect.width &&
                        x + width > rect.x &&
                        y < rect.y + rect.height &&
                        y + height > rect.y
                    ) {
                        collide = sprite;
                        return true; // break
                    }
                }
                return false;
            });
            if (collide) {
                break;
            }
        }
        return collide;
    }

    drawSprites() {
        let ctx = this.context;
        let rgba = this.rgbaBackground ? this.rgbaBackground : 0;
        ctx.fillStyle = rgbaIntToHex(rgba);
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.destBitmap) {
            this.destBitmap.drawImage(this.canvas, 0, 0);
        }
        let layers = [...this.sprites.keys()].sort((a, b) => a - b);
        layers.forEach(z => {
            const layer = this.sprites.get(z);
            if (layer) {
                layer.forEach(sprite => {
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
        impl: (_: Interpreter, destBitmap: RoBitmap, rgbaBackground: Int32) => {
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
            let sprite = new RoSprite(x, y, region, z, this.spriteId++, this);
            if (this.sprites.has(z.getValue())) {
                let layer = this.sprites.get(z.getValue());
                layer ? layer.push(sprite) : (layer = []);
                this.sprites.set(z.getValue(), layer);
            } else {
                this.sprites.set(z.getValue(), [sprite]);
            }
            return sprite;
        },
    });

    /** Create a new sprite that consists of a sequence of frames to be animated.
     *  The frames are defined by the regionArray which is an roArray of roRegions. */
    private newAnimatedSprite = new Callable("newAnimatedSprite", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("regions", ValueKind.Object),
                new StdlibArgument("z", ValueKind.Int32, new Int32(0)),
            ],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, x: Int32, y: Int32, regions: RoArray, z: Int32) => {
            // TODO: Verify if there is at least one RoRegion in the regions array
            let sprite = new RoSprite(x, y, regions, z, this.spriteId++, this);
            if (this.sprites.has(z.getValue())) {
                let layer = this.sprites.get(z.getValue());
                layer ? layer.push(sprite) : (layer = []);
                this.sprites.set(z.getValue(), layer);
            } else {
                this.sprites.set(z.getValue(), [sprite]);
            }
            this.animations.push(sprite);
            return sprite;
        },
    });

    /** Duration is the number of ms since the last call. Moves all animated sprites.
     *  Sprites will not animate unless you call this function regularly  */
    private animationTick = new Callable("animationTick", {
        signature: {
            args: [new StdlibArgument("duration", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, duration: Int32) => {
            this.animations.forEach(sprite => {
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
