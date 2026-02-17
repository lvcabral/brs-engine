import {
    AAMember,
    Interpreter,
    BrsBoolean,
    BrsString,
    BrsType,
    isBrsString,
    RoAssociativeArray,
    IfDraw2D,
    Rect,
} from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";
import { toAssociativeArray, jsValueOf } from "../factory/Serializer";
import { sgRoot } from "../SGRoot";
import { Poster } from "./Poster";
import { RSGPalette } from "./RSGPalette";
import { rotateTranslation } from "../SGUtil";

export class StandardDialog extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "width", type: "float", value: "0.0" },
        { name: "height", type: "float", value: "0.0" },
        { name: "buttonSelected", type: "integer", value: "0", alwaysNotify: true },
        { name: "buttonFocused", type: "integer", value: "0", alwaysNotify: true },
        { name: "palette", type: "node" },
        { name: "backExitsDialog", type: "boolean", value: "true" },
        { name: "homeExitsDialog", type: "boolean", value: "true" },
        { name: "focusable", type: "boolean", value: "true" },
        { name: "close", type: "boolean", value: "false" },
        { name: "wasClosed", type: "boolean", value: "false", alwaysNotify: true },
    ];
    protected readonly dialogBackgroundUri = "common:/images/standard_dialog_background.9.png";
    protected readonly dialogDividerUri = "common:/images/dialog_divider.9.png";
    protected readonly dialogTrans: number[];
    private readonly background: Poster;
    private readonly minHeight: number;
    private readonly maxWidth: number;
    private width: number;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.StandardDialog) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

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
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "close") {
            index = "wasClosed";
            value = BrsBoolean.True;
            this.setValue("visible", BrsBoolean.False);
            sgRoot.removeDialog(this);
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

    setDefaultTranslation() {
        this.setTranslation(this.dialogTrans);
    }

    handleKey(key: string, press: boolean): boolean {
        let handled = false;
        if (key === "back") {
            const backExits = this.getValueJS("backExitsDialog") as boolean;
            if (press && backExits) {
                this.setValue("close", BrsBoolean.True);
            }
            handled = true;
        }
        return handled;
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            this.updateRenderTracking(true);
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = angle === 0 ? nodeTrans.slice() : rotateTranslation(nodeTrans, angle);
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
        this.nodeRenderingDone(origin, angle, opacity, draw2D);
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
