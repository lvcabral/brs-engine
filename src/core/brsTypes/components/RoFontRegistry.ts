import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { validUri } from "../../device/FileSystem";
import { Int32 } from "../Int32";
import { RoArray } from "./RoArray";
import { RoFont } from "./RoFont";
import * as opentype from "opentype.js";
import { BrsDevice } from "../../device/BrsDevice";
import { BrsCanvas, createNewCanvas, releaseCanvas } from "../interfaces/IfDraw2D";

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
    readonly canvas: BrsCanvas;
    private readonly defaultFontSize = 40;
    private readonly fallbackFontFamily = "Arial, Helvetica, sans-serif";
    private readonly defaultFontFamilies: { regular: string; bold: string; italic: string; boldItalic: string };
    private readonly fontRegistry: Map<string, FontMetrics[]>;
    private readonly fontPaths: Map<string, string> = new Map();

    constructor() {
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
        const defaultFont = "DejaVuSansCondensed";
        this.fontRegistry = new Map();
        this.defaultFontFamilies = {
            regular: this.registerFont(`common:/Fonts/${defaultFont}.ttf`, true),
            bold: this.registerFont(`common:/Fonts/${defaultFont}-Bold.ttf`, true),
            italic: this.registerFont(`common:/Fonts/${defaultFont}-Oblique.ttf`, true),
            boldItalic: this.registerFont(`common:/Fonts/${defaultFont}-BoldOblique.ttf`, true),
        };
        this.canvas = createNewCanvas(10, 10);
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

    dispose() {
        releaseCanvas(this.canvas);
    }

    createFont(family: BrsString, size: Int32, bold: BrsBoolean, italic: BrsBoolean): BrsType {
        /* Roku tries to respect style version of the font (regular, bold, italic, bold+italic),
            but if it's not available returns the first one registered. */
        const array = this.fontRegistry.get(family.value);
        if (array) {
            const weight = bold.toBoolean() ? "bold" : "normal";
            const styles = italic.toBoolean() ? ["italic", "oblique"] : ["normal"];
            let metrics;
            array.some((element) => {
                if (element.weight === weight && styles.includes(element.style)) {
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
                    BrsBoolean.from(["italic", "oblique"].includes(metrics.style)),
                    metrics
                );
            }
            return new RoFont(family, size, bold, italic, metrics);
        }
        if (family.value === this.getDefaultFontFamily(bold.toBoolean(), italic.toBoolean())) {
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

    getDefaultFontFamily(bold: boolean, italic: boolean): string {
        if (bold && italic) {
            return this.defaultFontFamilies.boldItalic;
        } else if (bold) {
            return this.defaultFontFamilies.bold;
        } else if (italic) {
            return this.defaultFontFamilies.italic;
        } else {
            return this.defaultFontFamilies.regular;
        }
    }

    getFontFamily(uri: string) {
        const family = this.fontPaths.get(uri);
        return family ?? this.registerFont(uri, true);
    }

    registerFont(fontPath: string, fullFamily: boolean = false): string {
        try {
            const fsys = BrsDevice.fileSystem;
            if (!validUri(fontPath) || !fsys.existsSync(fontPath)) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`warning,Font file not found: ${fontPath}`);
                }
                return "";
            } else if (this.fontPaths.has(fontPath)) {
                return this.fontPaths.get(fontPath) ?? "";
            }
            const fontData = BrsDevice.fileSystem.readFileSync(fontPath);
            const fontObj = opentype.parse(fontData.buffer);
            // Get font metrics
            const fontMetrics = {
                ascent: fontObj.ascender / fontObj.unitsPerEm,
                descent: Math.abs(fontObj.descender / fontObj.unitsPerEm),
                maxAdvance: fontObj.tables.hhea.advanceWidthMax / fontObj.unitsPerEm,
                lineHeight:
                    (fontObj.ascender - fontObj.descender + (fontObj.tables.hhea.lineGap as number)) /
                    fontObj.unitsPerEm,
                style: fontObj.tables.head.macStyle & (1 << 1) ? "italic" : "normal",
                weight: fontObj.tables.head.macStyle & (1 << 0) ? "bold" : "normal",
            };
            // Register font family
            const fontFamily = fullFamily ? fontObj.names.fullName.en : fontObj.names.fontFamily.en;
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
            if (BrsDevice.isDevMode) {
                BrsDevice.stderr.write(`warning,Error loading font:${fontPath} - ${err.message}`);
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
        impl: (_: Interpreter, family: BrsString, size: Int32, bold: BrsBoolean, italic: BrsBoolean) => {
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
            const family = new BrsString(this.getDefaultFontFamily(bold.toBoolean(), italic.toBoolean()));
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
export function getFontRegistry(): RoFontRegistry {
    if (!fontRegistry) {
        fontRegistry = new RoFontRegistry();
    }
    return fontRegistry;
}
