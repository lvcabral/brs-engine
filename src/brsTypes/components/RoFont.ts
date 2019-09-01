import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";

export class RoFont extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private family: string;
    private size: number;
    private bold: boolean;
    private italic: boolean;

    constructor(family: BrsString, size: Int32, bold: BrsBoolean, italic: BrsBoolean) {
        super("roFont");
        this.family = family.value;
        this.size = size.getValue();
        this.bold = bold.toBoolean();
        this.italic = italic.toBoolean();

        this.registerMethods([
            this.getOneLineHeight,
            this.getOneLineWidth,
            this.getAscent,
            this.getDescent,
            this.getMaxAdvance,
        ]);
    }

    toFontString(): string {
        let si = this.italic ? "italic" : "";
        let sb = this.bold ? "bold" : "";
        let ss = this.size;
        let sf = this.family;
        return `${si} ${sb} ${ss}px ${sf}`;
    }

    toString(parent?: BrsType): string {
        return "<Component: roFont>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Returns the number of pixels from one line to the next when drawing with this font */
    private getOneLineHeight = new Callable("getOneLineHeight", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.size + 7); // TODO: Use https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/measureText
        },
    });

    /** Returns the number of pixels from one line to the next when drawing with this font */
    private getOneLineWidth = new Callable("getOneLineWidth", {
        signature: {
            args: [
                new StdlibArgument("text", ValueKind.String),
                new StdlibArgument("maxWidth", ValueKind.Int32),
            ],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, text: BrsString, maxWidth: Int32) => {
            let canvas = new OffscreenCanvas(1280, 720);
            let ctx = canvas.getContext("2d", {
                alpha: false,
            }) as OffscreenCanvasRenderingContext2D;
            ctx.font = this.toFontString();
            console.log(this.toFontString());
            ctx.textBaseline = "top";
            let measure = ctx.measureText(text.value);
            let length = Math.min(measure.width, maxWidth.getValue());
            return new Int32(Math.round(length));
        },
    });

    /** Returns the font ascent in pixels */
    private getAscent = new Callable("getAscent", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.size - 3); // TODO: Use https://github.com/soulwire/FontMetrics
        },
    });

    /** Returns the font descent in pixels */
    private getDescent = new Callable("getDescent", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(9); // TODO: Use https://github.com/soulwire/FontMetrics
        },
    });

    /** Returns the font maximum advance width in pixels */
    private getMaxAdvance = new Callable("getMaxAdvance", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.size + 8); // TODO: Use https://github.com/soulwire/FontMetrics
        },
    });
}
