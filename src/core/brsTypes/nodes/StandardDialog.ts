import { FieldKind, FieldModel } from "./Field";
import { Group } from "./Group";
import { AAMember, RoAssociativeArray } from "../components/RoAssociativeArray";
import {
    BrsBoolean,
    BrsString,
    BrsType,
    isBrsString,
    jsValueOf,
    Poster,
    sgRoot,
    RSGPalette,
    toAssociativeArray,
} from "..";
import { IfDraw2D, Rect } from "../interfaces/IfDraw2D";
import { Interpreter } from "../..";
import { rotateTranslation } from "../../scenegraph/SGUtil";

export class StandardDialog extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "width", type: "float", value: "0.0" },
        { name: "height", type: "float", value: "0.0" },
        { name: "buttonSelected", type: "integer", value: "0", alwaysNotify: true },
        { name: "buttonFocused", type: "integer", value: "0", alwaysNotify: true },
        { name: "palette", type: "node" },
        { name: "close", type: "boolean", value: "false" },
        { name: "wasClosed", type: "boolean", value: "false", alwaysNotify: true },
    ];
    protected readonly dialogBackgroundUri = "common:/images/standard_dialog_background.9.png";
    protected readonly dialogDividerUri = "common:/images/dialog_divider.9.png";
    private readonly background: Poster;
    private readonly minHeight: number;
    private readonly maxWidth: number;
    private width: number;
    private height: number;
    private dialogTrans: number[];

    constructor(initializedFields: AAMember[] = [], readonly name: string = "StandardDialog") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        if (this.resolution === "FHD") {
            this.width = 1038;
            this.maxWidth = 1380;
            this.minHeight = 270;
            this.dialogTrans = [531, 492];
            this.background = this.addPoster(this.dialogBackgroundUri, [-90, -60], this.width, this.minHeight);
        } else {
            this.width = 692;
            this.maxWidth = 920;
            this.minHeight = 180;
            this.dialogTrans = [354, 328];
            this.background = this.addPoster(this.dialogBackgroundUri, [-60, -40], this.width, this.minHeight);
        }
        this.height = this.minHeight;
        this.setTranslation(this.dialogTrans);
    }

    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "close") {
            index = "wasClosed";
            value = BrsBoolean.True;
            this.setValue("visible", BrsBoolean.False);
            if (sgRoot.scene?.dialog === this) {
                sgRoot.scene.dialog = undefined;
            }
        } else if (fieldName === "width") {
            const newWidth = jsValueOf(value) as number;
            if (newWidth > this.maxWidth) {
                value = new BrsString(this.maxWidth.toString());
            }
            this.width = jsValueOf(value) as number;
            this.background.setValue("width", value);
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = angle !== 0 ? rotateTranslation(nodeTrans, angle) : nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const boundingRect: Rect = {
            x: drawTrans[0],
            y: drawTrans[1],
            width: this.width,
            height: size.height,
        };
        const colors = this.getPaletteColors();
        const backColor = colors.get(new BrsString("DialogBackgroundColor"));
        if (isBrsString(backColor)) {
            this.background.setValue("blendColor", backColor);
        }
        opacity = opacity * this.getOpacity();
        this.updateBoundingRects(boundingRect, origin, angle);
        this.renderChildren(interpreter, drawTrans, angle, opacity, draw2D);
        this.updateParentRects(origin, angle);
    }

    getPaletteColors() {
        let palette = this.getValue("palette");
        if (!(palette instanceof RSGPalette) && sgRoot.scene) {
            palette = sgRoot.scene.getValue("palette");
        }
        if (palette instanceof RSGPalette) {
            const colors = palette.getValue("colors");
            if (colors instanceof RoAssociativeArray) {
                return colors;
            }
        }
        // Fallback to default colors
        const defaultColors = {
            DialogBackgroundColor: "0x6C6278FF",
        };
        return toAssociativeArray(defaultColors);
    }
}
