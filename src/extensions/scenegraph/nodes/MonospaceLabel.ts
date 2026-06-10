import { AAMember, BrsType, IfDraw2D, MeasuredText, Rect, RoFont } from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Label } from "./Label";
import type { Font } from "./Font";
import { rotateTranslation } from "../SGUtil";

/**
 * MonospaceLabel draws a single line of text with every character spaced at a fixed
 * distance, transforming a proportional font into a monospaced one. Each glyph is drawn
 * centered within its fixed-width character cell (see `firstCharTrueLeftAlign` for the
 * first-character exception). Available since Roku OS 14.0.
 */
export class MonospaceLabel extends Label {
    readonly defaultFields: FieldModel[] = [
        { name: "characterWidth", type: "float", value: "0" },
        { name: "firstCharTrueLeftAlign", type: "boolean", value: "false" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.MonospaceLabel) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Label);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        super.setValue(index, value, alwaysNotify, kind);
        const fieldName = index.toLowerCase();
        if (fieldName === "characterwidth" || fieldName === "firstchartruealign") {
            // Cell layout changed: drop the cached measurement and re-measure.
            this.measured = undefined;
            this.getMeasured();
        }
    }

    protected renderLabel(rect: Rect, rotation: number, opacity: number, draw2D?: IfDraw2D): MeasuredText {
        const font = this.getValue("font") as Font;
        const drawFont = font.createDrawFont();
        const fullText = (this.getValueJS("text") as string) ?? "";
        if (!(drawFont instanceof RoFont)) {
            return { text: fullText, width: 0, height: 0, ellipsized: false };
        }

        const color = this.getValueJS("color") as number;
        const horizAlign = (this.getValueJS("horizAlign") as string) || "left";
        const vertAlign = (this.getValueJS("vertAlign") as string) || "top";
        const ellipsis = (this.getValueJS("ellipsisText") as string) || "...";
        const characterWidth = (this.getValueJS("characterWidth") as number) ?? 0;
        const firstCharTrueLeftAlign = (this.getValueJS("firstCharTrueLeftAlign") as boolean) ?? false;
        const ellipsizeOnBoundary = (this.getValueJS("ellipsizeOnBoundary") as boolean) ?? false;
        const wordBreakChars = (this.getValueJS("wordBreakChars") as string) || "";

        // MonospaceLabel renders a single line only.
        const newlineIndex = fullText.indexOf("\n");
        let text = newlineIndex === -1 ? fullText : fullText.substring(0, newlineIndex);

        // If characterWidth is zero, use the natural width of the font's 'M' character.
        const cellWidth = characterWidth > 0 ? characterWidth : drawFont.measureTextWidth("M").width;

        let ellipsized = false;
        if (rect.width > 0 && cellWidth > 0 && text.length * cellWidth > rect.width) {
            const maxCells = Math.floor(rect.width / cellWidth);
            const keep = Math.max(0, maxCells - ellipsis.length);
            let kept = text.substring(0, keep);
            if (ellipsizeOnBoundary) {
                kept = this.trimToBoundary(kept, wordBreakChars);
            }
            text = kept + ellipsis;
            ellipsized = true;
        }

        const lineHeight = drawFont.measureTextHeight();
        const totalWidth = text.length * cellWidth;

        // Align the whole run within the label box (same rules as Group.drawText).
        let startX = 0;
        if (rect.width > totalWidth) {
            if (horizAlign === "center") {
                startX = (rect.width - totalWidth) / 2;
            } else if (horizAlign === "right") {
                startX = rect.width - totalWidth;
            }
        }
        let startY = 0;
        if (rect.height > lineHeight) {
            if (vertAlign === "center") {
                startY = (rect.height - lineHeight) / 2;
            } else if (vertAlign === "bottom") {
                startY = rect.height - lineHeight;
            }
        }

        if (draw2D) {
            const chars = [...text];
            for (let i = 0; i < chars.length; i++) {
                const char = chars[i];
                const centerOffset =
                    i === 0 && firstCharTrueLeftAlign ? 0 : (cellWidth - drawFont.measureTextWidth(char).width) / 2;
                const local = [startX + i * cellWidth + centerOffset, startY];
                const screen = rotation === 0 ? local : rotateTranslation(local, rotation);
                draw2D.doDrawRotatedText(
                    char,
                    rect.x + screen[0],
                    rect.y + screen[1],
                    color,
                    opacity,
                    drawFont,
                    rotation
                );
            }
        }

        this.setEllipsized(ellipsized);
        return { text, width: totalWidth, height: lineHeight, ellipsized };
    }

    /** Trims trailing partial word back to the last word-break character (space, hyphen, or any in wordBreakChars). */
    private trimToBoundary(text: string, wordBreakChars: string): string {
        const breakSet = new Set([" ", "-", ...wordBreakChars]);
        for (let i = text.length - 1; i >= 0; i--) {
            if (breakSet.has(text[i])) {
                return text.substring(0, i);
            }
        }
        return text;
    }
}
