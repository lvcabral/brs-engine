import { BrsValue, ValueKind, BrsString, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { FontMetrics, getFontRegistry } from "./RoFontRegistry";
import { BrsCanvas, BrsCanvasContext2D, MeasuredText } from "../interfaces/IfDraw2D";

/**
 * Cap on memoized measurements per font. Text is measured per *rendered string*, so an app with a
 * clock, a counter or a scrolling label would otherwise grow this without bound. Clearing wholesale
 * on overflow keeps the bookkeeping free — the entries a screen actually uses are re-measured once
 * and the steady state is small.
 */
const MeasureCacheLimit = 4096;

export class RoFont extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly family: string;
    private readonly size: number;
    private readonly bold: boolean;
    private readonly italic: boolean;
    private readonly metrics: FontMetrics;
    private readonly canvas: BrsCanvas;
    /**
     * Memoized `measureTextWidth` results, keyed by the text and the constraints (this font's
     * family/size/bold/italic are immutable, so they need no part in the key).
     *
     * Measuring is the single most expensive thing the text path does — a canvas `font` assignment
     * plus `measureText`, and for an ellipsized string one `measureText` per character removed — and
     * it is asked the same question over and over: a `LayoutGroup` lays out by running its children
     * as *measurement* passes (`renderNode` with no draw target), and `Group.isDirty` is only cleared
     * on a real frame draw, so every such pass re-measured every label underneath it. Appending one
     * child re-measured the whole subtree, which made the cost of creating a node grow with the size
     * of the tree (72 custom components: 178 ms each at the start, 386 ms each by the end; a device
     * is flat at ~10 ms).
     *
     * Entries are returned as-is rather than copied, so callers must treat them as read-only.
     */
    private readonly measureCache = new Map<string, { width: number; text: string; ellipsized: boolean }>();

    // Constructor can only be used by RoFontRegistry()
    constructor(family: BrsString, size: Int32, bold: BrsBoolean, italic: BrsBoolean, metrics: FontMetrics) {
        super("roFont");
        this.family = family.value;
        this.size = size.getValue();
        this.bold = bold.toBoolean();
        this.italic = italic.toBoolean();
        this.metrics = metrics;

        this.registerMethods({
            ifFont: [this.getOneLineHeight, this.getOneLineWidth, this.getAscent, this.getDescent, this.getMaxAdvance],
        });
        this.canvas = getFontRegistry().canvas;
    }

    measureTextHeight() {
        return Math.round(this.metrics.lineHeight * this.size);
    }

    measureTextWidth(text: string, maxWidth?: number, ellipsis?: string) {
        if (text === "") {
            // measuring "" is always width 0
            return { width: 0, text, ellipsized: false };
        }
        // The key separates its parts with an escaped NUL, which cannot appear in a rendered
        // string, so no combination of width, ellipsis and text can collide with another.
        const cacheKey = `${maxWidth ?? -1}\u0000${ellipsis ?? ""}\u0000${text}`;
        const cached = this.measureCache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const ctx = this.canvas.getContext("2d", { alpha: false }) as BrsCanvasContext2D;
        ctx.font = this.toFontString();
        ctx.textBaseline = "top";
        let measuredWidth = ctx.measureText(text).width;
        let length = maxWidth ? Math.min(measuredWidth, maxWidth) : measuredWidth;
        let ellipsizedText = text;
        let ellipsized = false;

        if (ellipsis && maxWidth && measuredWidth > maxWidth) {
            // Ellipsize the text
            let ellipsisWidth = ctx.measureText(ellipsis).width;
            let truncatedText = text;

            while (truncatedText.length > 0 && ctx.measureText(truncatedText).width + ellipsisWidth > maxWidth) {
                truncatedText = truncatedText.slice(0, -1);
            }

            ellipsizedText = truncatedText + ellipsis;
            length = ctx.measureText(ellipsizedText).width;
            ellipsized = true;
        }

        const measured = { width: Math.round(length), text: ellipsizedText, ellipsized };
        if (this.measureCache.size >= MeasureCacheLimit) {
            this.measureCache.clear();
        }
        this.measureCache.set(cacheKey, measured);
        return measured;
    }

    measureText(text: string, maxWidth?: number, ellipsis?: string): MeasuredText {
        let { width, text: ellipsizedText, ellipsized } = this.measureTextWidth(text, maxWidth, ellipsis);
        let height = this.measureTextHeight();
        return { width, height, text: ellipsizedText, ellipsized };
    }

    getTopAdjust(): number {
        const height = this.metrics.lineHeight * this.size;
        const ascent = Math.max(this.metrics.ascent * this.size, this.size);
        return (height - ascent) / 2;
    }

    /**
     * The Y offset from the top of this font's line-height box (`measureTextHeight()`) to where a
     * baseline draw (`textBaseline = "alphabetic"`) should land, built from this font's own declared
     * ascent/descent — not one string's ink — so that any two strings drawn with the same font/size
     * land on the exact same visual baseline, regardless of content. That's required whenever
     * independently-drawn text needs to line up: two separate Labels, grid cells, a keyboard row, a
     * PIN pad, an EPG time bar — a per-string-ink offset would put a "0" and a "g" at different
     * heights in the same row (real ink ascent for a 20px "0"/"g" pair differs by several px), and
     * two sibling components with/without a descender would visibly drift apart. Replaces the old
     * `textBaseline = "top"` + `getTopAdjust()` combo, which also had a `textBaseline = "top"`
     * cross-engine inconsistency (browsers don't agree on exactly which font-internal metric it
     * anchors to) that `"alphabetic"` sidesteps.
     *
     * Deliberately does NOT clamp ascent to a minimum of `size` the way `getTopAdjust()` does:
     * `RoFontRegistry` always derives `lineHeight` as `ascent + descent (+ lineGap)`, so the raw,
     * unclamped ascent/descent pair fits `lineHeight` exactly (`topSlack` is just half the line gap).
     * Reusing `getTopAdjust()`'s clamp here — combined with an explicit descent term this method has
     * and `getTopAdjust()` doesn't — inflates `ascent + descent` past `lineHeight` for any font whose
     * real ascent ratio is below 1.0 (both bundled fonts qualify), which pushes the drawn baseline low
     * enough to clip a descender (a "g", "y", …) past the bottom of `measureTextHeight()` — most
     * visible where a caller's box has little slack above `measureTextHeight()` already, e.g.
     * `PosterGrid`'s caption zone.
     */
    getBaselineOffset(): number {
        const lineHeight = this.metrics.lineHeight * this.size;
        const ascent = this.metrics.ascent * this.size;
        const descent = this.metrics.descent * this.size;
        const topSlack = Math.max(0, (lineHeight - ascent - descent) / 2);
        return topSlack + ascent;
    }

    /**
     * The Y to feed `doDrawText`/`doDrawRotatedText` (or an equivalent draw call) so that this
     * font's baseline lands exactly at `targetBaselineY`, in whatever coordinate space
     * `targetBaselineY` is expressed in — `doDrawRotatedText` adds `getBaselineOffset()` back
     * internally, so this is just that subtraction, named once instead of re-derived at each call
     * site. `targetBaselineY` itself is the caller's choice: a fixed anchor point (`SimpleLabel`'s
     * `vertOrigin="baseline"`) or an already-laid-out shared line baseline (`MultiStyleLabel`'s
     * per-token placement).
     */
    getBaselineDrawY(targetBaselineY: number): number {
        return targetBaselineY - this.getBaselineOffset();
    }

    toFontString(): string {
        let si = this.italic ? "italic" : "";
        let sb = this.bold ? "bold" : "";
        let ss = this.size;
        let sf = this.family;
        return `${si} ${sb} ${ss}px '${sf}'`;
    }

    toString(parent?: BrsType): string {
        return "<Component: roFont>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Returns the number of pixels from one line to the next when drawing with this font */
    private readonly getOneLineHeight = new Callable("getOneLineHeight", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.measureTextHeight());
        },
    });

    /** Returns the number of pixels from one line to the next when drawing with this font */
    private readonly getOneLineWidth = new Callable("getOneLineWidth", {
        signature: {
            args: [new StdlibArgument("text", ValueKind.String), new StdlibArgument("maxWidth", ValueKind.Int32)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, text: BrsString, maxWidth: Int32) => {
            let { width } = this.measureTextWidth(text.value, maxWidth.getValue());
            return new Int32(width);
        },
    });

    /** Returns the font ascent in pixels */
    private readonly getAscent = new Callable("getAscent", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(Math.round(this.metrics.ascent * this.size));
        },
    });

    /** Returns the font descent in pixels */
    private readonly getDescent = new Callable("getDescent", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(Math.round(this.metrics.descent * this.size));
        },
    });

    /** Returns the font maximum advance width in pixels */
    private readonly getMaxAdvance = new Callable("getMaxAdvance", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(Math.round(this.metrics.maxAdvance * this.size));
        },
    });
}
