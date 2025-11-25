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
    sgRoot,
} from "..";
import { Group } from "./Group";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { BrsDevice } from "../../device/BrsDevice";

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
        this.backRect.setFieldValue("visible", BrsBoolean.False);
        this.optionsText.setValue("text", new BrsString(BrsDevice.getTerm("for Options")));
        this.clockText.setValue("text", new BrsString(BrsDevice.getTime()));
        const clock = new Timer();
        clock.setCallback(() => {
            this.clockText.setValue("text", new BrsString(BrsDevice.getTime()));
        });
        clock.setFieldValue("repeat", BrsBoolean.True);
        clock.setValue("control", new BrsString("start"));
        this.appendChildToParent(clock);
        this.realign = false;
    }

    private updateChildren() {
        this.copyField(this.backPoster, "height");
        const backUri = this.getFieldValueJS("backgroundUri") as string;
        if (backUri) {
            this.backPoster.setValue("uri", new BrsString(backUri));
        }
        const color = this.getFieldValueJS("color") as number;
        const logoUri = this.getFieldValueJS("logoUri") as string;
        if (logoUri) {
            this.setLogoUri(logoUri);
        } else if (color) {
            this.copyField(this.backRect, "color");
            this.backRect.setFieldValue("visible", BrsBoolean.True);
        } else {
            this.backRect.setFieldValue("visible", BrsBoolean.False);
        }
        this.copyField(this.backRect, "height");
        const title = this.getFieldValueJS("title") as string;
        if (title) {
            this.title.setValue("text", new BrsString(title));
            this.copyField(this.title, "color", "titleColor");
            this.leftDivider.setValue("visible", BrsBoolean.True);
        } else {
            this.leftDivider.setValue("visible", BrsBoolean.False);
        }
        const showOptions = this.getFieldValueJS("showOptions") as boolean;
        const optionsAvailable = this.getFieldValueJS("optionsAvailable") as boolean;
        // Roku changed the behavior of `optionsAvailable` to hide the options icon and text if false
        const optionsVisible = showOptions && optionsAvailable;
        this.optionsIcon.setValue("visible", BrsBoolean.from(optionsVisible));
        this.optionsText.setValue("visible", BrsBoolean.from(optionsVisible));
        const showClock = this.getFieldValueJS("showClock") as boolean;
        this.clockText.setValue("visible", BrsBoolean.from(showClock));
        if (optionsAvailable) {
            this.optionsIcon.setValue("uri", new BrsString(this.optionsOn));
            this.copyField(this.optionsIcon, "blendColor", "optionsIconColor");
            this.copyField(this.optionsText, "color", "optionsColor");
        } else {
            this.optionsIcon.setValue("uri", new BrsString(this.optionsOff));
            this.copyField(this.optionsText, "color", "optionsDimColor");
        }
        if (showClock && optionsVisible) {
            this.rightDivider.setValue("visible", BrsBoolean.True);
        } else {
            this.rightDivider.setValue("visible", BrsBoolean.False);
        }
        const optionsText = this.getFieldValueJS("optionsText") as string;
        if (optionsText) {
            this.optionsText.setValue("text", new BrsString(optionsText));
        }
        const leftDividerUri = this.getFieldValueJS("leftDividerUri") as string;
        if (leftDividerUri) {
            this.leftDivider.setValue("uri", new BrsString(leftDividerUri));
        }
        const rightDividerUri = this.getFieldValueJS("rightDividerUri") as string;
        if (rightDividerUri) {
            this.rightDivider.setValue("uri", new BrsString(rightDividerUri));
        }
        this.isDirty = false;
    }

    private setLogoUri(uri: string) {
        this.logo.setValue("uri", new BrsString(uri));
        const loadStatus = this.logo.getFieldValueJS("loadStatus") ?? "";
        const subSearch = sgRoot.scene?.subSearch ?? "";
        const uriHasRes = subSearch !== "" && uri.includes(subSearch);
        if (loadStatus === "ready" && this.resolution !== BrsDevice.getDisplayMode() && !uriHasRes) {
            const bitmapHeight = this.logo.getFieldValueJS("bitmapHeight") as number;
            const bitmapWidth = this.logo.getFieldValueJS("bitmapWidth") as number;
            // Roku scales the logo based on the current display mode
            if (this.resolution === "FHD") {
                this.logo.setValue("height", new Float(bitmapHeight * 1.5));
                this.logo.setValue("width", new Float(bitmapWidth * 1.5));
            } else {
                this.logo.setValue("height", new Float(bitmapHeight / 1.5));
                this.logo.setValue("width", new Float(bitmapWidth / 1.5));
            }
        }
    }

    private alignChildren() {
        const isFHD = this.resolution === "FHD";
        const isDeviceFHD = BrsDevice.getDisplayMode() === "FHD";
        const leftAlignX = isFHD ? 102 : 68;
        const topAlignY = isFHD ? 60 : 40;
        const logoWidth = this.logo.rectLocal.width;
        const optionsWidth = this.optionsText.rectLocal.width ?? (isFHD ? 168 : 112);
        const showClock = this.getFieldValueJS("showClock") as boolean;
        const clockTextWidth = showClock ? this.clockText.rectLocal.width : 0;
        const clockOffset = isFHD ? 60 : 40;
        const optionsOffset = showClock ? optionsWidth + clockOffset : optionsWidth;
        const rightAlignX = this.width - leftAlignX - clockTextWidth;
        if (isFHD) {
            this.logo.setTranslation([leftAlignX, topAlignY + 3]);
            this.leftDivider.setTranslation([leftAlignX + logoWidth + 24, topAlignY]);
            this.title.setTranslation([leftAlignX + logoWidth + 56, topAlignY]);
            this.optionsIcon.setTranslation([rightAlignX - optionsOffset - 36, topAlignY + 9]);
            this.optionsText.setTranslation([rightAlignX - optionsOffset, topAlignY + 3]);
            this.rightDivider.setTranslation([rightAlignX - 36, topAlignY]);
            this.clockText.setTranslation([rightAlignX, topAlignY + 3]);
        } else {
            this.logo.setTranslation([leftAlignX, topAlignY]);
            this.leftDivider.setTranslation([leftAlignX + logoWidth + 16, topAlignY]);
            this.title.setTranslation([leftAlignX + logoWidth + 38, topAlignY - 2]);
            this.optionsIcon.setTranslation([rightAlignX - optionsOffset - 24, topAlignY + 6]);
            this.optionsText.setTranslation([rightAlignX - optionsOffset, topAlignY + 2]);
            this.rightDivider.setTranslation([rightAlignX - 24, topAlignY]);
            this.clockText.setTranslation([rightAlignX, topAlignY + 2]);
        }
        if (isDeviceFHD !== isFHD) {
            this.logo.setTranslation([leftAlignX, topAlignY]);
        }
        this.realign = false;
    }

    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        this.realign = true;
        const fieldName = index.toLowerCase();
        if (fieldName === "height" && isBrsNumber(value)) {
            this.height = jsValueOf(value) as number;
        }
        super.setValue(index, value, alwaysNotify, kind);
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
