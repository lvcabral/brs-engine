import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { validUri } from "../../FileSystem";
import { Int32 } from "../Int32";
import { RoArray } from "./RoArray";
import { RoFont } from "./RoFont";
import * as opentype from "opentype.js";
import { BrsDevice } from "../../BrsDevice";

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
    private readonly interpreter: Interpreter;
    private readonly defaultFontSize = 40;
    private readonly fallbackFontFamily = "Arial, Helvetica, sans-serif";
    private readonly defaultFontFamily: string;
    private readonly fontRegistry: Map<string, FontMetrics[]>;
    private readonly fontPaths: Map<string, string> = new Map();

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
        this.interpreter = interpreter;
        this.fontRegistry = new Map();
        this.defaultFontFamily = BrsDevice.deviceInfo.get("defaultFont");
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

    registerFont(interpreter: Interpreter, fontPath: string) {
        try {
            const fsys = BrsDevice.fileSystem;
            if (!fsys || !validUri(fontPath)) {
                return BrsBoolean.False;
            }
            const fontData = BrsDevice.fileSystem.readFileSync(fontPath);
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
            this.fontPaths.set(fontPath, fontFamily);
            return fontFamily;
        } catch (err: any) {
            if (this.interpreter.isDevMode) {
                this.interpreter.stderr.write(
                    `warning,Error loading font:${fontPath} - ${err.message}`
                );
            }
            return "";
        }
    }

    /** Register a font file (.ttf or .otf format). */
    private readonly register = new Callable("register", {
        signature: {
            args: [new StdlibArgument("fontPath", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, fontPath: BrsString) => {
            return BrsBoolean.from(this.registerFont(fontPath.value) !== "");
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
export function getFontRegistry(interpreter?: Interpreter): RoFontRegistry {
    if (!fontRegistry && interpreter) {
        fontRegistry = new RoFontRegistry(interpreter);
    }
    return fontRegistry;
}
