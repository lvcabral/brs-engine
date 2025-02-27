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
    ];
    private readonly focusUri = "common:/images/focus_list.9.png";
    private readonly footprintUri = "common:/images/focus_footprint.9.png";
    private readonly iconUriHD = "common:/images/icon_generic_HD.png";
    private readonly iconUriFHD = "common:/images/icon_generic_FHD.png";

    private readonly resolution: string;
    private readonly background: Poster;
    private readonly textLabel: Label;
    private readonly icon: Poster;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Button") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        if (rootObjects.rootScene?.ui && rootObjects.rootScene.ui.resolution === "FHD") {
            this.resolution = "FHD";
            this.setFieldValue("height", new Float(96));
            this.setFieldValue("minWidth", new Float(375));
            this.setFieldValue("iconUri", new BrsString(this.iconUriFHD));
            this.setFieldValue("focusedIconUri", new BrsString(this.iconUriFHD));
            this.background = this.addPoster("", [0, 0], 96, 375);
            this.icon = this.addPoster(this.iconUriFHD, [36, 30], 36, 36);
            this.textLabel = this.addLabel("textColor", [90, 30], 249, "center", "right");
        } else {
            this.resolution = "HD";
            this.setFieldValue("height", new Float(64));
            this.setFieldValue("minWidth", new Float(250));
            this.setFieldValue("iconUri", new BrsString(this.iconUriHD));
            this.setFieldValue("focusedIconUri", new BrsString(this.iconUriHD));
            this.background = this.addPoster("", [0, 0], 64, 250);
            this.icon = this.addPoster(this.iconUriHD, [24, 20], 24, 24);
            this.textLabel = this.addLabel("textColor", [60, 20], 166, "center", "right");
        }
        this.setFieldValue("focusBitmapUri", new BrsString(this.focusUri));
        this.setFieldValue("focusFootprintBitmapUri", new BrsString(this.footprintUri));
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
        const labelFields = label.getNodeFields();
        const color = this.fields.get(colorField.toLowerCase());
        if (color) {
            labelFields.set("color", color);
        }
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
        const showFootprint = jsValueOf(this.getFieldValue("showFocusFootprint"));
        const footprint = showFootprint ? "focusFootprintBitmapUri" : "";
        if (nodeFocus || footprint) {
            const backgroundUri = this.getFieldValue(nodeFocus ? "focusBitmapUri" : footprint);
            this.background.set(new BrsString("uri"), backgroundUri);
        } else {
            this.background.set(new BrsString("uri"), new BrsString(""));
        }
        this.background.set(new BrsString("width"), this.getFieldValue("width"));
        this.background.set(new BrsString("height"), this.getFieldValue("height"));

        const color = this.getFieldValue(nodeFocus ? "focusedTextColor" : "textColor");
        this.textLabel.set(new BrsString("color"), color);
        const font = this.getFieldValue(nodeFocus ? "focusedTextFont" : "textFont") as Font;
        this.textLabel.set(new BrsString("font"), font);

        const text = this.getFieldValue("text") as BrsString;
        const drawFont = font.createDrawFont();
        const minWidth = jsValueOf(this.getFieldValue("minWidth"));
        const maxWidth = jsValueOf(this.getFieldValue("maxWidth"));
        const measured = drawFont.measureTextWidth(text.value, maxWidth);
        this.textLabel.set(new BrsString("text"), text);
        this.textLabel.set(new BrsString("width"), new Float(Math.max(measured.width, minWidth)));

        const iconUri = this.getFieldValue(nodeFocus ? "focusedIconUri" : "iconUri");
        this.icon.set(new BrsString("uri"), iconUri);
        this.icon.set(new BrsString("blendColor"), color);
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const nodeFocus = interpreter.environment.getFocusedNode() === this;
        const nodeTrans = this.getTranslation();
        const drawTrans = angle !== 0 ? rotateTranslation(nodeTrans, angle) : nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };
        const rotation = angle + this.getRotation();
        this.updateChildren(nodeFocus);

        this.updateBoundingRects(rect, origin, angle);
        this.renderChildren(interpreter, drawTrans, rotation, draw2D);
        this.updateParentRects(origin, angle);
    }
}
