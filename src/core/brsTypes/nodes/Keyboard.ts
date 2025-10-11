import { FieldKind, FieldModel } from "./Field";
import { Group } from "./Group";
import { AAMember } from "../components/RoAssociativeArray";
import { Interpreter } from "../../interpreter";
import { IfDraw2D, Rect } from "../interfaces/IfDraw2D";
import {
    BrsBoolean,
    BrsInvalid,
    BrsType,
    Float,
    Font,
    Int32,
    isBrsString,
    RoBitmap,
    rootObjects,
    TextEditBox,
} from "..";

enum KeyboardModes {
    ALPHANUMERIC,
    SYMBOLS,
    ACCENTED,
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

    readonly textEditBox: TextEditBox;
    private showTextEdit: boolean;
    private keyboardMode: KeyboardModes;
    private capsLock: boolean;
    private shift: boolean;
    private keyColor: number;
    private focusedKeyColor: number;
    private bmpBack?: RoBitmap;
    private bmpFocus?: RoBitmap;
    private readonly textEditX: number;
    private readonly iconOffsetY: number;
    private readonly iconRightX: number;
    private readonly iconOffsetX: number;
    private readonly keyLeftX: number;
    private readonly keyRightX: number;
    private readonly keyBaseY: number;
    private readonly keyWidth: number;
    private readonly keyHeight: number;
    private readonly keyFocusDelta: number;
    private readonly widthOver: number;
    private readonly heightOver: number;
    private readonly offsetX: number;
    private readonly offsetY: number;
    private readonly font: Font;
    private readonly icons = [
        "shift",
        "space",
        "delete",
        "moveCursorLeft",
        "moveCursorRight",
        "caps_on",
        "caps_off",
        "alphanum_on",
        "alphanum_off",
        "symbols_on",
        "symbols_off",
        "accent_on",
        "accent_off",
    ];
    private readonly buttons: Map<string, string[]> = new Map();
    private readonly bmpIcons: Map<string, RoBitmap> = new Map();
    private readonly keyFocus = { row: 0, col: 0, key: "", cursor: -1 };

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Keyboard") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.font = new Font();

        this.keyboardMode = KeyboardModes.ALPHANUMERIC;
        this.capsLock = false;
        this.shift = false;
        this.setupKeyboardModes();
        this.textEditBox = new TextEditBox();
        this.showTextEdit = true;
        if (this.resolution === "FHD") {
            this.textEditBox.setFieldValue("width", new Float(1371));
            this.textEditX = 12;
            this.iconRightX = 1203;
            this.iconOffsetX = 45;
            this.iconOffsetY = 81;
            this.keyLeftX = 228;
            this.keyRightX = 897;
            this.keyBaseY = 18;
            this.keyWidth = 93;
            this.keyHeight = 81;
            this.keyFocusDelta = 15;
            this.offsetX = 90;
            this.offsetY = 84;
            this.widthOver = 21;
            this.heightOver = 90;
        } else {
            this.textEditBox.setFieldValue("width", new Float(914));
            this.textEditX = 8;
            this.iconRightX = 802;
            this.iconOffsetX = 30;
            this.iconOffsetY = 54;
            this.keyLeftX = 152;
            this.keyRightX = 598;
            this.keyBaseY = 12;
            this.keyWidth = 62;
            this.keyHeight = 54;
            this.keyFocusDelta = 10;
            this.offsetX = 60;
            this.offsetY = 56;
            this.widthOver = 12;
            this.heightOver = 60;
        }
        this.textEditBox.setTranslation([this.textEditX, 0]);
        this.textEditBox.setFieldValue("maxTextLength", new Int32(75));
        this.bmpBack = this.loadBitmap(`common:/images/${this.resolution}/keyboard_full.png`);
        this.setFieldValue("width", new Float(this.bmpBack!.width + this.widthOver));
        this.setFieldValue("height", new Float(this.bmpBack!.height + this.heightOver));

