import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { validUri } from "../../interpreter/FileSystem";
import { Int32 } from "../Int32";
import { RoArray } from "./RoArray";
import { RoFont } from "./RoFont";
import * as opentype from "opentype.js";

export interface FontMetrics {
    ascent: number;
    descent: number;
    maxAdvance: number;
    lineHeight: number;
    style: string;
    weight: string;
}

// Singleton instance of Font Registry
let fontRegistry: RoFontRegistry;

export class RoFontRegistry extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly defaultFontSize = 40;
    private readonly fallbackFontFamily = "Arial, Helvetica, sans-serif";
    private readonly defaultFontFamily: string;
    private readonly fontRegistry: Map<string, FontMetrics[]>;

    constructor(interpreter: Interpreter) {
        super("roFontRegistry");
        this.registerMethods({
            ifFontRegistry: [
                this.register,
                this.getFamilies,
                this.getFont,
                this.getDefaultFont,
                this.getDefaultFontSize,
                // this.get, ---> Deprecated as only needed to roImageCanvas
            ],
        });
        this.fontRegistry = new Map();
        this.defaultFontFamily = interpreter.deviceInfo.get("defaultFont");
        this.registerFont(interpreter, `common:/Fonts/${this.defaultFontFamily}-Regular.ttf`);
        this.registerFont(interpreter, `common:/Fonts/${this.defaultFontFamily}-Bold.ttf`);
        this.registerFont(interpreter, `common:/Fonts/${this.defaultFontFamily}-Italic.ttf`);
        this.registerFont(interpreter, `common:/Fonts/${this.defaultFontFamily}-BoldItalic.ttf`);
    }

    toString(parent?: BrsType): string {
        return "<Component: roFontRegistry>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    count() {
        return this.fontRegistry.size;
    }

    createFont(family: BrsString, size: Int32, bold: BrsBoolean, italic: BrsBoolean): BrsType {
        /* Roku tries to respect style version of the font (regular, bold, italic, bold+italic),
            but if it's not available returns the first one registered. */
        const array = this.fontRegistry.get(family.value);
        const weight = bold.toBoolean() ? "bold" : "normal";
        const style = italic.toBoolean() ? "italic" : "normal";
        if (array) {
            let metrics;
            array.some((element) => {
                if (element.weight === weight && element.style === style) {
                    metrics = element;
                    return true;
                }
                return false;
            });
            if (!metrics) {
                metrics = array[0];
                return new RoFont(
                    family,
                    size,
                    BrsBoolean.from(metrics.weight === "bold"),
                    BrsBoolean.from(metrics.style === "italic"),
                    metrics
                );
            }
            return new RoFont(family, size, bold, italic, metrics);
        }
        if (family.value === this.defaultFontFamily) {
            // Fallback to browser font if default fonts are not available
            family = new BrsString(this.fallbackFontFamily);
            let metrics: FontMetrics = {
                ascent: 1.06884765625,
                descent: 0.29296875,
                maxAdvance: 1.208984375,
                lineHeight: 1.36181640625,
                style: bold.toBoolean() ? "bold" : "normal",
                weight: italic.toBoolean() ? "italic" : "normal",
            };
            return new RoFont(family, size, bold, italic, metrics);
        }
        return BrsInvalid.Instance;
    }

    registerFont(interpreter: Interpreter, fontPath: string) {
        try {
            const fsys = interpreter.fileSystem;
            if (!fsys || !validUri(fontPath)) {
                return BrsBoolean.False;
            }
            const fontData = interpreter.fileSystem.readFileSync(fontPath);
            const fontObj = opentype.parse(fontData.buffer);
            // Get font metrics
            const fontMetrics = {
                ascent: fontObj.ascender / fontObj.unitsPerEm,
                descent: Math.abs(fontObj.descender / fontObj.unitsPerEm),
                maxAdvance: fontObj.tables.hhea.advanceWidthMax / fontObj.unitsPerEm,
                lineHeight:
                    (fontObj.ascender -
                        fontObj.descender +
                        (fontObj.tables.hhea.lineGap as number)) /
                    fontObj.unitsPerEm,
                style: fontObj.tables.head.macStyle & (1 << 1) ? "italic" : "normal",
                weight: fontObj.tables.head.macStyle & (1 << 0) ? "bold" : "normal",
            };
            // Register font family
            const fontFamily = fontObj.names.fontFamily.en;
            if (typeof FontFace !== "undefined") {
                const fontFace = new FontFace(fontFamily, fontData, {
                    weight: fontMetrics.weight,
                    style: fontMetrics.style,
                });
                (self as any).fonts.add(fontFace);
            }
            const familyArray = this.fontRegistry.get(fontFamily);
            if (familyArray) {
                familyArray.push(fontMetrics);
            } else {
                this.fontRegistry.set(fontFamily, [fontMetrics]);
            }
        } catch (err: any) {
            interpreter.stderr.write(`error,Error loading font:${fontPath} - ${err.message}`);
            return BrsBoolean.False;
        }
        return BrsBoolean.True;
    }

    /** Register a font file (.ttf or .otf format). */
    private readonly register = new Callable("register", {
        signature: {
            args: [new StdlibArgument("fontPath", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fontPath: BrsString) => {
            return this.registerFont(interpreter, fontPath.value);
        },
    });

    /** Returns an roArray of strings that represent the names of the font families which have been registered via Register(). */
    private readonly getFamilies = new Callable("getFamilies", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            const families: BrsString[] = [];
            [...this.fontRegistry.keys()].forEach((family) => {
                families.push(new BrsString(family));
            });
            return new RoArray(families);
        },
    });

    /** Returns an roFont object representing a font from the specified family, selected from the fonts previously registered via Register(). */
    private readonly getFont = new Callable("getFont", {
        signature: {
            args: [
                new StdlibArgument("family", ValueKind.String),
                new StdlibArgument("size", ValueKind.Int32),
                new StdlibArgument("bold", ValueKind.Boolean),
                new StdlibArgument("italic", ValueKind.Boolean),
            ],
            returns: ValueKind.Object,
        },
        impl: (
            _: Interpreter,
            family: BrsString,
            size: Int32,
            bold: BrsBoolean,
            italic: BrsBoolean
        ) => {
            return this.createFont(family, size, bold, italic);
        },
    });

    /** Returns an roFont object representing the system default font. */
    private readonly getDefaultFont = new Callable("getDefaultFont", {
        signature: {
            args: [
                new StdlibArgument("size", ValueKind.Int32, new Int32(this.defaultFontSize)),
                new StdlibArgument("bold", ValueKind.Boolean, BrsBoolean.False),
                new StdlibArgument("italic", ValueKind.Boolean, BrsBoolean.False),
            ],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, size: Int32, bold: BrsBoolean, italic: BrsBoolean) => {
            const family = new BrsString(this.defaultFontFamily);
            return this.createFont(family, size, bold, italic);
        },
    });

    /** Returns the default font size. */
    private readonly getDefaultFontSize = new Callable("getDefaultFontSize", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.defaultFontSize);
        },
    });
}

// Function to get the singleton instance of Font Registry
export function getFontRegistry(interpreter: Interpreter): RoFontRegistry {
    if (!fontRegistry) {
        fontRegistry = new RoFontRegistry(interpreter);
    }
    return fontRegistry;
}
