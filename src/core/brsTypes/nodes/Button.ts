import { FieldModel } from "./Field";
import { AAMember, BrsString, Float, Label, Poster, sgRoot, Font, BrsBoolean } from "..";
import { Group } from "./Group";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { rotateTranslation } from "../../scenegraph/SGUtil";

export class Button extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "text", type: "string", value: "" },
        { name: "textColor", type: "color", value: "0xddddddff" },
        { name: "focusedTextColor", type: "color", value: "0x262626ff" },
        { name: "textFont", type: "font" },
        { name: "focusedTextFont", type: "font", value: "font:MediumBoldSystemFont" },
        { name: "focusBitmapUri", type: "uri", value: "" },
        { name: "focusFootprintBitmapUri", type: "uri", value: "" },
        { name: "iconUri", type: "uri", value: "" },
        { name: "focusedIconUri", type: "uri", value: "" },
        { name: "minWidth", type: "float", value: "250" },
        { name: "maxWidth", type: "float", value: "32767" },
        { name: "height", type: "float", value: "64" },
        { name: "showFocusFootprint", type: "boolean", value: "false" },
        { name: "buttonSelected", type: "boolean", value: "false", alwaysNotify: true },
    ];
    static readonly focusUri = "common:/images/focus_list.9.png";
    static readonly footprintUri = "common:/images/focus_footprint.9.png";
    static readonly iconUriHD = "common:/images/HD/icon_generic.png";
    static readonly iconUriFHD = "common:/images/FHD/icon_generic.png";

    private readonly background: Poster;
    private readonly textLabel: Label;
    private readonly icon: Poster;
    private readonly margin: number;
    private readonly gap: number;
    private width: number;
    private iconWidth: number;
    private iconHeight: number;
    private labelWidth: number;
    iconSize: number[] = [0, 0];

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Button") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        if (this.resolution === "FHD") {
            this.margin = 36;
            this.gap = 18;
            this.width = 375;
            this.iconWidth = 36;
            this.iconHeight = 36;
            this.labelWidth = this.width - this.margin * 2 - this.iconWidth - this.gap;
            this.setValueSilent("height", new Float(96));
            this.setValueSilent("minWidth", new Float(375));
            this.setValueSilent("iconUri", new BrsString(Button.iconUriFHD));
            this.setValueSilent("focusedIconUri", new BrsString(Button.iconUriFHD));
            this.background = this.addPoster("", [0, 0], this.width, 96);
            this.icon = this.addPoster(Button.iconUriFHD, [this.margin, 30], this.iconWidth, this.iconHeight);
            const labelTrans = [this.margin + this.iconWidth + this.gap, 30];
            this.textLabel = this.addLabel(
                "textColor",
                labelTrans,
                this.labelWidth,
                undefined,
                undefined,
                "center",
                "right"
            );
        } else {
            this.margin = 24;
            this.gap = 12;
            this.width = 250;
            this.iconWidth = 24;
            this.iconHeight = 24;
            this.labelWidth = this.width - this.margin * 2 - this.iconWidth - this.gap;
            this.setValueSilent("height", new Float(64));
            this.setValueSilent("minWidth", new Float(250));
            this.setValueSilent("iconUri", new BrsString(Button.iconUriHD));
            this.setValueSilent("focusedIconUri", new BrsString(Button.iconUriHD));
            this.background = this.addPoster("", [0, 0], this.width, 64);
            this.icon = this.addPoster(Button.iconUriHD, [this.margin, 20], this.iconWidth, this.iconHeight);
            const labelTrans = [this.margin + this.iconWidth + this.gap, 20];
            this.textLabel = this.addLabel(
                "textColor",
                labelTrans,
                this.labelWidth,
                undefined,
                undefined,
                "center",
                "right"
            );
        }
        this.setValueSilent("focusable", BrsBoolean.True);
        this.setValueSilent("focusBitmapUri", new BrsString(Button.focusUri));
        this.setValueSilent("focusFootprintBitmapUri", new BrsString(Button.footprintUri));
    }

    private updateChildren(nodeFocus: boolean) {
        const minWidth = this.getValueJS("minWidth") as number;
        const maxWidth = this.getValueJS("maxWidth") as number;
        const iconUri = this.getValueJS(nodeFocus ? "focusedIconUri" : "iconUri") as string;
        this.updateIconSize(iconUri);
        const iconSpace = Math.max(this.iconWidth, this.iconSize[0]);
        const iconGap = iconSpace > 0 ? iconSpace + this.gap : 0;
        const labelMin = minWidth - this.margin * 2 - iconGap;
        const labelMax = maxWidth - this.margin * 2 - iconGap;

        const text = this.getValueJS("text") as string;
        const font = this.getValue(nodeFocus ? "focusedTextFont" : "textFont") as Font;
        const drawFont = font.createDrawFont();
        const measured = drawFont.measureText(text, labelMax);
        const labelCalc = Math.max(measured.width, labelMin);
        this.width = Math.max(labelCalc + this.margin * 2 + iconGap, minWidth);
        this.labelWidth = this.width - this.margin * 2 - iconGap + 1;

        const height = this.getValueJS("height") as number;
        const labelTrans = [this.margin + iconGap, height / 2 - measured.height / 2];

        const showFootprint = this.getValueJS("showFocusFootprint") as boolean;
        const footprint = showFootprint ? "focusFootprintBitmapUri" : "";
        if (nodeFocus || footprint) {
            const backgroundUri = this.getValue(nodeFocus ? "focusBitmapUri" : footprint);
            this.background.setValue("uri", backgroundUri);
        } else {
            this.background.setValue("uri", new BrsString(""));
        }
        this.background.setValue("width", new Float(this.width));
        this.background.setValue("height", new Float(height));

        const color = this.getValue(nodeFocus ? "focusedTextColor" : "textColor");
        this.textLabel.setTranslation(labelTrans);
        this.textLabel.setValue("width", new Float(this.labelWidth));
        this.textLabel.setValue("color", color);
        this.textLabel.setValue("font", font);
        this.textLabel.setValue("text", new BrsString(text));

        const iconTrans = [this.margin, height / 2 - this.iconHeight / 2];
        this.icon.setTranslation(iconTrans);
        this.icon.setValue("width", new Float(this.iconWidth));
        this.icon.setValue("height", new Float(this.iconHeight));
        this.icon.setValue("uri", new BrsString(iconUri));
        this.icon.setValue("blendColor", color);
    }

    private updateIconSize(uri: string) {
        let width = 0;
        let height = 0;
        if (uri) {
            const bmp = this.loadBitmap(uri);
            if (bmp) {
                width = bmp.width;
                height = bmp.height;
            }
        }
        this.iconWidth = width;
        this.iconHeight = height;
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const nodeFocus = sgRoot.focused === this;
        const nodeTrans = this.getTranslation();
        const drawTrans = angle !== 0 ? rotateTranslation(nodeTrans, angle) : nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const rect = {
            x: drawTrans[0],
            y: drawTrans[1],
            width: size.width,
            height: Math.max(size.height, this.iconSize[1]),
        };
        const rotation = angle + this.getRotation();
        opacity = opacity * this.getOpacity();
        if (this.isDirty) {
            this.updateChildren(nodeFocus);
            this.isDirty = false;
        }
        this.updateBoundingRects(rect, origin, angle);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.updateParentRects(origin, angle);
    }
}
