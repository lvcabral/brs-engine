import { BrsValue, ValueKind, BrsString, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { FontMetrics } from "./RoFontRegistry";
import {
    BrsCanvasContext2D,
    createNewCanvas,
    MeasuredText,
    releaseCanvas,
} from "../interfaces/IfDraw2D";

export class RoFont extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly family: string;
    private readonly size: number;
    private readonly bold: boolean;
    private readonly italic: boolean;
    private readonly metrics: FontMetrics;

    // Constructor can only be used by RoFontRegistry()
    constructor(
        family: BrsString,
        size: Int32,
        bold: BrsBoolean,
        italic: BrsBoolean,
        metrics: FontMetrics
    ) {
        super("roFont");
        this.family = family.value;
        this.size = size.getValue();
        this.bold = bold.toBoolean();
        this.italic = italic.toBoolean();
        this.metrics = metrics;

        this.registerMethods({
            ifFont: [
                this.getOneLineHeight,
                this.getOneLineWidth,
                this.getAscent,
                this.getDescent,
                this.getMaxAdvance,
            ],
        });
    }

    measureTextHeight() {
        return Math.round(this.metrics.lineHeight * this.size);
    }

    measureTextWidth(text: string, maxWidth?: number, ellipsis?: string) {
        const canvas = createNewCanvas(1280, 720);
        const ctx = canvas.getContext("2d", { alpha: false }) as BrsCanvasContext2D;
        ctx.font = this.toFontString();
        ctx.textBaseline = "top";
        let measure = ctx.measureText(text);
        let length = maxWidth ? Math.min(measure.width, maxWidth) : measure.width;
        let ellipsizedText = text;
        let ellipsized = false;

        if (ellipsis && maxWidth && measure.width > maxWidth) {
            // Ellipsize the text
            let ellipsisWidth = ctx.measureText(ellipsis).width;
            let truncatedText = text;

            while (
                ctx.measureText(truncatedText).width + ellipsisWidth > maxWidth &&
                truncatedText.length > 0
            ) {
                truncatedText = truncatedText.slice(0, -1);
            }

            ellipsizedText = truncatedText + ellipsis;
            length = ctx.measureText(ellipsizedText).width;
            ellipsized = true;
        }

        releaseCanvas(canvas);
        return { width: Math.round(length), text: ellipsizedText, ellipsized };
    }

    measureText(text: string, maxWidth?: number, ellipsis?: string): MeasuredText {
        let {
            width,
            text: ellipsizedText,
            ellipsized,
        } = this.measureTextWidth(text, maxWidth, ellipsis);
        let height = this.measureTextHeight();
        return { width, height, text: ellipsizedText, ellipsized };
    }

    getTopAdjust(): number {
        const height = this.metrics.lineHeight * this.size;
        const ascent = Math.max(this.metrics.ascent * this.size, this.size);
        return (height - ascent) / 2;
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
            args: [
                new StdlibArgument("text", ValueKind.String),
                new StdlibArgument("maxWidth", ValueKind.Int32),
            ],
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
