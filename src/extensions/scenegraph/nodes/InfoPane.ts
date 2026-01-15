import {
    AAMember,
    BrsBoolean,
    BrsString,
    BrsType,
    Float,
    IfDraw2D,
    Interpreter,
    RoArray,
    RoFont,
    isBrsString,
} from "brs-engine";
import { Group } from "./Group";
import type { Label } from "./Label";
import type { Poster } from "./Poster";
import type { Font } from "./Font";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { jsValueOf } from "../factory/Serializer";

export class InfoPane extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "infoText", type: "string", value: "" },
        { name: "infoText2", type: "string", value: "" },
        { name: "infoText2Color", type: "color", value: "0xFFFFFFFF" },
        { name: "infoText2BottomAlign", type: "boolean", value: "false" },
        { name: "textColor", type: "color", value: "0xFFFFFFFF" },
        { name: "bulletText", type: "array" },
        { name: "width", type: "float", value: "0.0" },
        { name: "height", type: "float", value: "0.0" },
    ];

    private readonly background: Poster;
    private readonly infoLabel: Label;
    private readonly bulletLabel: Label;
    private readonly secondaryLabel: Label;
    private readonly paddingX: number;
    private readonly paddingY: number;
    private readonly gap: number;
    private readonly defaultWidth: number;
    private readonly minHeight: number;
    private readonly fontSize: number;
    private readonly lineSpacing: number;
    private readonly bulletLineSpacing: number;
    private readonly backgroundUri: string;
    private readonly layoutFields = new Set([
        "infotext",
        "infotext2",
        "infotext2color",
        "infotext2bottomalign",
        "textcolor",
        "bullettext",
        "width",
        "height",
    ]);

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.InfoPane) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
        this.setValueSilent("focusable", BrsBoolean.False);

        if (this.resolution === "FHD") {
            this.paddingX = 33;
            this.paddingY = 27;
            this.gap = 24;
            this.defaultWidth = 780;
            this.minHeight = 300;
            this.fontSize = 33;
            this.lineSpacing = 14;
            this.bulletLineSpacing = 12;
        } else {
            this.paddingX = 22;
            this.paddingY = 18;
            this.gap = 16;
            this.defaultWidth = 520;
            this.minHeight = 200;
            this.fontSize = 22;
            this.lineSpacing = 10;
            this.bulletLineSpacing = 8;
        }
        this.backgroundUri = `common:/images/${this.resolution}/info_pane.9.png`;

        this.background = this.addPoster(this.backgroundUri, [0, 0], this.defaultWidth, this.minHeight);
        this.infoLabel = this.createContentLabel("textColor", this.fontSize, true, this.lineSpacing);
        this.bulletLabel = this.createContentLabel("textColor", this.fontSize, true, this.bulletLineSpacing);
        this.secondaryLabel = this.createContentLabel("infoText2Color", this.fontSize, true, this.lineSpacing);
    }

    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (this.layoutFields.has(fieldName)) {
            this.isDirty = true;
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (this.isDirty) {
            this.updateLayout();
        }
        super.renderNode(interpreter, origin, angle, opacity, draw2D);
    }

    private updateLayout() {
        const width = this.resolveWidth();
        const contentWidth = Math.max(0, width - this.paddingX * 2);
        const specifiedHeight = this.getNumericField("height");
        const infoText = this.getTextField("infoText");
        const infoText2 = this.getTextField("infoText2");
        const bulletLines = this.getBulletLines();
        const hasInfo = infoText.length > 0;
        const hasBullets = bulletLines.length > 0;
        const hasInfo2 = infoText2.length > 0;
        const bottomAlignSecondary = this.getBooleanField("infoText2BottomAlign");
        const formattedBullets = hasBullets ? this.formatBulletText(bulletLines) : "";

        this.background.setValue("uri", new BrsString(this.backgroundUri));
        this.background.setValue("width", new Float(width));

        this.updateLabelWidth(this.infoLabel, contentWidth);
        this.updateLabelWidth(this.bulletLabel, contentWidth);
        this.updateLabelWidth(this.secondaryLabel, contentWidth);

        this.copyField(this.infoLabel, "color", "textColor");
        this.copyField(this.bulletLabel, "color", "textColor");
        this.copyField(this.secondaryLabel, "color", "infoText2Color");

        this.infoLabel.setValue("text", new BrsString(infoText));
        this.bulletLabel.setValue("text", new BrsString(formattedBullets));
        this.secondaryLabel.setValue("text", new BrsString(infoText2));

        this.infoLabel.setValue("visible", BrsBoolean.from(hasInfo));
        this.bulletLabel.setValue("visible", BrsBoolean.from(hasBullets));
        this.secondaryLabel.setValue("visible", BrsBoolean.from(hasInfo2));

        const infoMeasured = hasInfo ? this.infoLabel.getMeasured() : undefined;
        const bulletMeasured = hasBullets ? this.bulletLabel.getMeasured() : undefined;
        const secondaryMeasured = hasInfo2 ? this.secondaryLabel.getMeasured() : undefined;
        const infoHeight =
            hasInfo && infoMeasured
                ? this.getBlockHeight(this.infoLabel, infoText, infoMeasured.height, contentWidth)
                : 0;
        const bulletHeight =
            hasBullets && bulletMeasured
                ? this.getBlockHeight(this.bulletLabel, formattedBullets, bulletMeasured.height, contentWidth)
                : 0;
        const secondaryHeight =
            hasInfo2 && secondaryMeasured
                ? this.getBlockHeight(this.secondaryLabel, infoText2, secondaryMeasured.height, contentWidth)
                : 0;

        let cursorY = this.paddingY;
        let hasTopContent = false;

        if (hasInfo && infoHeight > 0) {
            this.infoLabel.setTranslation([this.paddingX, cursorY]);
            cursorY += infoHeight;
            hasTopContent = true;
        }

        if (hasBullets && bulletHeight > 0) {
            if (hasTopContent) {
                cursorY += this.gap;
            }
            this.bulletLabel.setTranslation([this.paddingX, cursorY]);
            cursorY += bulletHeight;
            hasTopContent = true;
        }

        const topContentHeight = hasTopContent ? cursorY - this.paddingY : 0;
        let stackedContentHeight = cursorY;

        if (hasInfo2 && !bottomAlignSecondary && secondaryHeight > 0) {
            if (hasTopContent) {
                cursorY += this.gap;
            }
            this.secondaryLabel.setTranslation([this.paddingX, cursorY]);
            cursorY += secondaryHeight;
            stackedContentHeight = cursorY;
        }

        let requiredHeight = stackedContentHeight + this.paddingY;
        let minBottomAlignedHeight = 0;
        if (hasInfo2 && bottomAlignSecondary && secondaryHeight > 0) {
            const gapBeforeSecondary = hasTopContent ? this.gap : 0;
            minBottomAlignedHeight =
                this.paddingY + topContentHeight + gapBeforeSecondary + secondaryHeight + this.paddingY;
            requiredHeight = Math.max(requiredHeight, minBottomAlignedHeight);
        }

        requiredHeight = Math.max(requiredHeight, this.minHeight);
        let paneHeight = Math.max(requiredHeight, specifiedHeight > 0 ? specifiedHeight : 0);

        if (hasInfo2 && bottomAlignSecondary && secondaryHeight > 0) {
            const gapBeforeSecondary = hasTopContent ? this.gap : 0;
            const minY = this.paddingY + topContentHeight + gapBeforeSecondary;
            let info2Y = paneHeight - this.paddingY - secondaryHeight;
            if (info2Y < minY) {
                paneHeight = Math.max(paneHeight, minBottomAlignedHeight);
                info2Y = Math.max(minY, paneHeight - this.paddingY - secondaryHeight);
            }
            this.secondaryLabel.setTranslation([this.paddingX, info2Y]);
        }

        this.background.setValue("height", new Float(paneHeight));
        this.setValueSilent("height", new Float(paneHeight));
        this.isDirty = false;
    }

    private resolveWidth(): number {
        const widthField = this.getNumericField("width");
        if (widthField > 0) {
            return widthField;
        }
        return this.defaultWidth;
    }

    private getNumericField(fieldName: string): number {
        const raw = this.getValueJS(fieldName);
        return typeof raw === "number" ? raw : 0;
    }

    private getBooleanField(fieldName: string): boolean {
        const raw = this.getValueJS(fieldName);
        return typeof raw === "boolean" ? raw : false;
    }

    private getTextField(fieldName: string): string {
        const raw = this.getValue(fieldName);
        if (isBrsString(raw)) {
            return raw.getValue().trim();
        }
        const jsValue = jsValueOf(raw);
        return typeof jsValue === "string" ? jsValue.trim() : "";
    }

    private getBulletLines(): string[] {
        const value = this.getValue("bulletText");
        if (!(value instanceof RoArray)) {
            return [];
        }
        const lines: string[] = [];
        for (const element of value.getElements()) {
            const entry = jsValueOf(element);
            if (typeof entry === "string") {
                const normalized = entry.trim();
                if (normalized.length > 0) {
                    lines.push(normalized);
                }
            }
        }
        return lines;
    }

    private formatBulletText(lines: string[]): string {
        return lines.map((line) => `• ${line}`).join("\n");
    }

    private updateLabelWidth(label: Label, width: number) {
        label.setValue("width", new Float(width));
    }

    private createContentLabel(colorField: string, fontSize: number, wrap: boolean, lineSpacing: number): Label {
        const width = Math.max(0, this.defaultWidth - this.paddingX * 2);
        const label = this.addLabel(colorField, [this.paddingX, this.paddingY], width, 0, fontSize, "top", "left", wrap);
        label.setValueSilent("wrap", BrsBoolean.from(wrap));
        label.setValueSilent("lineSpacing", new Float(lineSpacing));
        label.setValueSilent("visible", BrsBoolean.False);
        return label;
    }

    private getBlockHeight(label: Label, text: string, measuredHeight: number, width: number): number {
        if (!text.length) {
            return 0;
        }
        const wrap = (label.getValueJS("wrap") as boolean) ?? false;
        if (!wrap || width <= 0) {
            return measuredHeight;
        }
        const fontNode = label.getValue("font");
        if (!fontNode || typeof (fontNode as Font).createDrawFont !== "function") {
            return measuredHeight;
        }
        const drawFont = (fontNode as Font).createDrawFont();
        if (!(drawFont instanceof RoFont)) {
            return measuredHeight;
        }
        const lines = this.breakTextIntoLines(text, drawFont, width);
        if (!lines.length) {
            return measuredHeight;
        }
        const lineHeight = drawFont.measureTextHeight();
        const spacing = (label.getValueJS("lineSpacing") as number) ?? 0;
        return lineHeight * lines.length + spacing * (lines.length - 1);
    }
}
