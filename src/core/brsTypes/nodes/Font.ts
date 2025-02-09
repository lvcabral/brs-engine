import { RoSGNode, FieldModel } from "../components/RoSGNode";
import { AAMember } from "../components/RoAssociativeArray";
import { BrsBoolean, BrsString, getFontRegistry, Int32, RoFont } from "..";
import { Interpreter } from "../../interpreter";

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

    private systemFont: string;

    constructor(members: AAMember[] = [], readonly name: string = "Font") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);

        this.systemFont = "MediumSystemFont";
    }

    getSize() {
        const size = this.fields.get("size")?.getValue();
        return size instanceof Int32 ? size.getValue() : 24;
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
            this.setSize(systemFont.hd); // TODO: get the correct size for the device
            return true;
        }
        return false;
    }

    createDrawFont(interpreter: Interpreter) {
        const fontRegistry = getFontRegistry(interpreter);
        const fontFamily = this.getSystemFontFamily(this.systemFont);
        const drawFont = fontRegistry.createFont(
            new BrsString(fontFamily),
            new Int32(this.getSize()),
            BrsBoolean.False,
            BrsBoolean.False
        ) as RoFont;
        return drawFont;
    }
}
