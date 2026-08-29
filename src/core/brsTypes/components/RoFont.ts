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

    /**
     * Memoized real ink extents (`actualBoundingBoxAscent`/`Descent`) per rendered string, keyed
     * like `measureCache`. Unlike `metrics.ascent`/`descent` (the font file's theoretical maximum,
     * sized to fit accented capitals), these reflect what the specific string actually draws — a
     * short/no-descender string like "TV-PG" or a counter digit has real ink well short of the
     * font's ascent, and centering it as if it filled that full ascent piles all the slack below
     * the glyphs instead of splitting it (`getBaselineOffset`).
     */
    private readonly inkCache = new Map<string, { ascent: number; descent: number }>();

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
        // "alphabetic", not "top": `.width` (the only thing this loop needs) is baseline-independent,
        // but this is also the one canvas `measureText` call per rendered string that the app pays
        // for, so `cacheInk` below piggybacks on it to grab `actualBoundingBox*` for free — relative
        // to "alphabetic", matching `getBaselineOffset`'s draw-time baseline — rather than costing a
        // second `measureText` call.
        const ctx = this.measureContext();
        let lastMeasured = ctx.measureText(text);
        let measuredWidth = lastMeasured.width;
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
            lastMeasured = ctx.measureText(ellipsizedText);
            length = lastMeasured.width;
            ellipsized = true;
        }
        this.cacheInk(ellipsizedText, lastMeasured);

        const measured = { width: Math.round(length), text: ellipsizedText, ellipsized };
        return RoFont.boundedSet(this.measureCache, cacheKey, measured);
    }

    /** Inserts into a size-capped cache, clearing it wholesale first if already at
     *  `MeasureCacheLimit` — shared eviction policy for `measureCache` and `inkCache`. Returns
     *  `value` so callers that just built it can return the same call's result. */
    private static boundedSet<K, V>(map: Map<K, V>, key: K, value: V): V {
        if (map.size >= MeasureCacheLimit) {
            map.clear();
        }
        map.set(key, value);
        return value;
    }

    /** A canvas context configured for this font, measuring relative to the alphabetic baseline
     *  (matching `getBaselineOffset`'s draw-time baseline) — shared setup for `measureTextWidth`
     *  and `measureInk`'s fallback. */
    private measureContext(): BrsCanvasContext2D {
        const ctx = this.canvas.getContext("2d", { alpha: false }) as BrsCanvasContext2D;
        ctx.font = this.toFontString();
        ctx.textBaseline = "alphabetic";
        return ctx;
    }

    /** Stores the ink extents already computed by a `measureTextWidth` pass, keyed by the exact
     *  text they describe, so `getBaselineOffset` never has to re-measure. */
    private cacheInk(
        text: string,
        measured: { actualBoundingBoxAscent?: number; actualBoundingBoxDescent?: number }
    ): { ascent: number; descent: number } {
        return RoFont.boundedSet(this.inkCache, text, {
            ascent: measured.actualBoundingBoxAscent ?? this.metrics.ascent * this.size,
            descent: measured.actualBoundingBoxDescent ?? this.metrics.descent * this.size,
        });
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
     * Real ink extents of a specific string: how far its glyphs actually reach above/below the
     * alphabetic baseline. Populated by `measureTextWidth`'s own `measureText` call (`cacheInk`) for
     * every string that path has already measured — which every drawn string is, since `Group.drawText`/
     * `drawTextWrap` always resolve `measured.text` through `measureText`/`measureTextWidth` before
     * handing it to `doDrawText`/`doDrawRotatedText`. The direct `measureText` call here only covers a
     * caller that skips that path; falls back to the font's own ascent/descent metrics when the canvas
     * backend doesn't report `actualBoundingBox*` (older engines) — a symmetric worst case, not a crash.
     */
    private measureInk(text: string): { ascent: number; descent: number } {
        if (text === "") {
            return { ascent: 0, descent: 0 };
        }
        const cached = this.inkCache.get(text);
        if (cached) {
            return cached;
        }
        return this.cacheInk(text, this.measureContext().measureText(text));
    }

    /**
     * The Y offset from the top of this font's line-height box (`measureTextHeight()`) to where a
     * baseline draw (`textBaseline = "alphabetic"`) should land, so a string's real ink — not the
     * font's theoretical max ascent — sits centered within that box. Replaces the old
     * `textBaseline = "top"` + `getTopAdjust()` combo for single/multi-line text drawing
     * (`IfDraw2D.doDrawText`/`doDrawRotatedText`): that combo assumed every string's ink fills the
     * font's full ascent, which overshoots real cap-height for short or no-descender strings (a
     * badge/rating pill's "TV-PG", a counter's digit, …) and made them look top-heavy. Also sidesteps
     * a `textBaseline = "top"` cross-engine inconsistency: browsers don't agree on exactly which
     * font-internal metric it anchors to, while the alphabetic baseline and `actualBoundingBox*` are
     * both specified relative to the glyphs actually drawn.
     */
    getBaselineOffset(text: string): number {
        const ink = this.measureInk(text);
        const lineHeight = this.metrics.lineHeight * this.size;
        const topSlack = (lineHeight - ink.ascent - ink.descent) / 2;
        return topSlack + ink.ascent;
    }

    /**
     * The font-only (not per-string) counterpart to `getBaselineOffset`: the same box-top-to-baseline
     * distance, but built from this font's own declared ascent/descent rather than one string's ink.
     * `getBaselineOffset` is right for one label standing alone (its ink should center in its own
     * box), but wrong for several independently-drawn glyphs that must share one visual baseline — a
     * keyboard row, a PIN pad, a monospace grid, an EPG time bar or program-title row. There, using
     * per-glyph ink would put a digit and a "g" at different heights in the same row (real ink ascent
     * for a 20px "0"/"g" pair differs by several px). Callers needing that compute this once for the
     * whole row/grid and pass it as `targetBaselineY` to `getBaselineDrawY` for each glyph.
     */
    getMetricBaselineOffset(): number {
        const lineHeight = this.metrics.lineHeight * this.size;
        const ascent = Math.max(this.metrics.ascent * this.size, this.size);
        const descent = this.metrics.descent * this.size;
        const topSlack = (lineHeight - ascent - descent) / 2;
        return topSlack + ascent;
    }

    /**
     * The Y to feed `doDrawText`/`doDrawRotatedText` (or an equivalent draw call) so that `text`'s
     * baseline lands exactly at `targetBaselineY`, in whatever coordinate space `targetBaselineY` is
     * expressed in — `doDrawRotatedText` adds `getBaselineOffset(text)` back internally, so this is
     * just that subtraction, named once instead of re-derived at each call site. `targetBaselineY`
     * itself is the caller's choice: a fixed anchor point (`SimpleLabel`'s `vertOrigin="baseline"`),
     * an already-laid-out shared line baseline (`MultiStyleLabel`'s per-token placement), or a
     * font-metric constant (`getMetricBaselineOffset()`, for `uniformBaseline` grid/row callers).
     */
    getBaselineDrawY(targetBaselineY: number, text: string): number {
        return targetBaselineY - this.getBaselineOffset(text);
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
