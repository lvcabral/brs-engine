import { AAMember, Interpreter, BrsString, BrsType, IfDraw2D, MeasuredText, Rect, RoFont } from "brs-engine";
import { Group } from "./Group";
import type { Font } from "./Font";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { SGNodeFactory } from "../factory/NodeFactory";
import { rotateTranslation } from "../SGUtil";

/**
 * SimpleLabel is a lightweight node for displaying a single line of text.
 * Unlike Label, it references its font through the `fontUri`/`fontSize` string
 * fields (rather than a Font node) and positions the text relative to its
 * translation using the `horizOrigin`/`vertOrigin` anchor fields.
 */
export class SimpleLabel extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "text", type: "string", value: "" },
        { name: "color", type: "color", value: "0xddddddff" },
        { name: "fontUri", type: "string", value: "" },
        { name: "fontSize", type: "integer", value: "0" },
        { name: "horizOrigin", type: "string", value: "left" },
        { name: "vertOrigin", type: "string", value: "top" },
    ];
    protected measured?: MeasuredText;
    private font?: Font;
    private appliedFont?: string;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.SimpleLabel) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
        this.refreshFont();
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        super.setValue(index, value, alwaysNotify, kind);
        if (fieldName === "text" || fieldName === "fonturi" || fieldName === "fontsize") {
            this.refreshFont();
            this.measured = undefined;
            this.getMeasured(); // force re-measure
        }
    }

    /** Builds/updates the internal Font node from the `fontUri`/`fontSize` fields. */
    private refreshFont() {
        const uri = (this.getValueJS("fontUri") as string) ?? "";
        const size = (this.getValueJS("fontSize") as number) ?? 0;
        const signature = `${uri}|${size}`;
        if (this.font && this.appliedFont === signature) {
            return;
        }
        this.font ||= SGNodeFactory.createNode(SGNodeType.Font) as Font;
        if (uri.startsWith("font:")) {
            // System fonts are fixed size; the fontSize field is ignored.
            this.font.setSystemFont(uri.slice(5));
        } else if (uri !== "") {
            this.font.setValue("uri", new BrsString(uri));
            if (size > 0) {
                this.font.setSize(size);
            }
        } else if (size > 0) {
            // No fontUri: keep the system default family but honor the size.
            this.font.setSize(size);
        }
        this.appliedFont = signature;
    }

    getMeasured() {
        if (this.measured === undefined) {
            const rect: Rect = { x: 0, y: 0, width: 0, height: 0 };
            this.measured = this.renderLabel(rect, 0, 1);
            this.rectLocal = { x: 0, y: 0, width: this.measured.width, height: this.measured.height };
        }
        return this.measured;
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            this.updateRenderTracking(true);
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = angle === 0 ? nodeTrans.slice() : rotateTranslation(nodeTrans, angle);
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const rect = { x: drawTrans[0], y: drawTrans[1], width: 0, height: 0 };
        const rotation = angle + this.getRotation();
        opacity = opacity * this.getOpacity();
        // renderLabel offsets rect.x/rect.y to the drawn top-left so bounding rects are accurate.
        this.measured = this.renderLabel(rect, rotation, opacity, draw2D);
        rect.width = this.measured.width;
        rect.height = this.measured.height;
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.nodeRenderingDone(origin, angle, opacity, draw2D);
    }

    /**
     * Measures and draws the single line of text, anchoring it to `rect`'s
     * position according to `horizOrigin`/`vertOrigin`. On return, `rect.x`/`rect.y`
     * are moved to the actual top-left of the drawn text.
     */
    protected renderLabel(rect: Rect, rotation: number, opacity: number, draw2D?: IfDraw2D): MeasuredText {
        const color = this.getValueJS("color") as number;
        const fullText = (this.getValueJS("text") as string) ?? "";
        const horizOrigin = (this.getValueJS("horizOrigin") as string) || "left";
        const vertOrigin = (this.getValueJS("vertOrigin") as string) || "top";

        const drawFont = this.font?.createDrawFont();
        if (!(drawFont instanceof RoFont)) {
            return { text: fullText, width: 0, height: 0, ellipsized: false };
        }
        // SimpleLabel is single line only: stop at the first newline.
        const newlineIndex = fullText.indexOf("\n");
        const text = newlineIndex === -1 ? fullText : fullText.substring(0, newlineIndex);
        const measured = drawFont.measureText(text);

        if (horizOrigin === "center") {
            rect.x -= measured.width / 2;
        } else if (horizOrigin === "right") {
            rect.x -= measured.width;
        }
        if (vertOrigin === "center") {
            rect.y -= measured.height / 2;
        } else if (vertOrigin === "bottom") {
            rect.y -= measured.height;
        } else if (vertOrigin === "baseline") {
            const ascent = measured.height - 2 * drawFont.getTopAdjust();
            rect.y -= ascent;
        }
        draw2D?.doDrawRotatedText(text, rect.x, rect.y, color, opacity, drawFont, rotation);
        return measured;
    }
}
