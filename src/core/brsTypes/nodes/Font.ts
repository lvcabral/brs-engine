import {
    AAMember,
    BrsBoolean,
    BrsString,
    BrsType,
    getFontRegistry,
    Int32,
    isBrsString,
    Node,
    RoFont,
    RoFontRegistry,
    sgRoot,
} from "..";
import { FieldKind, FieldModel } from "./Field";

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

        this.setFieldValue("size", new Int32(this.defaultSize));
        this.systemFont = "MediumSystemFont";
        this.fontRegistry = getFontRegistry();
    }

    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "uri" && isBrsString(value)) {
            getFontRegistry().registerFont(value.getValue(), true);
        }
        super.setValue(index, value, alwaysNotify, kind);
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

    setSystemFont(font: string) {
        const systemFont = this.fontRegistry.getSystemFont(font);
        if (systemFont) {
            this.systemFont = font;
            this.setSize(this.resolution === "HD" ? systemFont.hd : systemFont.fhd);
            return true;
        }
        return false;
    }

    createDrawFont() {
        let fontFamily = this.fontRegistry.getSystemFont(this.systemFont)?.family ?? "";
        const uri = this.getUri();
        if (uri !== "") {
            fontFamily = this.fontRegistry.getFontFamily(uri) ?? fontFamily;
        }
        const fontId = `${fontFamily}-${this.getSize()}`;
        let drawFont = Font.DrawFontCache.get(fontId);
        if (!drawFont) {
            drawFont = this.fontRegistry.createFont(
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
