import { RoSGNode } from "../components/RoSGNode";
import { FieldKind, FieldModel } from "./Field";
import { BrsBoolean, rootObjects, BrsString, BrsType, getFontRegistry, Int32, RoFont, AAMember, isBrsString } from "..";

export type FontDef = {
    family: string;
    bold: boolean;
    fhd: number;
    hd: number;
};
export class Font extends RoSGNode {
    readonly defaultFields: FieldModel[] = [
        { name: "uri", type: "uri" },
        { name: "size", type: "integer", value: "24" },
        { name: "fallbackGlyph", type: "string" },
    ];

    /**
     * Valid System Fonts
     */
    static readonly SystemFonts: Map<string, FontDef> = new Map([
        ["BadgeSystemFont".toLowerCase(), { family: "", bold: true, fhd: 21, hd: 14 }],
        ["TinySystemFont".toLowerCase(), { family: "", bold: false, fhd: 24, hd: 16 }],
        ["TinyBoldSystemFont".toLowerCase(), { family: "", bold: true, fhd: 24, hd: 16 }],
        ["SmallestSystemFont".toLowerCase(), { family: "", bold: false, fhd: 27, hd: 18 }],
        ["SmallestBoldSystemFont".toLowerCase(), { family: "", bold: true, fhd: 27, hd: 18 }],
        ["SmallerSystemFont".toLowerCase(), { family: "", bold: false, fhd: 30, hd: 20 }],
        ["SmallerBoldSystemFont".toLowerCase(), { family: "", bold: true, fhd: 30, hd: 20 }],
        ["SmallSystemFont".toLowerCase(), { family: "", bold: false, fhd: 33, hd: 22 }],
        ["SmallBoldSystemFont".toLowerCase(), { family: "", bold: true, fhd: 33, hd: 22 }],
        ["MediumSystemFont".toLowerCase(), { family: "", bold: false, fhd: 36, hd: 24 }],
        ["MediumBoldSystemFont".toLowerCase(), { family: "", bold: true, fhd: 36, hd: 24 }],
        ["LargeSystemFont".toLowerCase(), { family: "", bold: false, fhd: 45, hd: 30 }],
        ["LargeBoldSystemFont".toLowerCase(), { family: "", bold: true, fhd: 45, hd: 30 }],
        ["ExtraLargeSystemFont".toLowerCase(), { family: "", bold: false, fhd: 54, hd: 36 }],
        ["ExtraLargeBoldSystemFont".toLowerCase(), { family: "", bold: true, fhd: 54, hd: 36 }],
        ["LargestSystemFont".toLowerCase(), { family: "", bold: false, fhd: 90, hd: 60 }],
    ]);

    static readonly DrawFontCache: Map<string, RoFont> = new Map();

    private readonly defaultSize: number;
    private readonly resolution: string;
    private systemFont: string;

    constructor(members: AAMember[] = [], readonly name: string = "Font") {
        super([], name);

        this.resolution = rootObjects.rootScene?.ui.resolution ?? "HD";
        this.defaultSize = this.resolution === "HD" ? 24 : 36;

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);

        this.setFieldValue("size", new Int32(this.defaultSize));
        this.systemFont = "MediumSystemFont";
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }

        const fieldName = index.getValue().toLowerCase();
        if (fieldName === "uri" && isBrsString(value)) {
            getFontRegistry().registerFont(value.getValue(), true);
        }
        return super.set(index, value, alwaysNotify, kind);
    }

    getUri() {
        return (this.getFieldValueJS("uri") as string) ?? "";
    }

    getSize() {
        return (this.getFieldValueJS("size") as number) ?? this.defaultSize;
    }

    setSize(size: number) {
        this.setFieldValue("size", new Int32(size));
    }

    getSystemFontFamily(font: string) {
        return Font.SystemFonts.get(font.toLowerCase())?.family ?? "";
    }

    setSystemFont(font: string) {
        const systemFont = Font.SystemFonts.get(font.toLowerCase());
        if (systemFont) {
            this.systemFont = font;
            this.setSize(this.resolution === "HD" ? systemFont.hd : systemFont.fhd);
            return true;
        }
        return false;
    }

    createDrawFont() {
        let fontFamily = this.getSystemFontFamily(this.systemFont);
        const fontRegistry = getFontRegistry();
        const uri = this.getUri();
        if (uri !== "") {
            fontFamily = fontRegistry.getFontFamily(uri) ?? fontFamily;
        }
        const fontId = `${fontFamily}-${this.getSize()}`;
        let drawFont = Font.DrawFontCache.get(fontId);
        if (!drawFont) {
            drawFont = fontRegistry.createFont(
                new BrsString(fontFamily),
                new Int32(this.getSize()),
                BrsBoolean.False,
                BrsBoolean.False
            ) as RoFont;
            Font.DrawFontCache.set(fontId, drawFont);
        }
        return drawFont;
    }
}
