import { RoSGNode, FieldModel } from "../components/RoSGNode";
import { AAMember } from "../components/RoAssociativeArray";
import { Int32 } from "..";

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
    readonly defaultFamily = "Open Sans";
    static readonly SystemFonts: Map<string, FontDef> = new Map([
        ["smallestsystemfont", { family: "Open Sans", fhd: 27, hd: 18 }],
        ["smallestboldsystemfont", { family: "Open Sans SemiBold", fhd: 27, hd: 18 }],
        ["smallsystemfont", { family: "Open Sans", fhd: 33, hd: 22 }],
        ["smallboldsystemfont", { family: "Open Sans SemiBold", fhd: 33, hd: 22 }],
        ["mediumsystemfont", { family: "Open Sans", fhd: 36, hd: 24 }],
        ["mediumboldsystemfont", { family: "Open Sans SemiBold", fhd: 36, hd: 24 }],
        ["largesystemfont", { family: "Open Sans", fhd: 45, hd: 30 }],
        ["largeboldsystemfont", { family: "Open Sans SemiBold", fhd: 45, hd: 30 }],
    ]);

    fontFamily: string;

    constructor(members: AAMember[] = [], readonly name: string = "Font") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);

        this.fontFamily = this.getSystemFontFamily("MediumSystemFont");
    }

    getSize() {
        const size = this.fields.get("size")?.getValue();
        return size instanceof Int32 ? size.getValue() : 24;
    }

    setSize(size: number) {
        this.fields.get("size")?.setValue(new Int32(size));
    }

    getSystemFontFamily(font: string) {
        return Font.SystemFonts.get(font.toLowerCase())?.family || this.defaultFamily;
    }

    setSystemFont(font: string) {
        const systemFont = Font.SystemFonts.get(font.toLowerCase());
        if (systemFont) {
            this.fontFamily = systemFont.family;
            this.setSize(systemFont.hd); // TODO: get the correct size for the device
        }
    }
}
