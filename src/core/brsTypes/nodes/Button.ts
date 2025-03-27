import { FieldModel } from "./Field";
import {
    AAMember,
    BrsString,
    Float,
    Label,
    Poster,
    brsValueOf,
    rootObjects,
    jsValueOf,
    Font,
    getTextureManager,
} from "..";
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
        { name: "focusable", type: "boolean", value: "true" },
    ];
    static readonly focusUri = "common:/images/focus_list.9.png";
    static readonly footprintUri = "common:/images/focus_footprint.9.png";
    static readonly iconUriHD = "common:/images/icon_generic_HD.png";
    static readonly iconUriFHD = "common:/images/icon_generic_FHD.png";

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

        if (rootObjects.rootScene?.ui.resolution === "FHD") {
            this.margin = 36;
            this.gap = 18;
            this.width = 375;
            this.iconWidth = 36;
            this.iconHeight = 36;
            this.labelWidth = this.width - this.margin * 2 - this.iconWidth - this.gap;
            this.setFieldValue("height", new Float(96));
            this.setFieldValue("minWidth", new Float(375));
            this.setFieldValue("iconUri", new BrsString(Button.iconUriFHD));
            this.setFieldValue("focusedIconUri", new BrsString(Button.iconUriFHD));
            this.background = this.addPoster("", [0, 0], 96, this.width);
            this.icon = this.addPoster(
                Button.iconUriFHD,
                [this.margin, 30],
                this.iconHeight,
                this.iconWidth
            );
            const labelTrans = [this.margin + this.iconWidth + this.gap, 30];
            this.textLabel = this.addLabel(
                "textColor",
                labelTrans,
                this.labelWidth,
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
            this.setFieldValue("height", new Float(64));
            this.setFieldValue("minWidth", new Float(250));
            this.setFieldValue("iconUri", new BrsString(Button.iconUriHD));
            this.setFieldValue("focusedIconUri", new BrsString(Button.iconUriHD));
            this.background = this.addPoster("", [0, 0], 64, this.width);
            this.icon = this.addPoster(
                Button.iconUriHD,
                [this.margin, 20],
                this.iconHeight,
                this.iconWidth
            );
            const labelTrans = [this.margin + this.iconWidth + this.gap, 20];
            this.textLabel = this.addLabel(
                "textColor",
                labelTrans,
                this.labelWidth,
                "center",
                "right"
            );
        }
        this.setFieldValue("focusBitmapUri", new BrsString(Button.focusUri));
        this.setFieldValue("focusFootprintBitmapUri", new BrsString(Button.footprintUri));
    }

    private addPoster(defaultUri: string, translation: number[], height?: number, width?: number) {
        const poster = new Poster();
        if (defaultUri) {
            poster.set(new BrsString("uri"), new BrsString(defaultUri));
        }
        poster.set(new BrsString("translation"), brsValueOf(translation));
        if (height) {
            poster.set(new BrsString("height"), new Float(height));
        }
        if (width) {
            poster.set(new BrsString("width"), new Float(width));
        }
        this.children.push(poster);
        poster.setNodeParent(this);
        return poster;
    }

    private addLabel(
        colorField: string,
        translation: number[],
        width?: number,
        vertAlign?: string,
        horizAlign?: string
    ) {
        const label = new Label();
        this.copyField(label, "color", colorField);
        if (width) {
            label.set(new BrsString("width"), new Float(width));
        }
        label.set(new BrsString("translation"), brsValueOf(translation));
        if (vertAlign) {
            label.set(new BrsString("vertalign"), new BrsString(vertAlign));
        }
        if (horizAlign) {
            label.set(new BrsString("horizalign"), new BrsString(horizAlign));
        }
        this.children.push(label);
        label.setNodeParent(this);
        return label;
    }

    private updateChildren(nodeFocus: boolean) {
        const minWidth = jsValueOf(this.getFieldValue("minWidth"));
        const maxWidth = jsValueOf(this.getFieldValue("maxWidth"));
        const iconUri = this.getFieldValue(nodeFocus ? "focusedIconUri" : "iconUri") as BrsString;
        this.updateIconSize(iconUri.value);
        const iconSpace = Math.max(this.iconWidth, this.iconSize[0]);
        const iconGap = iconSpace > 0 ? iconSpace + this.gap : 0;
        const labelMin = minWidth - this.margin * 2 - iconGap;
        const labelMax = maxWidth - this.margin * 2 - iconGap;

        const text = this.getFieldValue("text") as BrsString;
        const font = this.getFieldValue(nodeFocus ? "focusedTextFont" : "textFont") as Font;
        const drawFont = font.createDrawFont();
        const measured = drawFont.measureText(text.value, labelMax);
        const labelCalc = Math.max(measured.width, labelMin);
        this.width = Math.max(labelCalc + this.margin * 2 + iconGap, minWidth);
        this.labelWidth = this.width - this.margin * 2 - iconGap + 1;

        const height = jsValueOf(this.getFieldValue("height")) as number;
        const labelTrans = [this.margin + iconGap, height / 2 - measured.height / 2];

        const showFootprint = jsValueOf(this.getFieldValue("showFocusFootprint"));
        const footprint = showFootprint ? "focusFootprintBitmapUri" : "";
        if (nodeFocus || footprint) {
            const backgroundUri = this.getFieldValue(nodeFocus ? "focusBitmapUri" : footprint);
            this.background.set(new BrsString("uri"), backgroundUri);
        } else {
            this.background.set(new BrsString("uri"), new BrsString(""));
        }
        this.background.set(new BrsString("width"), new Float(this.width));
        this.background.set(new BrsString("height"), new Float(height));

        const color = this.getFieldValue(nodeFocus ? "focusedTextColor" : "textColor");
        this.textLabel.set(new BrsString("translation"), brsValueOf(labelTrans));
        this.textLabel.set(new BrsString("width"), new Float(this.labelWidth));
        this.textLabel.set(new BrsString("color"), color);
        this.textLabel.set(new BrsString("font"), font);
        this.textLabel.set(new BrsString("text"), text);

        const iconTrans = [this.margin, height / 2 - this.iconHeight / 2];
        this.icon.set(new BrsString("translation"), brsValueOf(iconTrans));
        this.icon.set(new BrsString("width"), new Float(this.iconWidth));
        this.icon.set(new BrsString("height"), new Float(this.iconHeight));
        this.icon.set(new BrsString("uri"), iconUri);
        this.icon.set(new BrsString("blendColor"), color);
    }

    private updateIconSize(uri: string) {
        let width = 0;
        let height = 0;
        if (uri) {
            const bmp = getTextureManager().loadTexture(uri);
            if (bmp) {
                width = bmp.width;
                height = bmp.height;
            }
        }
        this.iconWidth = width;
        this.iconHeight = height;
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const nodeFocus = rootObjects.focused === this;
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
        if (this.isDirty) {
            this.updateChildren(nodeFocus);
            this.isDirty = false;
        }
        this.updateBoundingRects(rect, origin, angle);
        this.renderChildren(interpreter, drawTrans, rotation, draw2D);
        this.updateParentRects(origin, angle);
    }
}
