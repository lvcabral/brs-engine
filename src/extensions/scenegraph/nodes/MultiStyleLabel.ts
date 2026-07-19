import {
    AAMember,
    Interpreter,
    BrsBoolean,
    BrsString,
    BrsType,
    IfDraw2D,
    MeasuredText,
    Rect,
    RoFont,
} from "brs-engine";
import { Group } from "./Group";
import type { Font } from "./Font";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { SGNodeFactory } from "../factory/NodeFactory";
import { convertHexColor, rotateTranslation } from "../SGUtil";

/** A resolved drawing style: a configured Font node plus its text color. */
interface DrawStyle {
    font: Font;
    color: number;
}

/** A measured, style-resolved piece of text to be drawn on a single line. */
interface Token {
    text: string;
    font: RoFont;
    color: number;
    width: number;
    height: number;
    /** True for a `\n` break marker (zero-width, forces a new line). */
    newline: boolean;
}

/** A laid-out line: an ordered list of tokens with its overall width/height. */
interface Line {
    tokens: Token[];
    width: number;
    height: number;
    ellipsized: boolean;
}

/**
 * Reads a property case-insensitively. BrightScript associative-array literals keep their
 * keys in the original case (the `RoAssociativeArray` constructor stores them case-sensitively),
 * so a `drawingStyles` entry exposes `fontUri`/`fontSize` — not the lowercased forms.
 */
function ciGet(obj: Record<string, unknown>, key: string): unknown {
    if (key in obj) {
        return obj[key];
    }
    const lower = key.toLowerCase();
    for (const k of Object.keys(obj)) {
        if (k.toLowerCase() === lower) {
            return obj[k];
        }
    }
    return undefined;
}

/**
 * MultiStyleLabel renders a single string of text using mixed styles (different
 * fonts, sizes, and colors) within one label. Styles are defined in the
 * `drawingStyles` field (an associative array of `{ fontSize, fontUri, color }`
 * associative arrays) and the `text` field uses simple markup tags
 * (`<styleName>...</styleName>`) to select which style draws each span. Text
 * outside any tag uses the `"default"` style if defined, otherwise the system
 * default font and the node's `color` field.
 *
 * Roku documents MultiStyleLabel as extending LabelBase; this codebase has no
 * standalone LabelBase class, so (like Label) it extends Group and inlines the
 * LabelBase fields.
 */