        this.bmpFocus = this.loadBitmap("common:/images/focus_keyboard.9.png");
        for (const icon of this.icons) {
            const uri = `common:/images/${this.resolution}/icon_${icon}.png`;
            const bmp = this.loadBitmap(uri);
            if (bmp?.isValid()) {
                this.bmpIcons.set(icon, bmp);
            }
        }
        this.keyColor = this.getFieldValueJS("keyColor") as number;
        this.focusedKeyColor = this.getFieldValueJS("focusedKeyColor") as number;
        this.setFieldValue("textEditBox", this.textEditBox);
        this.linkField(this.textEditBox, "text");
        this.appendChildToParent(this.textEditBox);
    }

    handleKey(key: string, press: boolean): boolean {
        let handled = false;
        if (!press) {
            return handled;
        }
        if (key === "left" || key === "right") {
            handled = this.handleLeftRight(key);
        } else if (key === "up" || key === "down") {
            handled = this.handleUpDown(key);
        } else if (key === "OK") {
            handled = this.handleOK();
        } else if (key.startsWith("Lit_") || key === "replay") {
            handled = this.textEditBox.handleKey(key, press);
        } else if (key === "options") {
            this.capsLock = !this.capsLock;
            this.isDirty = true;
            handled = true;
        }
        return handled;
    }

    private handleLeftRight(key: string) {
        this.isDirty = true;
        let handled = true;
        if (this.keyFocus.col === 0 && this.keyFocus.row === 3) {
            if (key === "left" && this.keyFocus.cursor === 1) {
                this.keyFocus.cursor = -1;
                return handled;
            } else if (key === "right" && this.keyFocus.cursor === -1) {
                this.keyFocus.cursor = 1;
                return handled;
            }
        } else if (this.keyFocus.col === 1 && this.keyFocus.row === 3 && key === "left") {
            this.keyFocus.cursor = 1;
        } else if (this.keyFocus.col === 11 && this.keyFocus.row === 3 && key === "right") {
            this.keyFocus.cursor = -1;
        }
        this.keyFocus.col += key === "left" ? -1 : 1;
        if (this.keyFocus.col > 11) {
            this.keyFocus.col = 0;
        } else if (this.keyFocus.col < 0) {
            this.keyFocus.col = 11;
        }
        return handled;
    }

    private handleUpDown(key: string) {
        let handled = false;
        if (key === "up" && this.keyFocus.row > 0) {
            this.keyFocus.row--;
            this.isDirty = true;
            handled = true;
        } else if (key === "down" && this.keyFocus.row < 3) {
            this.keyFocus.row++;
            this.isDirty = true;
            handled = true;
        }
        return handled;
    }

    private handleOK() {
        let handled = true;
        if (this.keyFocus.col === 0) {
            if (this.keyFocus.row === 0) {
                this.shift = !this.shift;
            } else if (this.keyFocus.row === 1) {
                this.textEditBox.handleKey("Lit_ ", true);
                this.shift = false;
            } else if (this.keyFocus.row === 2) {
                this.textEditBox.handleKey("replay", true);
                this.shift = false;
            } else {
                this.textEditBox.moveCursor(this.keyFocus.cursor);
                this.shift = false;
            }
        } else if (this.keyFocus.col === 11) {
            if (this.keyFocus.row === 0) {
                this.capsLock = !this.capsLock;
            } else {
                this.keyboardMode = this.keyFocus.row - 1;
            }
            this.shift = false;
        } else if (this.keyFocus.col > 0 && this.keyFocus.col < 11) {
            if (this.keyFocus.key.length) {
                this.textEditBox.handleKey(`Lit_${this.keyFocus.key}`, true);
            }
            this.shift = false;
        }
        this.isDirty = handled;
        return handled;
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const isFocused = rootObjects.focused === this;
        this.textEditBox.setActive(isFocused);
        const nodeTrans = this.getTranslation();
        const drawTrans = nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const rotation = angle + this.getRotation();
        opacity = opacity * this.getOpacity();
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };

        if (this.isDirty) {
            this.keyColor = this.getFieldValueJS("keyColor") as number;
            this.focusedKeyColor = this.getFieldValueJS("focusedKeyColor") as number;
            this.showTextEdit = this.getFieldValueJS("showTextEditBox") as boolean;
            this.textEditBox.setFieldValue("visible", BrsBoolean.from(this.showTextEdit));
            this.setFieldValue("height", new Float(rect.height));
            // Background Image
            const backgroundUri = this.getFieldValueJS("keyboardBitmapUri") as string;
            if (backgroundUri && this.bmpBack?.getImageName() !== backgroundUri) {
                this.bmpBack = this.getBitmap("keyboardBitmapUri");
            }
            // Focus Image
            const focusUri = this.getFieldValueJS("focusBitmapUri") as string;
            if (focusUri && this.bmpFocus?.getImageName() !== focusUri) {
                this.bmpFocus = this.getBitmap("focusBitmapUri");
            }
        }
        rect.height = this.showTextEdit ? this.bmpBack!.height + this.heightOver : this.bmpBack!.height;
        const topY = rect.y + (this.showTextEdit ? this.iconOffsetY : 0);
        const backRect = { x: rect.x, y: topY, width: 0, height: 0 };
        this.drawImage(this.bmpBack!, backRect, 0, opacity, draw2D);
        this.renderLeftIcons(rect, opacity, isFocused, draw2D);
        this.keyFocus.key = "";
        this.renderKeys(7, 0, rect.x + this.keyLeftX, topY + this.keyBaseY, opacity, isFocused, draw2D);
        this.renderKeys(3, 28, rect.x + this.keyRightX, topY + this.keyBaseY, opacity, isFocused, draw2D);
        this.renderRightIcons(rect, opacity, isFocused, draw2D);

        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.updateParentRects(origin, angle);
        this.isDirty = false;
    }

    private renderLeftIcons(rect: Rect, opacity: number, isFocused: boolean, draw2D?: IfDraw2D) {
        for (let i = 0; i < 5; i++) {
            const bmp = this.bmpIcons.get(this.icons[i]);
            if (!bmp?.isValid()) {
                continue;
            }
            let keyFocused = isFocused && this.keyFocus.col === 0 && this.keyFocus.row === i;
            let offX = this.offsetX;
            if (i > 2) {
                keyFocused =
                    isFocused &&
                    this.keyFocus.col === 0 &&
                    this.keyFocus.row === 3 &&
                    ((i === 3 && this.keyFocus.cursor === -1) || (i === 4 && this.keyFocus.cursor === 1));
                offX += i === 3 ? -this.iconOffsetX : this.iconOffsetX;
            }
            const offY = i <= 3 ? i * this.offsetY : 3 * this.offsetY;
            let color = this.keyColor;
            if (keyFocused) {
                color = this.focusedKeyColor;
                this.renderFocus(rect, i, offY, opacity, draw2D);
            }
            this.renderIcon(rect, bmp, offX, offY + bmp.height, color, opacity, draw2D);
        }
    }

    private renderKeys(
        cols: number,
        start: number,
        x: number,
        y: number,
        opacity: number,
        isFocused: boolean,
        draw2D?: IfDraw2D
    ) {
        const buttonsId = `${this.keyboardMode}${this.capsLock || this.shift ? "U" : "L"}`;
        const buttons = this.buttons.get(buttonsId);
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < cols; c++) {
                const index = start + r * cols + c;
                const col = cols === 7 ? c + 1 : c + 8;
                const key = buttons![index] ?? "";
                const buttonRect = {
                    x: x + c * this.offsetX,
                    y: y + r * this.offsetY,
                    width: this.keyWidth,
                    height: this.keyHeight,
                };
                let color = this.keyColor;
                if (isFocused && this.keyFocus.col === col && this.keyFocus.row === r) {
                    color = this.focusedKeyColor;
                    this.keyFocus.key = key;
                    const focusRect = {
                        x: buttonRect.x - this.keyFocusDelta,
                        y: buttonRect.y - this.keyFocusDelta,
                        width: buttonRect.width + 2 * this.keyFocusDelta,
                        height: buttonRect.height + 2 * this.keyFocusDelta,
                    };
                    this.drawImage(this.bmpFocus!, focusRect, 0, opacity, draw2D);
                }
                if (key.length) {
                    this.drawText(key, this.font, color, opacity, buttonRect, "center", "center", 0, draw2D, "", index);
                }
            }
        }
    }

    private renderRightIcons(rect: Rect, opacity: number, isFocused: boolean, draw2D?: IfDraw2D) {
        for (let r = 0; r < 4; r++) {
            const icon = this.getRightIcon(r);
            const bmp = this.bmpIcons.get(icon);
            if (!bmp?.isValid()) {
                continue;
            }
            let offY = this.keyBaseY + r * this.offsetY;
            const topY = rect.y + (this.showTextEdit ? this.iconOffsetY : 0);
            let color = this.keyColor;
            if (isFocused && this.keyFocus.col === 11 && this.keyFocus.row === r) {
                color = this.focusedKeyColor;
                const focusRect = {
                    x: rect.x + this.iconRightX - this.keyFocusDelta,
                    y: topY + offY - this.keyFocusDelta,
                    width: 2 * this.keyWidth + 2 * this.keyFocusDelta,
                    height: this.keyHeight + 2 * this.keyFocusDelta,
                };
                this.drawImage(this.bmpFocus!, focusRect, 0, opacity, draw2D);
            }
            this.renderIcon(rect, bmp, this.iconRightX, offY, color, opacity, draw2D);
        }
    }

    private renderFocus(rect: Rect, row: number, offY: number, opacity: number, draw2D?: IfDraw2D) {
        const topY = rect.y + (this.showTextEdit ? this.iconOffsetY : 0);
        const width = row < 3 ? 2 * this.keyWidth : this.keyWidth;
        const focusRect = {
            x: row < 4 ? rect.x : rect.x + this.offsetX,
            y: topY + offY,
            width: width + 2 * this.keyFocusDelta,
            height: this.keyHeight + 2 * this.keyFocusDelta,
        };
        this.drawImage(this.bmpFocus!, focusRect, 0, opacity, draw2D);
    }

    private renderIcon(
        rect: Rect,
        bmp: RoBitmap,
        offX: number,
        offY: number,
        color: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        const topY = rect.y + (this.showTextEdit ? this.iconOffsetY : 0);
        const iconRect = {
            x: rect.x + offX,
            y: topY + offY,
            width: bmp.width,
            height: bmp.height,
        };
        this.drawImage(bmp, iconRect, 0, opacity, draw2D, color);
    }

    private getRightIcon(row: number) {
        let icon = "";
        const mode = this.keyboardMode;
        if (row === 0) {
            icon = this.capsLock ? "caps_on" : "caps_off";
        } else if (row === 1) {
            icon = mode === KeyboardModes.ALPHANUMERIC ? "alphanum_on" : "alphanum_off";
        } else if (row === 2) {
            icon = mode === KeyboardModes.SYMBOLS ? "symbols_on" : "symbols_off";
        } else if (row === 3) {
            icon = mode === KeyboardModes.ACCENTED ? "accent_on" : "accent_off";
        }
        return icon;
    }

    private setupKeyboardModes() {
        this.buttons.set("0L", "abcdefghijklmnopqrstuvwxyz-_123456789@.0".split(""));
        this.buttons.set("0U", "ABCDEFGHIJKLMNOPQRSTUVWXYZ-_123456789@.0".split(""));
        this.buttons.set("1L", '!?*#$%^&,:;"(){}[]~¡¿<>|\\/´ˆ˜¨¯¸=+×÷±‰'.split(""));
        this.buttons.set("1U", "•·¢£¥€§®©™«»‹›†‡ƒ¶¹²³º°ª…¼½¾“”„‘’‚–—".split(""));
        this.buttons.set("2L", "àáâãäåæèéêëìíîïòóôõöøœùúûüçñýÿšžðþß".split(""));
        this.buttons.set("2U", "ÀÁÂÃÄÅÆÈÉÊËÌÍÎÏÒÓÔÕÖØŒÙÚÛÜÇÑÝŸŠŽÐÞ".split(""));
    }
}
