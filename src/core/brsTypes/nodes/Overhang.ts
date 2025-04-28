import { Field, FieldKind, FieldModel } from "./Field";
import { AAMember, BrsString, Float, Label, Poster, Timer, BrsBoolean, BrsType } from "..";
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
    private realign: boolean;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Overhang") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        if (this.resolution === "FHD") {
            this.width = 1920;
            this.setFieldValue("width", new Float(this.width));
            this.setFieldValue("height", new Float(172));
            this.background = this.addPoster("", [0, 0], this.width, 172);
            this.logo = this.addPoster(this.defaultLogoFHD, [102, 63]);
            this.leftDivider = this.addPoster(this.dividerFHD, [261, 59], 12, 51);
            this.title = this.addLabel("titleColor", [297, 58], 0, 50, 45, "bottom");
            this.optionsIcon = this.addPoster(this.optionsOff, [1421, 67], 30, 30);
            this.optionsText = this.addLabel("optionsColor", [1460, 64], 0, 40, 33, "center", "right");
            this.rightDivider = this.addPoster(this.dividerFHD, [1646, 59], 12, 51);
            this.clockText = this.addLabel("clockColor", [1682, 64], 0, 40, 33, "center");
        } else {
            this.width = 1280;
            this.setFieldValue("width", new Float(this.width));
            this.setFieldValue("height", new Float(115));
            this.background = this.addPoster("", [0, 0], this.width, 115);
            this.logo = this.addPoster(this.defaultLogoHD, [68, 42]);
            this.leftDivider = this.addPoster(this.dividerHD, [174, 39], 8, 34);
            this.title = this.addLabel("titleColor", [196, 39], 0, 35, 30, "bottom");
            this.optionsIcon = this.addPoster(this.optionsOff, [959, 46], 20, 20);
            this.optionsText = this.addLabel("optionsColor", [985, 44], 0, 27, 22, "center", "right");
            this.rightDivider = this.addPoster(this.dividerHD, [1109, 39], 8, 34);
            this.clockText = this.addLabel("clockColor", [1133, 44], 0, 27, 22, "center");
        }
        this.optionsText.set(new BrsString("text"), new BrsString("for Options"));
        this.clockText.set(new BrsString("text"), new BrsString(this.getTime()));
        const clock = new Timer();
        clock.setCallback(() => {
            this.clockText.set(new BrsString("text"), new BrsString(this.getTime()));
        });
        clock.set(new BrsString("repeat"), BrsBoolean.True);
        clock.set(new BrsString("control"), new BrsString("start"));
        this.appendChildToParent(clock);
        this.realign = false;
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

    private updateChildren() {
        this.copyField(this.background, "height");
        const backUri = this.getFieldValueJS("backgroundUri") as string;
        if (backUri) {
            this.background.set(new BrsString("uri"), new BrsString(backUri));
        }
        const logoUri = this.getFieldValueJS("logoUri") as string;
        if (logoUri) {
            this.logo.set(new BrsString("uri"), new BrsString(logoUri));
        }
        const title = this.getFieldValueJS("title") as string;
        if (title) {
            this.title.set(new BrsString("text"), new BrsString(title));
            this.leftDivider.set(new BrsString("visible"), BrsBoolean.True);
        } else {
            this.leftDivider.set(new BrsString("visible"), BrsBoolean.False);
        }
        const showOptions = this.getFieldValueJS("showOptions") as boolean;
        this.optionsIcon.set(new BrsString("visible"), BrsBoolean.from(showOptions));
        this.optionsText.set(new BrsString("visible"), BrsBoolean.from(showOptions));
        const showClock = this.getFieldValueJS("showClock") as boolean;
        this.clockText.set(new BrsString("visible"), BrsBoolean.from(showClock));
        if (showClock && showOptions) {
            this.rightDivider.set(new BrsString("visible"), BrsBoolean.True);
        } else {
            this.rightDivider.set(new BrsString("visible"), BrsBoolean.False);
        }
        const optionsAvailable = this.getFieldValueJS("optionsAvailable") as boolean;
        if (optionsAvailable) {
            this.optionsIcon.set(new BrsString("uri"), new BrsString(this.optionsOn));
            this.copyField(this.optionsText, "color", "optionsColor");
        } else {
            this.optionsIcon.set(new BrsString("uri"), new BrsString(this.optionsOff));
            this.copyField(this.optionsText, "color", "optionsDimColor");
        }
        const optionsText = this.getFieldValueJS("optionsText") as string;
        if (optionsText) {
            this.optionsText.set(new BrsString("text"), new BrsString(optionsText));
        }
        const leftDividerUri = this.getFieldValueJS("leftDividerUri") as string;
        if (leftDividerUri) {
            this.leftDivider.set(new BrsString("uri"), new BrsString(leftDividerUri));
        }
        const rightDividerUri = this.getFieldValueJS("rightDividerUri") as string;
        if (rightDividerUri) {
            this.rightDivider.set(new BrsString("uri"), new BrsString(rightDividerUri));
        }
        this.isDirty = false;
    }

    private alignChildren() {
        const isFHD = this.resolution === "FHD";
        const leftAlignX = isFHD ? 102 : 68;
        const logoWidth = this.logo.rectLocal.width;
        const optionsWidth = this.optionsText.rectLocal.width ?? (isFHD ? 168 : 112);
        const showClock = this.getFieldValueJS("showClock") as boolean;
        const clockTextWidth = showClock ? this.clockText.rectLocal.width : 0;
        const clockOffset = isFHD ? 60 : 40;
        const optionsOffset = showClock ? optionsWidth + clockOffset : optionsWidth;
        const rightAlignX = this.width - leftAlignX - clockTextWidth;
        if (isFHD) {
            this.logo.setTranslation([leftAlignX, 63]);
            this.leftDivider.setTranslation([leftAlignX + logoWidth + 24, 59]);
            this.title.setTranslation([leftAlignX + logoWidth + 56, 58]);
            this.optionsIcon.setTranslation([rightAlignX - optionsOffset - 36, 67]);
            this.optionsText.setTranslation([rightAlignX - optionsOffset, 64]);
            this.rightDivider.setTranslation([rightAlignX - 36, 59]);
            this.clockText.setTranslation([rightAlignX, 64]);
        } else {
            this.logo.setTranslation([leftAlignX, 42]);
            this.leftDivider.setTranslation([leftAlignX + logoWidth + 16, 41]);
            this.title.setTranslation([leftAlignX + logoWidth + 38, 39]);
            this.optionsIcon.setTranslation([rightAlignX - optionsOffset - 24, 46]);
            this.optionsText.setTranslation([rightAlignX - optionsOffset, 44]);
            this.rightDivider.setTranslation([rightAlignX - 24, 41]);
            this.clockText.setTranslation([rightAlignX, 44]);
        }
        this.realign = false;
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        this.realign = true;
        return super.set(index, value, alwaysNotify, kind);
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        if (this.isDirty) {
            this.updateChildren();
        }
        const size = this.getDimensions();
        const rect = { x: origin[0], y: origin[1], width: size.width, height: size.height };
        opacity = opacity * this.getOpacity();
        this.updateBoundingRects(rect, origin, angle);
        this.renderChildren(interpreter, origin, angle, opacity, draw2D);
        this.updateParentRects(origin, angle);
        if (this.realign) {
            this.alignChildren();
        }
    }
}
