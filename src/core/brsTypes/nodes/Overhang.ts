import { FieldKind, FieldModel } from "./Field";
import {
    AAMember,
    BrsString,
    Float,
    Label,
    Poster,
    Timer,
    BrsBoolean,
    BrsType,
    Rectangle,
    isBrsNumber,
    jsValueOf,
} from "..";
import { Group } from "./Group";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { BrsDevice } from "../..";

export class Overhang extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "color", type: "color", value: "0x00000000" },
        { name: "backgroundUri", type: "uri" },
        { name: "logoUri", type: "uri" },
        { name: "logoBaselineOffset", type: "float", value: "0.0" },
        { name: "title", type: "string" },
        { name: "titleColor", type: "color", value: "0xfefefeff" },
        { name: "showClock", type: "boolean", value: "true" },
        { name: "clockColor", type: "color", value: "0xfefefeff" },
        { name: "clockText", type: "string" },
        { name: "showOptions", type: "boolean", value: "false" },
        { name: "optionsColor", type: "color", value: "0xfefefeff" },
        { name: "optionsDimColor", type: "color", value: "0xfefefe99" },
        { name: "optionsIconColor", type: "color" },
        { name: "optionsIconDimColor", type: "color" },
        { name: "optionsAvailable", type: "boolean", value: "false" },
        { name: "optionsText", type: "string" },
        { name: "optionsMaxWidth", type: "float", value: "0.0" },
        { name: "leftDividerUri", type: "uri" },
        { name: "leftDividerVertOffset", type: "float", value: "0.0" },
        { name: "rightDividerUri", type: "uri" },
        { name: "rightDividerVertOffset", type: "float", value: "0.0" },
        { name: "height", type: "float", value: "115" },
    ];
    private readonly backRect: Rectangle;
    private readonly backPoster: Poster;
    private readonly optionsIcon: Poster;
    private readonly optionsText: Label;
    private readonly logo: Poster;
    private readonly leftDivider: Poster;
    private readonly rightDivider: Poster;
    private readonly title: Label;
    private readonly clockText: Label;
    private readonly optionsOn: string = "common:/images/icon_options.png";
    private readonly optionsOff: string = "common:/images/icon_options_off.png";
    private readonly width: number;
    private height: number;
    private realign: boolean;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Overhang") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        const defaultLogo: string = `common:/images/${this.resolution}/logo_roku.png`;
        const divider: string = `common:/images/${this.resolution}/divider_vertical.png`;

        if (this.resolution === "FHD") {
            this.width = 1920;
            this.height = 172;
            this.setFieldValue("width", new Float(this.width));
            this.setFieldValue("height", new Float(this.height));
            this.backRect = this.addRectangle("color", [0, 0], this.width, this.height);
            this.backPoster = this.addPoster("", [0, 0], this.width, this.height);
            this.logo = this.addPoster(defaultLogo, [102, 63]);
            this.leftDivider = this.addPoster(divider, [261, 59], 12, 51);
            this.title = this.addLabel("titleColor", [297, 58], 0, 50, 45, "bottom");
            this.optionsIcon = this.addPoster(this.optionsOff, [1421, 67], 30, 30);
            this.optionsText = this.addLabel("optionsColor", [1460, 64], 0, 40, 33, "center", "right");
            this.rightDivider = this.addPoster(divider, [1646, 59], 12, 51);
            this.clockText = this.addLabel("clockColor", [1682, 64], 0, 40, 33, "center");
        } else {
            this.width = 1280;
            this.height = 115;
            this.setFieldValue("width", new Float(this.width));
            this.setFieldValue("height", new Float(this.height));
            this.backRect = this.addRectangle("color", [0, 0], this.width, this.height);
            this.backPoster = this.addPoster("", [0, 0], this.width, this.height);
            this.logo = this.addPoster(defaultLogo, [68, 42]);
            this.leftDivider = this.addPoster(divider, [174, 39], 8, 34);
            this.title = this.addLabel("titleColor", [196, 39], 0, 35, 30, "bottom");
            this.optionsIcon = this.addPoster(this.optionsOff, [959, 46], 20, 20);
            this.optionsText = this.addLabel("optionsColor", [985, 44], 0, 27, 22, "center", "right");
            this.rightDivider = this.addPoster(divider, [1109, 39], 8, 34);
            this.clockText = this.addLabel("clockColor", [1133, 44], 0, 27, 22, "center");
        }
        this.optionsText.set(new BrsString("text"), new BrsString(BrsDevice.getTerm("for Options")));
        this.clockText.set(new BrsString("text"), new BrsString(BrsDevice.getTime()));
        const clock = new Timer();
        clock.setCallback(() => {
            this.clockText.set(new BrsString("text"), new BrsString(BrsDevice.getTime()));
        });
        clock.set(new BrsString("repeat"), BrsBoolean.True);
        clock.set(new BrsString("control"), new BrsString("start"));
        this.appendChildToParent(clock);
        this.realign = false;
    }

    private updateChildren() {
        this.copyField(this.backRect, "color");
        this.copyField(this.backRect, "height");
        this.copyField(this.backPoster, "height");
        const backUri = this.getFieldValueJS("backgroundUri") as string;
        if (backUri) {
            this.backPoster.set(new BrsString("uri"), new BrsString(backUri));
        }
        const logoUri = this.getFieldValueJS("logoUri") as string;
        if (logoUri) {
            this.logo.set(new BrsString("uri"), new BrsString(logoUri));
        }
        const title = this.getFieldValueJS("title") as string;
        if (title) {
            this.title.set(new BrsString("text"), new BrsString(title));
            this.copyField(this.title, "color", "titleColor");
            this.leftDivider.set(new BrsString("visible"), BrsBoolean.True);
        } else {
            this.leftDivider.set(new BrsString("visible"), BrsBoolean.False);
        }
        const showOptions = this.getFieldValueJS("showOptions") as boolean;
        const optionsAvailable = this.getFieldValueJS("optionsAvailable") as boolean;
        // Roku changed the behavior of `optionsAvailable` to hide the options icon and text if false
        const optionsVisible = showOptions && optionsAvailable;
        this.optionsIcon.set(new BrsString("visible"), BrsBoolean.from(optionsVisible));
        this.optionsText.set(new BrsString("visible"), BrsBoolean.from(optionsVisible));
        const showClock = this.getFieldValueJS("showClock") as boolean;
        this.clockText.set(new BrsString("visible"), BrsBoolean.from(showClock));
        if (optionsAvailable) {
            this.optionsIcon.set(new BrsString("uri"), new BrsString(this.optionsOn));
            this.copyField(this.optionsIcon, "blendColor", "optionsIconColor");
            this.copyField(this.optionsText, "color", "optionsColor");
        } else {
            this.optionsIcon.set(new BrsString("uri"), new BrsString(this.optionsOff));
            this.copyField(this.optionsText, "color", "optionsDimColor");
        }
        if (showClock && optionsVisible) {
            this.rightDivider.set(new BrsString("visible"), BrsBoolean.True);
        } else {
            this.rightDivider.set(new BrsString("visible"), BrsBoolean.False);
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
        const fieldName = index instanceof BrsString ? index.value : "";
        if (fieldName === "height" && isBrsNumber(value)) {
            this.height = jsValueOf(value) as number;
        }
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
