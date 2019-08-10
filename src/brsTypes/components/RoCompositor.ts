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
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private destBitmap?: RoBitmap;
    private rgbaBackground?: number;
    private spriteId: number;

    constructor() {
        super("roCompositor");
        let canvas = document.createElement("canvas");
        this.canvas = canvas;
        let context = canvas.getContext("2d", { alpha: true });
        this.context =
            (context && canvas.getContext("2d", { alpha: true })) || new CanvasRenderingContext2D();
        this.spriteId = 0;
        this.registerMethods([
            this.setDrawTo,
            // this.draw,
            this.drawAll,
            this.newSprite,
            this.newAnimatedSprite,
            // this.animationTick,
            // this.changeMatchingRegions,
        ]);
    }

    toString(parent?: BrsType): string {
        return "<Component: roCompositor>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /**  */
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

    /**  */
    private newSprite = new Callable("newSprite", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("region", ValueKind.Object),
                new StdlibArgument("z", ValueKind.Int32),
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

    /**  */
    private newAnimatedSprite = new Callable("newAnimatedSprite", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("regions", ValueKind.Object),
                new StdlibArgument("z", ValueKind.Int32),
            ],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, x: Int32, y: Int32, regions: RoArray, z: Int32) => {
            let sprite = new RoSprite(x, y, regions, z, this.spriteId++, this);
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

    /** Draw the source object, at position x,y, scaled horizotally by scaleX and vertically by scaleY. */
    private drawAll = new Callable("drawAll", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            let ctx = this.context;
            let rgba = this.rgbaBackground ? this.rgbaBackground : 0;
            ctx.fillStyle = rgbaIntToHex(rgba);
            let layers = [...this.sprites.keys()].sort((a, b) => a - b);
            layers.forEach(z => {
                const layer = this.sprites.get(z);
                if (layer) {
                    layer.forEach(sprite => {
                        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                        ctx.putImageData(sprite.getImageData(), sprite.getPosX(), sprite.getPosY());
                        if (this.destBitmap) {
                            this.destBitmap.drawImage(this.canvas, 0, 0);
                        }
                    });
                }
            });
            return BrsInvalid.Instance;
        },
    });
}
