import { Field, FieldModel } from "./Field";
import {
    AAMember,
    BrsString,
    Float,
    Label,
    Poster,
    Font,
    Timer,
    BrsBoolean,
    brsValueOf,
    rootObjects,
} from "..";
import { Group } from "./Group";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";

export class Overhang extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "color", type: "color", value: "0x232323ff" },
        { name: "backgroundUri", type: "uri" },
        { name: "logoUri", type: "uri" },
        { name: "logoBaselineOffset", type: "float", value: "0.0" },
        { name: "title", type: "string" },
        { name: "titleColor", type: "color", value: "0xddddddff" },
        { name: "showClock", type: "boolean", value: "true" },
        { name: "clockColor", type: "color", value: "0xddddddff" },
        { name: "clockText", type: "string" },
        { name: "showOptions", type: "boolean", value: "false" },
        { name: "optionsColor", type: "color", value: "0xddddddff" },
        { name: "optionsDimColor", type: "color", value: "0xdddddd44" },
        { name: "optionsIconColor", type: "color", value: "0xFFFFFFFF" },
        { name: "optionsIconDimColor", type: "color", value: "0xFFFFFF44" },
        { name: "optionsAvailable", type: "boolean", value: "false" },
        { name: "optionsText", type: "string" },
        { name: "optionsMaxWidth", type: "float", value: "0.0" },
        { name: "leftDividerUri", type: "uri" },
        { name: "leftDividerVertOffset", type: "float", value: "0.0" },
        { name: "rightDividerUri", type: "uri" },
        { name: "rightDividerVertOffset", type: "float", value: "0.0" },
        { name: "height", type: "float", value: "115" },
    ];
    private readonly background: Poster;
    private readonly optionsIcon: Poster;
    private readonly optionsText: Label;
    private readonly logo: Poster;
    private readonly leftDivider: Poster;
    private readonly rightDivider: Poster;
    private readonly title: Label;
    private readonly clockText: Label;
    private readonly defaultLogoHD: string = "common:/images/logo_roku_HD.png";
    private readonly defaultLogoFHD: string = "common:/images/logo_roku_FHD.png";
    private readonly optionsOn: string = "common:/images/icon_options.png";
    private readonly optionsOff: string = "common:/images/icon_options_off.png";
    private readonly dividerHD: string = "common:/images/divider_vertical_HD.png";
    private readonly dividerFHD: string = "common:/images/divider_vertical_FHD.png";
    private readonly width: number;
    private readonly resolution: string;
    private realign: boolean = false;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Overhang") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        if (rootObjects.rootScene?.ui && rootObjects.rootScene.ui.resolution === "FHD") {
            this.width = 1920;
            this.resolution = "FHD";
            this.setFieldValue("width", new Float(this.width));
            this.setFieldValue("height", new Float(172));
            this.background = this.addPoster("", [0, 0], 172, this.width);
            this.logo = this.addPoster(this.defaultLogoFHD, [102, 63]);
            this.leftDivider = this.addPoster(this.dividerFHD, [261, 59], 51, 12);
            this.title = this.addLabel("titleColor", [297, 58], 50, 45, "bottom");
            this.optionsIcon = this.addPoster(this.optionsOff, [1421, 67], 30, 30);
            this.optionsText = this.addLabel("optionsColor", [1460, 64], 40, 33, "center", "right");
            this.rightDivider = this.addPoster(this.dividerFHD, [1646, 59], 51, 12);
            this.clockText = this.addLabel("clockColor", [1682, 64], 40, 33, "center");
        } else {
            this.width = 1280;
            this.resolution = "HD";
            this.setFieldValue("width", new Float(this.width));
            this.setFieldValue("height", new Float(115));
            this.background = this.addPoster("", [0, 0], 115, this.width);
            this.logo = this.addPoster(this.defaultLogoHD, [68, 42]);
            this.leftDivider = this.addPoster(this.dividerHD, [174, 39], 34, 8);
            this.title = this.addLabel("titleColor", [196, 39], 35, 30, "bottom");
            this.optionsIcon = this.addPoster(this.optionsOff, [959, 46], 20, 20);
            this.optionsText = this.addLabel("optionsColor", [985, 44], 27, 22, "center", "right");
            this.rightDivider = this.addPoster(this.dividerHD, [1109, 39], 34, 8);
            this.clockText = this.addLabel("clockColor", [1133, 44], 27, 22, "center");
        }
        this.optionsText.set(new BrsString("text"), new BrsString("for Options"));
        this.clockText.set(new BrsString("text"), new BrsString(this.getTime()));
        const clock = new Timer();
        clock.setCallback(() => {
            this.clockText.set(new BrsString("text"), new BrsString(this.getTime()));
        });
        clock.set(new BrsString("repeat"), BrsBoolean.True);
        clock.set(new BrsString("control"), new BrsString("start"));
        this.children.push(clock);
        clock.setNodeParent(this);
    }

    private getTime() {
        // TODO: Format time based on locale
        const now = new Date();
        return now
            .toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "numeric",
                hour12: true,
            })
            .toLowerCase();
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
        height: number,
        fontSize: number,
        vertAlign?: string,
        horizAlign?: string
    ) {
        const label = new Label();
        const labelFields = label.getNodeFields();
        const color = this.fields.get(colorField.toLowerCase());
        if (color) {
            labelFields.set("color", color);
        }
        const labelFont = labelFields.get("font")?.getValue();
        if (labelFont && labelFont instanceof Font) {
            labelFont.setSize(fontSize);
        }
        label.set(new BrsString("height"), new Float(height));
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

    private updateChildren(realign: boolean) {
        const backgroundUri = this.getFieldValue("backgroundUri") as BrsString;
        if (backgroundUri?.value) {
            this.background.set(new BrsString("uri"), backgroundUri);
        }
        const logoUri = this.getFieldValue("logoUri") as BrsString;
        if (logoUri?.value) {
            this.logo.set(new BrsString("uri"), logoUri);
        }
        const title = this.getFieldValue("title") as BrsString;
        if (title?.value) {
            this.title.set(new BrsString("text"), title);
            this.leftDivider.set(new BrsString("visible"), BrsBoolean.True);
        } else {
            this.leftDivider.set(new BrsString("visible"), BrsBoolean.False);
        }
        const showOptions = this.getFieldValue("showOptions") as BrsBoolean;
        this.optionsIcon.set(new BrsString("visible"), showOptions);
        this.optionsText.set(new BrsString("visible"), showOptions);
        const showClock = this.getFieldValue("showClock") as BrsBoolean;
        this.clockText.set(new BrsString("visible"), showClock);
        if (showClock.toBoolean() && showOptions.toBoolean()) {
            this.rightDivider.set(new BrsString("visible"), BrsBoolean.True);
        } else {
            this.rightDivider.set(new BrsString("visible"), BrsBoolean.False);
        }
        const optionsAvailable = this.getFieldValue("optionsAvailable") as BrsBoolean;
        if (optionsAvailable?.toBoolean()) {
            this.optionsIcon.set(new BrsString("uri"), new BrsString(this.optionsOn));
            const optionsColor = this.getNodeFields().get("optionscolor") as Field;
            this.optionsText.getNodeFields().set("color", optionsColor);
        } else {
            this.optionsIcon.set(new BrsString("uri"), new BrsString(this.optionsOff));
            const optionsColor = this.getNodeFields().get("optionsdimcolor") as Field;
            this.optionsText.getNodeFields().set("color", optionsColor);
        }
        const optionsText = this.getFieldValue("optionsText") as BrsString;
        if (optionsText?.value) {
            this.optionsText.set(new BrsString("text"), optionsText);
        }
        const leftDividerUri = this.getFieldValue("leftDividerUri") as BrsString;
        if (leftDividerUri?.value) {
            this.leftDivider.set(new BrsString("uri"), leftDividerUri);
        }
        const rightDividerUri = this.getFieldValue("rightDividerUri") as BrsString;
        if (rightDividerUri?.value) {
            this.rightDivider.set(new BrsString("uri"), rightDividerUri);
        }
        if (realign) {
            this.alignChildren(showClock.toBoolean());
        }
    }

    private alignChildren(showClock: boolean) {
        const isFHD = this.resolution === "FHD";
        const leftAlignX = isFHD ? 102 : 68;
        const logoWidth = this.logo.rectLocal.width;
        const optionsWidth = this.optionsText.rectLocal.width ?? (isFHD ? 168 : 112);
        const clockTextWidth = showClock ? this.clockText.rectLocal.width : 0;
        const clockOffset = isFHD ? 60 : 40;
        const optionsOffset = showClock ? optionsWidth + clockOffset : optionsWidth;
        const rightAlignX = this.width - leftAlignX - clockTextWidth;
        const translation = new BrsString("translation");
        if (isFHD) {
            this.logo.set(translation, brsValueOf([leftAlignX, 63]));
            this.leftDivider.set(translation, brsValueOf([leftAlignX + logoWidth + 24, 59]));
            this.title.set(translation, brsValueOf([leftAlignX + logoWidth + 56, 58]));
            this.optionsIcon.set(translation, brsValueOf([rightAlignX - optionsOffset - 36, 67]));
            this.optionsText.set(translation, brsValueOf([rightAlignX - optionsOffset, 64]));
            this.rightDivider.set(translation, brsValueOf([rightAlignX - 36, 59]));
            this.clockText.set(translation, brsValueOf([rightAlignX, 64]));
        } else {
            this.logo.set(translation, brsValueOf([leftAlignX, 42]));
            this.leftDivider.set(translation, brsValueOf([leftAlignX + logoWidth + 16, 41]));
            this.title.set(translation, brsValueOf([leftAlignX + logoWidth + 38, 39]));
            this.optionsIcon.set(translation, brsValueOf([rightAlignX - optionsOffset - 24, 46]));
            this.optionsText.set(translation, brsValueOf([rightAlignX - optionsOffset, 44]));
            this.rightDivider.set(translation, brsValueOf([rightAlignX - 24, 41]));
            this.clockText.set(translation, brsValueOf([rightAlignX, 44]));
        }
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        if (this.isDirty) {
            this.updateChildren(this.realign);
            this.realign = true;
            this.isDirty = false;
        }
        const size = this.getDimensions();
        const rect = { x: origin[0], y: origin[1], width: size.width, height: size.height };
        this.updateBoundingRects(rect, origin, angle);
        this.renderChildren(interpreter, origin, angle, draw2D);
        this.updateParentRects(origin, angle);
    }
}
