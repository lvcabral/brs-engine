import { FieldKind, FieldModel } from "./Field";
import { Group } from "./Group";
import { AAMember } from "../components/RoAssociativeArray";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import {
    BrsInvalid,
    BrsType,
    Float,
    Font,
    getTextureManager,
    isBrsString,
    RoBitmap,
    TextEditBox,
} from "..";

enum KeyboardModes {
    ALPHA_LOW,
    ALPHA_UP,
    SYMBOLS_LOW,
    SYMBOLS_UP,
    ACCENTED_LOW,
    ACCENTED_UP,
}

export class Keyboard extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "text", type: "string", value: "" },
        { name: "keyColor", type: "color", value: "0xFFFFFFFF" },
        { name: "focusable", type: "boolean", value: "true" },
        { name: "focusedKeyColor", type: "color", value: "0x000000FF" },
        { name: "keyboardBitmapUri", type: "uri", value: "" },
        { name: "focusBitmapUri", type: "uri", value: "" },
        { name: "textEditBox", type: "node" },
        { name: "showTextEditBox", type: "boolean", value: "true" },
    ];

    private keyboardMode: KeyboardModes;
    private capsLock: boolean;
    private shiftState: boolean;
    private bmpBack?: RoBitmap;
    private keyColor: number;
    private focusedKeyColor: number;
    private textEditBox: TextEditBox;
    private gapX: number;
    private gapY: number;
    private iconBaseX: number;
    private iconOffsetX: number;
    private iconOffsetY: number;
    private keyBaseX: number;
    private keyBaseY: number;
    private keyOffsetX: number;
    private keyOffsetY: number;
    private readonly font: Font;
    private readonly backUriHD = "common:/images/keyboard_full_HD.png";
    private readonly backUriFHD = "common:/images/keyboard_full_FHD.png";
    private readonly icons = ["shift", "space", "delete", "moveCursorLeft", "moveCursorRight"];
    private readonly buttons: Map<KeyboardModes, string[]> = new Map();
    private readonly bmpIcons: Map<string, RoBitmap> = new Map();

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Keyboard") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.font = new Font();

        this.keyboardMode = KeyboardModes.ALPHA_LOW;
        this.capsLock = false;
        this.shiftState = false;
        this.setupKeyboardModes();
        // Setting up Child Nodes
        this.textEditBox = new TextEditBox();
        if (this.resolution === "FHD") {
            this.bmpBack = getTextureManager().loadTexture(this.backUriFHD);
            this.textEditBox.setFieldValue("width", new Float(1371));
            this.gapX = 12;
            this.gapY = 81;
            this.iconBaseX = 354;
            this.iconOffsetX = 45;
            this.iconOffsetY = 84;
            this.keyBaseX = 492;
            this.keyBaseY = 15;
            this.keyOffsetX = 90;
            this.keyOffsetY = 84;
        } else {
            this.bmpBack = getTextureManager().loadTexture(this.backUriHD);
            this.textEditBox.setFieldValue("width", new Float(914));
            this.gapX = 8;
            this.gapY = 54;
            this.iconBaseX = 236;
            this.iconOffsetX = 30;
            this.iconOffsetY = 56;
            this.keyBaseX = 328;
            this.keyBaseY = 10;
            this.keyOffsetX = 60;
            this.keyOffsetY = 56;
        }
        this.icons.forEach((icon) => {
            const uri = `common:/images/icon_${icon}_${this.resolution}.png`;
            const bmp = getTextureManager().loadTexture(uri);
            if (bmp?.isValid()) {
                this.bmpIcons.set(icon, bmp);
            }
        });
        this.keyColor = this.getFieldValueJS("keyColor") as number;
        this.focusedKeyColor = this.getFieldValueJS("focusedKeyColor") as number;
        this.setFieldValue("textEditBox", this.textEditBox);
        this.linkField(this.textEditBox, "text");
        this.appendChildToParent(this.textEditBox);
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.getValue().toLowerCase();
        if ("texteditbox" === fieldName) {
            // Read-only field
            return BrsInvalid.Instance;
        }
        return super.set(index, value, alwaysNotify, kind);
    }

    handleKey(key: string, press: boolean): boolean {
        let handled = false;
        if (!press) {
            return handled;
        }
        if (key === "left" || key === "right") {
            // cycle  keyboardMode
            this.keyboardMode += key === "left" ? -1 : 1;
            if (this.keyboardMode > KeyboardModes.ACCENTED_UP) {
                this.keyboardMode = KeyboardModes.ALPHA_LOW;
            } else if (this.keyboardMode < KeyboardModes.ALPHA_LOW) {
                this.keyboardMode = KeyboardModes.ACCENTED_UP;
            }
            this.isDirty = true;
            handled = true;
        }
        return handled;
    }

    renderNode(
        interpreter: Interpreter,
        origin: number[],
        angle: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        if (!this.isVisible()) {
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const rotation = angle + this.getRotation();
        opacity = opacity * this.getOpacity();
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };
        if (this.isDirty) {
            this.textEditBox.setTranslation([this.gapX, 0]);
        }
        if (this.bmpBack?.isValid()) {
            this.drawImage(this.bmpBack, { ...rect, y: rect.y + this.gapY }, 0, opacity, draw2D);
        }
        for (let i = 0; i < this.icons.length; i++) {
            const bmp = this.bmpIcons.get(this.icons[i]);
            if (bmp?.isValid()) {
                let offX = 0;
                let offY = i * this.iconOffsetY;
                if (i > 2) {
                    offX = i == 3 ? -this.iconOffsetX : this.iconOffsetX;
                    offY = 3 * this.iconOffsetY;
                }
                const iconRect = {
                    x: this.iconBaseX + offX,
                    y: rect.y + this.gapY + bmp.height + offY,
                    width: bmp.width,
                    height: bmp.height,
                };
                this.drawImage(bmp, iconRect, 0, opacity, draw2D);
            }
        }
        // Middle Keys
        const buttons = this.buttons.get(this.keyboardMode);
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 7; c++) {
                const index = r * 7 + c;
                const button = buttons![index];
                if (button) {
                    const buttonRect = {
                        x: this.keyBaseX + c * this.keyOffsetX,
                        y: rect.y + this.keyBaseY + this.gapY + r * this.keyOffsetY,
                        width: 92,
                        height: 81,
                    };
                    this.drawText(
                        button,
                        this.font,
                        this.keyColor,
                        opacity,
                        buttonRect,
                        "center",
                        "center",
                        0,
                        draw2D,
                        "",
                        index
                    );
                }
            }
        }
        // Right Keys
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 3; c++) {
                const index = 28 + r * 3 + c;
                const button = buttons![index];
                if (button) {
                    const buttonRect = {
                        x: 1161 + c * this.keyOffsetX,
                        y: rect.y + this.keyBaseY + this.gapY + r * this.keyOffsetY,
                        width: 92,
                        height: 81,
                    };
                    this.drawText(
                        button,
                        this.font,
                        this.keyColor,
                        opacity,
                        buttonRect,
                        "center",
                        "center",
                        0,
                        draw2D,
                        "",
                        index
                    );
                }
            }
        }
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.updateParentRects(origin, angle);
        this.isDirty = false;
    }

    private setupKeyboardModes() {
        // Alpha Numeric Lower Case
        this.buttons.set(KeyboardModes.ALPHA_LOW, []);
        for (let i = 97; i <= 122; i++) {
            this.buttons.get(KeyboardModes.ALPHA_LOW)?.push(String.fromCharCode(i));
        }
        this.buttons.get(KeyboardModes.ALPHA_LOW)?.push(...["-", "_"]);
        for (let i = 49; i <= 57; i++) {
            this.buttons.get(KeyboardModes.ALPHA_LOW)?.push(String.fromCharCode(i));
        }
        this.buttons.get(KeyboardModes.ALPHA_LOW)?.push(...["@", ".", "0"]);
        // Alpha Numeric Upper Case
        this.buttons.set(KeyboardModes.ALPHA_UP, []);
        for (let i = 65; i <= 90; i++) {
            this.buttons.get(KeyboardModes.ALPHA_UP)?.push(String.fromCharCode(i));
        }
        this.buttons.get(KeyboardModes.ALPHA_UP)?.push(...["-", "_"]);
        for (let i = 49; i <= 57; i++) {
            this.buttons.get(KeyboardModes.ALPHA_UP)?.push(String.fromCharCode(i));
        }
        this.buttons.get(KeyboardModes.ALPHA_UP)?.push(...["@", ".", "0"]);
        // Symbols Lower Case
        this.buttons.set(KeyboardModes.SYMBOLS_LOW, [
            "!",
            "?",
            "*",
            "#",
            "$",
            "%",
            "^",
            "&",
            ",",
            ":",
            ";",
            "`",
            "'",
            `"`,
            "(",
            ")",
            "{",
            "}",
            "[",
            "]",
            "~",
            "¡",
            "¿",
            "<",
            ">",
            "|",
            "\\",
            "/",
            "´",
            "ˆ",
            "˜",
            "¨",
            "¯",
            "¸",
            "=",
            "+",
            "×",
            "÷",
            "±",
            "‰",
        ]);
        // Symbols Upper Case
        this.buttons.set(KeyboardModes.SYMBOLS_UP, [
            "•",
            "·",
            "¢",
            "£",
            "¥",
            "€",
            "§",
            "®",
            "©",
            "™",
            "«",
            "»",
            "‹",
            "›",
            "†",
            "‡",
            "ƒ",
            "¶",
            "¹",
            "²",
            "³",
            "º",
            "°",
            "ª",
            "…",
            "",
            "",
            "",
            "¼",
            "½",
            "¾",
            "“",
            "”",
            "„",
            "‘",
            "’",
            "‚",
            "–",
            "—",
        ]);
        // Accented Lower Case
        this.buttons.set(KeyboardModes.ACCENTED_LOW, [
            "à",
            "á",
            "â",
            "ã",
            "ä",
            "å",
            "æ",
            "è",
            "é",
            "ê",
            "ë",
            "ì",
            "í",
            "î",
            "ï",
            "ò",
            "ó",
            "ô",
            "õ",
            "ö",
            "ø",
            "œ",
            "ù",
            "ú",
            "û",
            "ü",
            "ç",
            "ñ",
            "ý",
            "ÿ",
            "š",
            "ž",
            "ð",
            "þ",
            "ß",
            "",
            "",
            "",
            "",
            "",
        ]);
        // Accented Upper Case
        this.buttons.set(KeyboardModes.ACCENTED_UP, [
            "À",
            "Á",
            "Â",
            "Ã",
            "Ä",
            "Å",
            "Æ",
            "È",
            "É",
            "Ê",
            "Ë",
            "Ì",
            "Í",
            "Î",
            "Ï",
            "Ò",
            "Ó",
            "Ô",
            "Õ",
            "Ö",
            "Ø",
            "Œ",
            "Ù",
            "Ú",
            "Û",
            "Ü",
            "Ç",
            "Ñ",
            "Ý",
            "Ÿ",
            "Š",
            "Ž",
            "Ð",
            "Þ",
            "",
            "",
            "",
            "",
            "",
            "",
        ]);
    }
}
