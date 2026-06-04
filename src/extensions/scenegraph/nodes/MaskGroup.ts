import {
    AAMember,
    Interpreter,
    Float,
    RoBitmap,
    IfDraw2D,
    BrsCanvasContext2D,
    createNewCanvas,
    releaseCanvas,
    drawCanvasRegion,
} from "brs-engine";
import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";
import { brsValueOf } from "../factory/Serializer";

export class MaskGroup extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "maskUri", type: "uri", value: "" },
        { name: "maskSize", type: "vector2d", value: "[0, 0]" },
        { name: "maskOffset", type: "vector2d", value: "[0, 0]" },
        { name: "maskBitmapWidth", type: "float", value: "0" },
        { name: "maskBitmapHeight", type: "float", value: "0" },
    ];
    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.MaskGroup) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            this.updateRenderTracking(true);
            return;
        }
        const maskUri = this.getValueJS("maskUri") as string;
        const maskBitmap = maskUri ? this.loadBitmap(maskUri) : undefined;
        this.updateMaskBitmapFields(maskBitmap);

        // Fallback path: with no draw target, no/invalid mask, or an empty scene, behave like a
        // plain Group. This mirrors the documented behavior on Roku players without OpenGL, where
        // a MaskGroup just renders its children without applying the alpha mask.
        if (!draw2D || !maskBitmap?.isValid() || this.sceneRect.width <= 0 || this.sceneRect.height <= 0) {
            super.renderNode(interpreter, origin, angle, opacity, draw2D);
            return;
        }

        // Render children into a scene-sized offscreen bitmap so their pixel coordinates line up
        // 1:1 with the screen, then knock out alpha with the mask and composite the result back.
        const offscreen = new RoBitmap(
            brsValueOf({ width: this.sceneRect.width, height: this.sceneRect.height, alphaEnable: true })
        );
        const offDraw = new IfDraw2D(offscreen);
        // Group.renderNode handles transforms, child rendering, bounding rects, and render tracking.
        super.renderNode(interpreter, origin, angle, opacity, offDraw);

        // The mask coordinate system origin is the group origin in scene space (translation applied).
        // Note: any rotation on the MaskGroup itself rotates the children (handled above) but the mask
        // is applied in axis-aligned scene space, which is an accepted limitation of the simulation.
        const nodeTrans = this.getTranslation();
        this.applyMask(offscreen, maskBitmap, origin[0] + nodeTrans[0], origin[1] + nodeTrans[1]);

        // Children were already drawn at the group opacity, so composite the masked result as-is.
        draw2D.doDrawScaledObject(0, 0, 1, 1, offscreen);
        releaseCanvas(offscreen.getCanvas());
    }

    /** Reports the loaded mask bitmap's actual dimensions through the read-only fields. */
    private updateMaskBitmapFields(maskBitmap?: RoBitmap) {
        const width = maskBitmap?.isValid() ? maskBitmap.width : 0;
        const height = maskBitmap?.isValid() ? maskBitmap.height : 0;
        if ((this.getValueJS("maskBitmapWidth") as number) !== width) {
            super.setValue("maskBitmapWidth", new Float(width));
        }
        if ((this.getValueJS("maskBitmapHeight") as number) !== height) {
            super.setValue("maskBitmapHeight", new Float(height));
        }
    }

    /**
     * Multiplies the alpha of the already-rendered offscreen bitmap by the alpha of the mask bitmap.
     * The mask is scaled by maskSize (a 0 element means "use the bitmap's actual size in that
     * dimension") and offset by maskOffset relative to the group origin. Where the transformed mask
     * does not cover the group, the nearest edge row/column of the mask is repeated (edge-clamp).
     */
    private applyMask(offscreen: RoBitmap, maskBitmap: RoBitmap, originX: number, originY: number) {
        const maskSize = this.getValueJS("maskSize") as number[];
        const maskOffset = this.getValueJS("maskOffset") as number[];
        const bw = maskBitmap.width;
        const bh = maskBitmap.height;
        if (bw <= 0 || bh <= 0) {
            return;
        }
        const mw = maskSize[0] > 0 ? maskSize[0] : bw;
        const mh = maskSize[1] > 0 ? maskSize[1] : bh;
        const mx = originX + maskOffset[0];
        const my = originY + maskOffset[1];
        const sceneW = offscreen.width;
        const sceneH = offscreen.height;

        // Build the mask alpha layer, filling the whole scene with edge-clamping outside the mask rect.
        const maskLayer = createNewCanvas(sceneW, sceneH);
        const mctx = maskLayer.getContext("2d") as BrsCanvasContext2D;
        mctx.imageSmoothingEnabled = true;
        const src = maskBitmap.getCanvas();

        const blit = (
            sx: number,
            sy: number,
            sw: number,
            sh: number,
            dx: number,
            dy: number,
            dw: number,
            dh: number
        ) => {
            if (dw > 0 && dh > 0) {
                drawCanvasRegion(mctx, src, sx, sy, sw, sh, dx, dy, dw, dh);
            }
        };
        const rightX = mx + mw;
        const bottomY = my + mh;
        const rightW = sceneW - rightX;
        const bottomH = sceneH - bottomY;
        // Center (the transformed mask itself).
        blit(0, 0, bw, bh, mx, my, mw, mh);
        // Edge strips (1px source slices stretched to the gap).
        blit(0, 0, 1, bh, 0, my, mx, mh); // left
        blit(bw - 1, 0, 1, bh, rightX, my, rightW, mh); // right
        blit(0, 0, bw, 1, mx, 0, mw, my); // top
        blit(0, bh - 1, bw, 1, mx, bottomY, mw, bottomH); // bottom
        // Corners (1px source slices stretched to fill).
        blit(0, 0, 1, 1, 0, 0, mx, my); // top-left
        blit(bw - 1, 0, 1, 1, rightX, 0, rightW, my); // top-right
        blit(0, bh - 1, 1, 1, 0, bottomY, mx, bottomH); // bottom-left
        blit(bw - 1, bh - 1, 1, 1, rightX, bottomY, rightW, bottomH); // bottom-right

        // Multiply the offscreen alpha by the mask alpha.
        const octx = offscreen.getContext();
        octx.save();
        octx.globalCompositeOperation = "destination-in";
        drawCanvasRegion(octx, maskLayer, 0, 0, sceneW, sceneH, 0, 0, sceneW, sceneH);
        octx.restore();
        offscreen.makeDirty();

        releaseCanvas(maskLayer);
    }
}
