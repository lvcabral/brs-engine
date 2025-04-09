import { rootObjects, RoSGNode } from "../components/RoSGNode";
import { FieldKind, FieldModel } from "./Field";
import {
    BrsBoolean,
    BrsInvalid,
    BrsString,
    BrsType,
    getFontRegistry,
    Int32,
    RoFont,
    AAMember,
    isBrsString,
} from "..";

export type FontDef = {
    family: string;
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
        ["smallestsystemfont", { family: "Regular", fhd: 27, hd: 18 }],
        ["smallestboldsystemfont", { family: "SemiBold", fhd: 27, hd: 18 }],
        ["smallsystemfont", { family: "Regular", fhd: 33, hd: 22 }],
        ["smallboldsystemfont", { family: "SemiBold", fhd: 33, hd: 22 }],
        ["mediumsystemfont", { family: "Regular", fhd: 36, hd: 24 }],
        ["mediumboldsystemfont", { family: "SemiBold", fhd: 36, hd: 24 }],
        ["largesystemfont", { family: "Regular", fhd: 45, hd: 30 }],
        ["largeboldsystemfont", { family: "SemiBold", fhd: 45, hd: 30 }],
    ]);

    private readonly defaultSize: number;
    private readonly resolution: string;
    private systemFont: string;

    constructor(members: AAMember[] = [], readonly name: string = "Font") {
        super([], name);

        this.resolution = rootObjects.rootScene?.ui.resolution ?? "HD";
        this.defaultSize = this.resolution === "HD" ? 24 : 36;

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);

        this.fields.get("size")?.setValue(new Int32(this.defaultSize), false);
        this.systemFont = "MediumSystemFont";
    }
    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }

        const mapKey = index.getValue().toLowerCase();
        const field = this.fields.get(mapKey);

        if (field && mapKey === "uri" && isBrsString(value)) {
            const uri = value.getValue();
            getFontRegistry().registerFont(uri);
            field.setValue(value);
            this.fields.set(mapKey, field);
            return BrsInvalid.Instance;
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
        this.fields.get("size")?.setValue(new Int32(size));
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
        return fontRegistry.createFont(
            new BrsString(fontFamily),
            new Int32(this.getSize()),
            BrsBoolean.False,
            BrsBoolean.False
        ) as RoFont;
    }
}