export class MultiStyleLabel extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "text", type: "string", value: "" },
        { name: "color", type: "color", value: "0xddddddff" },
        { name: "horizAlign", type: "string", value: "left" },
        { name: "vertAlign", type: "string", value: "top" },
        { name: "width", type: "float", value: "0" },
        { name: "height", type: "float", value: "0" },
        { name: "numLines", type: "integer", value: "0" },
        { name: "maxLines", type: "integer", value: "0" },
        { name: "wrap", type: "boolean", value: "false" },
        { name: "displayPartialLines", type: "boolean", value: "false" },
        { name: "ellipsizeOnBoundary", type: "boolean", value: "false" },
        { name: "wordBreakChars", type: "string" },
        { name: "ellipsisText", type: "string" },
        { name: "isTextEllipsized", type: "boolean", value: "false" },
        { name: "monospacedDigits", type: "boolean", value: "false" },
        { name: "drawingStyles", type: "assocarray" },
    ];
    protected measured?: MeasuredText;
    /** Resolved styles keyed by lowercased style name. */
    private styles: Map<string, DrawStyle> = new Map();
    private appliedStyles?: string;
    private defaultStyle?: DrawStyle;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.MultiStyleLabel) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        const resetFields = [
            "text",
            "drawingstyles",
            "color",
            "width",
            "height",
            "numlines",
            "maxlines",
            "wrap",
            "horizalign",
            "vertalign",
            "ellipsizeonboundary",
            "ellipsistext",
            "displaypartiallines",
        ];
        super.setValue(index, value, alwaysNotify, kind);
        if (fieldName === "drawingstyles" || fieldName === "color") {
            this.buildStyles();
        }
        if (resetFields.includes(fieldName)) {
            this.setEllipsized(false);
            this.measured = undefined;
            this.getMeasured(); // force re-measure
        }
    }

    getMeasured() {
        if (this.measured === undefined) {
            const size = this.getDimensions();
            const rect: Rect = { x: 0, y: 0, ...size };
            this.measured = this.renderLabel(rect, 0, 1);
            const width = Math.max(this.measured.width, size.width);
            const height = Math.max(this.measured.height, size.height);
            // Keep all three coordinate-space rects in sync (see Label.getMeasured /
            // SimpleLabel.getMeasured) so an eager boundingRect() query mid-render does
            // not return a stale zero rectToParent/rectToScene.
            const trans = this.getTranslation();
            this.rectLocal = { x: 0, y: 0, width, height };
            this.rectToParent = { x: trans[0], y: trans[1], width, height };
            this.rectToScene = { x: trans[0], y: trans[1], width, height };
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
        const size = this.getDimensions();
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };
        const rotation = angle + this.getRotation();
        opacity = opacity * this.getOpacity();
        this.measured = this.renderLabel(rect, rotation, opacity, draw2D);
        rect.width = Math.max(this.measured.width, size.width);
        rect.height = Math.max(this.measured.height, size.height);
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.nodeRenderingDone(origin, angle, opacity, draw2D);
    }

    /**
     * Lays out and draws the styled text. `rect.width`/`rect.height` carry the
     * `width`/`height` field values (the computed bounding box); the returned
     * MeasuredText carries the rendered block size for bounding-rect tracking.
     */
    protected renderLabel(rect: Rect, rotation: number, opacity: number, draw2D?: IfDraw2D): MeasuredText {
        this.buildStyles();
        const fullText = (this.getValueJS("text") as string) ?? "";
        const horizAlign = (this.getValueJS("horizAlign") as string) || "left";
        const vertAlign = (this.getValueJS("vertAlign") as string) || "top";
        const ellipsis = (this.getValueJS("ellipsisText") as string) || "...";
        const onBoundary = this.getValueJS("ellipsizeOnBoundary") as boolean;
        const wrap = this.getValueJS("wrap") as boolean;
        const numLines = this.getValueJS("numLines") as number;
        const maxLines = this.getValueJS("maxLines") as number;
        const displayPartialLines = this.getValueJS("displayPartialLines") as boolean;

        const empty: MeasuredText = { text: fullText, width: 0, height: 0, ellipsized: false };
        const tokens = this.tokenize(this.parseRuns(fullText));
        if (tokens.length === 0) {
            this.setEllipsized(false);
            return empty;
        }

        // Roku keeps a constant line advance based on the label's leading text and
        // baseline-aligns each span, so larger inline fonts overflow upward rather than
        // pushing the lines apart. Use the first run's font as the baseline reference.
        const baseToken = tokens.find((token) => !token.newline) ?? tokens[0];
        const baseLineHeight = baseToken.height;
        const baseAscent = baseLineHeight - 2 * baseToken.font.getTopAdjust();

        // Build the lines of text.
        let lines: Line[];
        if (wrap) {
            // wrap=true with no width renders nothing (LabelBase wrapping rule).
            if (rect.width <= 0) {
                this.setEllipsized(false);
                return empty;
            }
            lines = this.wrapTokens(tokens, rect.width);
        } else {
            // wrap=false is always a single line (up to the first newline).
            lines = [this.singleLine(tokens, rect.width, ellipsis, onBoundary)];
        }

        // Limit the rendered line count by height / numLines / maxLines.
        let limit = Number.POSITIVE_INFINITY;
        if (rect.height > 0 && baseLineHeight > 0) {
            limit = Math.max(1, Math[displayPartialLines ? "ceil" : "floor"](rect.height / baseLineHeight));
        } else if (numLines > 0) {
            limit = numLines;
        } else if (maxLines > 0) {
            limit = maxLines;
        }
        let rendered = lines;
        if (lines.length > limit) {
            rendered = lines.slice(0, limit);
            const last = rendered.length - 1;
            const fit = rect.width > 0 ? rect.width : rendered[last].width;
            rendered[last] = this.ellipsizeTokenLine(rendered[last], fit, ellipsis, onBoundary);
        }

        // Stack lines by their own ascent/descent and baseline-align each span. A larger
        // inline font raises its line's ascent, pushing the line down to make room for it
        // (matching Roku) while all spans share a common baseline. A line with no taller span
        // keeps the base line height.
        const baseDescent = baseLineHeight - baseAscent;
        const lineMetrics = rendered.map((line) => {
            let ascent = baseAscent;
            let descent = baseDescent;
            for (const token of line.tokens) {
                const topAdjust = token.font.getTopAdjust();
                ascent = Math.max(ascent, token.height - 2 * topAdjust);
                descent = Math.max(descent, 2 * topAdjust);
            }
            return { ascent, descent };
        });
        const blockHeight = lineMetrics.reduce((acc, m) => acc + m.ascent + m.descent, 0);
        let maxWidth = 0;
        let ellipsized = false;
        let y = rect.y;
        if (rect.height > blockHeight) {
            if (vertAlign === "center") {
                y += (rect.height - blockHeight) / 2;
            } else if (vertAlign === "bottom") {
                y += rect.height - blockHeight;
            }
        }
        for (let i = 0; i < rendered.length; i++) {
            const line = rendered[i];
            const { ascent, descent } = lineMetrics[i];
            const baseline = y + ascent;
            maxWidth = Math.max(maxWidth, line.width);
            ellipsized ||= line.ellipsized;
            let x = rect.x;
            if (rect.width > line.width) {
                if (horizAlign === "center") {
                    x += (rect.width - line.width) / 2;
                } else if (horizAlign === "right") {
                    x += rect.width - line.width;
                }
            }
            for (const token of line.tokens) {
                if (token.text.length > 0) {
                    // Place this span's baseline on the line baseline.
                    const topAdjust = token.font.getTopAdjust();
                    const drawY = baseline - (token.height - 2 * topAdjust) - topAdjust;
                    draw2D?.doDrawRotatedText(token.text, x, drawY, token.color, opacity, token.font, rotation);
                }
                x += token.width;
            }
            y += ascent + descent;
        }
        this.setEllipsized(ellipsized);
        return { text: fullText, width: maxWidth, height: blockHeight, ellipsized };
    }

    protected setEllipsized(ellipsized: boolean) {
        this.fields.get("istextellipsized")?.setValue(BrsBoolean.from(ellipsized));
    }

    /** (Re)builds the resolved styles map when `drawingStyles`/`color` change. */
    private buildStyles() {
        const raw = (this.getValueJS("drawingStyles") as Record<string, unknown>) ?? {};
        const nodeColor = this.getValueJS("color") as number;
        const signature = JSON.stringify(raw) + "|" + nodeColor;
        if (this.appliedStyles === signature) {
            return;
        }
        this.styles = new Map();
        for (const [styleName, def] of Object.entries(raw)) {
            if (def === null || typeof def !== "object") {
                continue;
            }
            const style = def as Record<string, unknown>;
            const fontUri = ciGet(style, "fontUri");
            const uri = typeof fontUri === "string" ? fontUri : "";
            const size = this.resolveFontSize(ciGet(style, "fontSize"));
            const font = SGNodeFactory.createNode(SGNodeType.Font) as Font;
            if (uri.startsWith("font:")) {
                // System fonts are fixed size; fontSize is ignored.
                font.setSystemFont(uri.slice(5));
            } else if (uri !== "") {
                font.setValue("uri", new BrsString(uri));
                if (size > 0) {
                    font.setSize(size);
                }
            } else if (size > 0) {
                font.setSize(size);
            }
            const colorValue = ciGet(style, "color");
            const color = typeof colorValue === "string" && colorValue.length ? convertHexColor(colorValue) : nodeColor;
            // Markup tag matching is case-insensitive, so key the styles map by lowercase name.
            this.styles.set(styleName.toLowerCase(), { font, color });
        }
        this.appliedStyles = signature;
    }

    /** A drawing style's fontSize may be a number or an `{ fhd, hd }` map. */
    private resolveFontSize(fontSize: unknown): number {
        if (typeof fontSize === "number") {
            return fontSize;
        }
        if (fontSize !== null && typeof fontSize === "object") {
            const value = ciGet(fontSize as Record<string, unknown>, this.resolution === "HD" ? "hd" : "fhd");
            if (typeof value === "number") {
                return value;
            }
        }
        return 0;
    }

    /** The implicit default style: a system-default font plus the node's `color`. */
    private getDefaultStyle(): DrawStyle {
        const color = this.getValueJS("color") as number;
        if (this.defaultStyle) {
            this.defaultStyle.color = color;
        } else {
            this.defaultStyle = { font: SGNodeFactory.createNode(SGNodeType.Font) as Font, color };
        }
        return this.defaultStyle;
    }

    /** Resolves a style name to a draw font + color, falling back to default. */
    private resolveStyle(styleName: string): { drawFont: RoFont; color: number } | undefined {
        const entry = this.styles.get(styleName.toLowerCase()) ?? this.styles.get("default") ?? this.getDefaultStyle();
        const drawFont = entry.font.createDrawFont();
        if (!(drawFont instanceof RoFont)) {
            return undefined;
        }
        return { drawFont, color: entry.color };
    }

    /** Parses the markup `text` into runs of `{ text, style }`. */
    private parseRuns(text: string): { text: string; style: string }[] {
        const runs: { text: string; style: string }[] = [];
        const tagRe = /<(\/?)([A-Za-z0-9_]+)>/g;
        const stack: string[] = ["default"];
        let last = 0;
        let match: RegExpExecArray | null;
        while ((match = tagRe.exec(text)) !== null) {
            if (match.index > last) {
                runs.push({ text: text.slice(last, match.index), style: stack.at(-1)! });
            }
            const name = match[2].toLowerCase();
            if (match[1] === "/") {
                // Closing tag: pop the matching style (tolerant of mismatches).
                const idx = stack.lastIndexOf(name);
                if (idx > 0) {
                    stack.splice(idx, 1);
                }
            } else {
                stack.push(name);
            }
            last = tagRe.lastIndex;
        }
        if (last < text.length) {
            runs.push({ text: text.slice(last), style: stack.at(-1)! });
        }
        return runs;
    }

    /** Resolves runs to measured, style-aware tokens (words, spaces, newlines). */
    private tokenize(runs: { text: string; style: string }[]): Token[] {
        const tokens: Token[] = [];
        for (const run of runs) {
            if (run.text.length === 0) {
                continue;
            }
            const resolved = this.resolveStyle(run.style);
            if (!resolved) {
                continue;
            }
            const { drawFont, color } = resolved;
            const parts = run.text.split(/(\n|\s|-)/);
            for (const part of parts) {
                if (part === "") {
                    continue;
                }
                if (part === "\n") {
                    tokens.push({
                        text: "",
                        font: drawFont,
                        color,
                        width: 0,
                        height: drawFont.measureTextHeight(),
                        newline: true,
                    });
                } else {
                    const measured = drawFont.measureText(part);
                    tokens.push({
                        text: part,
                        font: drawFont,
                        color,
                        width: measured.width,
                        height: measured.height,
                        newline: false,
                    });
                }
            }
        }
        return tokens;
    }

    private makeLine(tokens: Token[]): Line {
        let width = 0;
        let height = 0;
        for (const token of tokens) {
            width += token.width;
            height = Math.max(height, token.height);
        }
        return { tokens, width, height, ellipsized: false };
    }

    /** Builds the single line rendered when `wrap` is false (up to first newline). */
    private singleLine(tokens: Token[], width: number, ellipsis: string, onBoundary: boolean): Line {
        const lineTokens: Token[] = [];
        for (const token of tokens) {
            if (token.newline) {
                break;
            }
            lineTokens.push(token);
        }
        let line = this.makeLine(lineTokens);
        if (width > 0 && line.width > width) {
            line = this.ellipsizeTokenLine(line, width, ellipsis, onBoundary);
        }
        return line;
    }

    /** Greedily wraps tokens into lines no wider than `width`, breaking at newlines. */
    private wrapTokens(tokens: Token[], width: number): Line[] {
        const lines: Line[] = [];
        let current: Token[] = [];
        let currentWidth = 0;
        const flush = () => {
            if (current.length > 0 || lines.length === 0) {
                lines.push(this.makeLine(current));
            }
            current = [];
            currentWidth = 0;
        };
        for (const token of tokens) {
            if (token.newline) {
                flush();
                continue;
            }
            if (token.width > width) {
                // A single token wider than the line: break it by characters.
                if (current.length > 0) {
                    flush();
                }
                for (const piece of this.breakToken(token, width)) {
                    if (currentWidth + piece.width > width && current.length > 0) {
                        flush();
                    }
                    current.push(piece);
                    currentWidth += piece.width;
                }
                continue;
            }
            if (currentWidth + token.width > width && current.length > 0) {
                flush();
                if (token.text.trim() === "") {
                    // Drop whitespace that would otherwise lead a wrapped line.
                    continue;
                }
            }
            current.push(token);
            currentWidth += token.width;
        }
        flush();
        return lines;
    }

    /** Splits a token wider than `width` into character-level pieces. */
    private breakToken(token: Token, width: number): Token[] {
        const pieces: Token[] = [];
        let current = "";
        for (const char of token.text) {
            if (current !== "" && token.font.measureTextWidth(current + char).width > width) {
                const measured = token.font.measureText(current);
                pieces.push({ ...token, text: current, width: measured.width, height: measured.height });
                current = char;
            } else {
                current += char;
            }
        }
        if (current !== "") {
            const measured = token.font.measureText(current);
            pieces.push({ ...token, text: current, width: measured.width, height: measured.height });
        }
        return pieces;
    }

    /**
     * Trims a line to fit `maxWidth` and appends the ellipsis. Used both for
     * width overflow and for line-count truncation, so it always ends with the
     * ellipsis. `onBoundary` ellipsizes by whole words; otherwise by characters.
     */
    private ellipsizeTokenLine(line: Line, maxWidth: number, ellipsis: string, onBoundary: boolean): Line {
        if (line.tokens.length === 0) {
            return { ...line, ellipsized: true };
        }
        const lastToken = line.tokens.at(-1)!;
        const budget = maxWidth - lastToken.font.measureTextWidth(ellipsis).width;
        const result: Token[] = [];
        let used = 0;
        for (const token of line.tokens) {
            if (used + token.width <= budget) {
                result.push(token);
                used += token.width;
                continue;
            }
            if (onBoundary) {
                // Whole-word ellipsis: drop trailing whitespace-only tokens.
                while (result.length > 0 && result.at(-1)!.text.trim() === "") {
                    result.pop();
                }
            } else {
                // Character-level truncation within the overflowing token.
                let truncated = "";
                for (const char of token.text) {
                    if (used + token.font.measureTextWidth(truncated + char).width <= budget) {
                        truncated += char;
                    } else {
                        break;
                    }
                }
                if (truncated.length > 0) {
                    const measured = token.font.measureText(truncated);
                    result.push({ ...token, text: truncated, width: measured.width, height: measured.height });
                }
            }
            break;
        }
        const ellipsisFont = result.length > 0 ? result.at(-1)!.font : lastToken.font;
        const ellipsisColor = result.length > 0 ? result.at(-1)!.color : lastToken.color;
        result.push({
            text: ellipsis,
            font: ellipsisFont,
            color: ellipsisColor,
            width: ellipsisFont.measureTextWidth(ellipsis).width,
            height: ellipsisFont.measureTextHeight(),
            newline: false,
        });
        return { ...this.makeLine(result), ellipsized: true };
    }
}
