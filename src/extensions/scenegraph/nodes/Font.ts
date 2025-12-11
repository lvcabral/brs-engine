import {
    AAMember,
    BrsDevice,
    BrsBoolean,
    BrsString,
    BrsType,
    Int32,
    isBrsString,
    RoFont,
    getFontRegistry,
    RoFontRegistry,
    BrsInvalid,
} from "brs-engine";
import { sgRoot } from "../SGRoot";
import { Node } from "./Node";
import { FieldKind, FieldModel } from "../SGTypes";

export class Font extends Node {
    readonly defaultFields: FieldModel[] = [
        { name: "uri", type: "uri" },
        { name: "size", type: "integer", value: "24" },
        { name: "fallbackGlyph", type: "string" },
    ];

    static readonly DrawFontCache: Map<string, RoFont> = new Map();

    private readonly defaultSize: number;
    private readonly resolution: string;
    private readonly fontRegistry: RoFontRegistry;
    private systemFont: string;

    constructor(members: AAMember[] = [], readonly name: string = "Font") {
        super([], name);

        this.resolution = sgRoot.scene?.ui.resolution ?? "HD";
        this.defaultSize = this.resolution === "HD" ? 24 : 36;

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);

        this.setValueSilent("size", new Int32(this.defaultSize));
        this.systemFont = "MediumSystemFont";
        this.fontRegistry = getFontRegistry();
        initSystemFonts(this.fontRegistry);
    }

    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "uri" && isBrsString(value)) {
            this.fontRegistry.registerFont(value.getValue(), true);
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    getUri() {
        return (this.getValueJS("uri") as string) ?? "";
    }

    getSize() {
        return (this.getValueJS("size") as number) ?? this.defaultSize;
    }

    setSize(size: number) {
        this.setValueSilent("size", new Int32(size));
    }

    setSystemFont(font: string) {
        const systemFont = systemFonts.get(font.toLowerCase());
        if (systemFont) {
            this.systemFont = font;
            this.setSize(this.resolution === "HD" ? systemFont.hd : systemFont.fhd);
            return true;
        }
        return false;
    }

    createDrawFont() {
        const systemFamily = systemFonts.get(this.systemFont.toLowerCase())?.family ?? "";
        let fontFamily = systemFamily;
        const uri = this.getUri();
        if (uri !== "") {
            fontFamily = this.fontRegistry.getFontFamily(uri) ?? fontFamily;
        }
        const fontId = `${fontFamily}-${this.getSize()}`;
        let drawFont = Font.DrawFontCache.get(fontId);
        if (!drawFont) {
            const maybeFont = this.fontRegistry.createFont(
                new BrsString(fontFamily),
                new Int32(this.getSize()),
                BrsBoolean.False,
                BrsBoolean.False
            );
            if (maybeFont instanceof RoFont) {
                drawFont = maybeFont;
            } else {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`warning,[sg.font.drawfont.fail] Failed to create RoFont for Font node ${this.name}.`);
                }
                return BrsInvalid.Instance;
            }
            Font.DrawFontCache.set(fontId, drawFont);
        }
        return drawFont;
    }
}

// Singleton map of System Fonts
interface FontsConfig {
    sceneGraph: {
        regular: string;
        bold: string;
    };
    systemFonts: {
        name: string;
        bold: boolean;
        fhd: number;
        hd: number;
    }[];
}
type FontDef = {
    family: string;
    fhd: number;
    hd: number;
};
const systemFonts: Map<string, FontDef> = new Map();

function initSystemFonts(fontRegistry: RoFontRegistry) {
    if (systemFonts.size > 0) {
        // Already initialized
        return;
    }
    // Load fonts from common file system
    const fsys = BrsDevice.fileSystem;
    const fontsJson = fsys.readFileSync("common:/fonts/system-fonts.json", "utf-8");
    const config: FontsConfig = JSON.parse(fontsJson);
    // Register SceneGraph system fonts
    const fontRegular = fontRegistry.registerFont(`common:/Fonts/${config.sceneGraph.regular}`, true);
    const fontBold = fontRegistry.registerFont(`common:/Fonts/${config.sceneGraph.bold}`, true);
    for (const font of config.systemFonts) {
        systemFonts.set(font.name.toLowerCase(), {
            family: font.bold ? fontBold : fontRegular,
            fhd: font.fhd,
            hd: font.hd,
        });
    }
}
