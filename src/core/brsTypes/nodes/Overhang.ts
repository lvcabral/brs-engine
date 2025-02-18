import { Field, FieldKind, FieldModel } from "./Field";
import {
    AAMember,
    BrsString,
    Float,
    getBrsValueFromFieldType,
    Label,
    Poster,
    Font,
    Timer,
    BrsBoolean,
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
    private readonly defaultLogo: string = "pkg:/images/logo_roku_HD.webp";
    private readonly optionsOn: string = "pkg:/images/icon_options.webp";
    private readonly optionsOff: string = "pkg:/images/icon_options_off.webp";
    private readonly dividerVertical: string = "pkg:/images/divider_vertical.webp";

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Poster") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.background = this.addPoster("", "[0,0]", 115, 1280);
        this.optionsIcon = this.addPoster(this.optionsOff, "[959,46]", 20, 20);
        this.optionsText = this.addLabel("optionsColor", "[985,44]", 27, 22, "center", "right");
        this.optionsText.set(new BrsString("text"), new BrsString("for Options"));
        this.logo = this.addPoster(this.defaultLogo, "[68,42]");
        this.leftDivider = this.addPoster(this.dividerVertical, "[174,31]");
        this.rightDivider = this.addPoster(this.dividerVertical, "[1109,33]");
        this.title = this.addLabel("titleColor", "[196,39]", 35, 30, "bottom");
        this.clockText = this.addLabel("clockColor", "[1133,44]", 27, 22, "center");
        this.clockText.set(new BrsString("text"), new BrsString(this.getTime()));
        const clock = new Timer();
        clock.setCallback(() => {
            this.clockText.set(new BrsString("text"), new BrsString(this.getTime()));
        });
        clock.set(new BrsString("repeat"), BrsBoolean.True);
        clock.set(new BrsString("control"), new BrsString("start"));
        this.children.push(clock);
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

    private addPoster(defaultUri: string, translation: string, height?: number, width?: number) {
        const poster = new Poster();
        if (defaultUri) {
            poster.set(new BrsString("uri"), new BrsString(defaultUri));
        }
        poster.set(new BrsString("translation"), getBrsValueFromFieldType("array", translation));
        if (height) {
            poster.set(new BrsString("height"), new Float(height));
        }
        if (width) {
            poster.set(new BrsString("width"), new Float(width));
        }
        this.children.push(poster);
        return poster;
    }

    private addLabel(
        colorField: string,
        translation: string,
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
        label.set(new BrsString("translation"), getBrsValueFromFieldType("array", translation));
        if (vertAlign) {
            label.set(new BrsString("vertalign"), new BrsString(vertAlign));
        }
        if (horizAlign) {
            label.set(new BrsString("horizalign"), new BrsString(horizAlign));
        }
        this.children.push(label);
        return label;
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        // Update children uri and text
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
        }
        const showOptions = this.getFieldValue("showOptions") as BrsBoolean;
        if (showOptions?.toBoolean()) {
            this.optionsIcon.set(new BrsString("visible"), BrsBoolean.True);
            this.optionsText.set(new BrsString("visible"), BrsBoolean.True);
            this.rightDivider.set(new BrsString("visible"), BrsBoolean.True);
        } else {
            this.optionsIcon.set(new BrsString("visible"), BrsBoolean.False);
            this.optionsText.set(new BrsString("visible"), BrsBoolean.False);
            this.rightDivider.set(new BrsString("visible"), BrsBoolean.False);
        }
        const optionsAvailable = this.getFieldValue("optionsAvailable") as BrsBoolean;
        if (optionsAvailable?.toBoolean()) {
            this.optionsIcon.set(new BrsString("uri"), new BrsString(this.optionsOn));
            const optionsColor = this.getNodeFields().get("optionscolor");
            if (optionsColor) {
                this.optionsText.getNodeFields().set("color", optionsColor);
            }
        } else {
            this.optionsIcon.set(new BrsString("uri"), new BrsString(this.optionsOff));
            const optionsColor = this.getNodeFields().get("optionsdimcolor");
            if (optionsColor) {
                this.optionsText.getNodeFields().set("color", optionsColor);
            }
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
        // TODO: Handle other fields and reposition children
        const size = this.getDimensions();
        const rect = { x: origin[0], y: origin[1], width: size.width, height: size.height };
        this.updateBoundingRects(rect, origin, angle);
        this.renderChildren(interpreter, origin, angle, draw2D);
        this.updateParentRects(origin, angle);
    }
}
