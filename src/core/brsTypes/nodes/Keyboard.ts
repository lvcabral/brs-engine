import { FieldKind, FieldModel } from "./Field";
import { Group } from "./Group";
import { AAMember } from "../components/RoAssociativeArray";
import { Interpreter } from "../../interpreter";
import { IfDraw2D, Rect } from "../interfaces/IfDraw2D";
import {
    BrsInvalid,
    BrsType,
    Float,
    Font,
    getTextureManager,
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
    private keyboardMode: KeyboardModes;
    private capsLock: boolean;
    private shift: boolean;
    private bmpBack?: RoBitmap;
    private keyColor: number;
    private focusedKeyColor: number;
    private readonly textEditX: number;
    private readonly iconLeftY: number;
    private readonly iconRightX: number;
    private readonly iconRightY: number;
    private readonly iconOffsetX: number;
    private readonly keyLeftX: number;
    private readonly keyRightX: number;
    private readonly keyBaseY: number;
    private readonly keyWidth: number;
    private readonly keyHeight: number;
    private readonly offsetX: number;
    private readonly offsetY: number;
    private readonly font: Font;
    private readonly backUriHD = "common:/images/keyboard_full_HD.png";
    private readonly backUriFHD = "common:/images/keyboard_full_FHD.png";
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
        // Setting up Child Nodes
        this.textEditBox = new TextEditBox();
        if (this.resolution === "FHD") {
            this.bmpBack = getTextureManager().loadTexture(this.backUriFHD);
            this.textEditBox.setFieldValue("width", new Float(1371));
            this.textEditX = 12;
            this.iconLeftY = 81;
            this.iconRightX = 1203;
            this.iconRightY = 99;
            this.iconOffsetX = 45;
            this.keyLeftX = 228;
            this.keyRightX = 897;
            this.keyBaseY = 96;
            this.keyWidth = 93;
            this.keyHeight = 81;
            this.offsetX = 90;
            this.offsetY = 84;
        } else {
            this.bmpBack = getTextureManager().loadTexture(this.backUriHD);
            this.textEditBox.setFieldValue("width", new Float(914));
            this.textEditX = 8;
            this.iconLeftY = 54;
            this.iconRightX = 802;
            this.iconRightY = 66;
            this.iconOffsetX = 30;
            this.keyLeftX = 152;
            this.keyRightX = 598;
            this.keyBaseY = 66;
            this.keyWidth = 62;
            this.keyHeight = 54;
            this.offsetX = 60;
            this.offsetY = 56;
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
        const isFocused = rootObjects.focused === this;
        const nodeTrans = this.getTranslation();
        const drawTrans = nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const rotation = angle + this.getRotation();
        opacity = opacity * this.getOpacity();
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };

        if (this.isDirty) {
            this.textEditBox.setTranslation([this.textEditX, 0]);
            this.keyColor = this.getFieldValueJS("keyColor") as number;
            this.focusedKeyColor = this.getFieldValueJS("focusedKeyColor") as number;
        }

        this.drawImage(this.bmpBack!, { ...rect, y: rect.y + this.iconLeftY }, 0, opacity, draw2D);
        this.renderLeftIcons(rect, opacity, isFocused, draw2D);
        this.keyFocus.key = "";
        const keysY = rect.y + this.keyBaseY;
        this.renderKeys(7, 0, rect.x + this.keyLeftX, keysY, opacity, isFocused, draw2D);
        this.renderKeys(3, 28, rect.x + this.keyRightX, keysY, opacity, isFocused, draw2D);
        this.renderRightIcons(rect, opacity, isFocused, draw2D);

        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.updateParentRects(origin, angle);
        this.isDirty = false;
    }

    private renderLeftIcons(rect: Rect, opacity: number, isFocused: boolean, draw2D?: IfDraw2D) {
        for (let i = 0; i < 5; i++) {
            const bmp = this.bmpIcons.get(this.icons[i]);
            if (bmp?.isValid()) {
                let keyFocused = this.keyFocus.col === 0 && this.keyFocus.row === i;
                let offX = 0;
                let offY = i * this.offsetY;
                if (i > 2) {
                    offX = i === 3 ? -this.iconOffsetX : this.iconOffsetX;
                    offY = 3 * this.offsetY;
                    keyFocused =
                        this.keyFocus.col === 0 &&
                        this.keyFocus.row === 3 &&
                        ((i === 3 && this.keyFocus.cursor === -1) ||
                            (i === 4 && this.keyFocus.cursor === 1));
                }
                const iconRect = {
                    x: rect.x + this.offsetX + offX,
                    y: rect.y + this.iconLeftY + bmp.height + offY,
                    width: bmp.width,
                    height: bmp.height,
                };
                const color = isFocused && keyFocused ? this.focusedKeyColor : this.keyColor;
                this.drawImage(bmp, iconRect, 0, opacity, draw2D, color);
            }
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
                let color = this.keyColor;
                if (isFocused && this.keyFocus.col === col && this.keyFocus.row === r) {
                    color = this.focusedKeyColor;
                    this.keyFocus.key = key;
                }
                if (key.length) {
                    const buttonRect = {
                        x: x + c * this.offsetX,
                        y: y + r * this.offsetY,
                        width: this.keyWidth,
                        height: this.keyHeight,
                    };
                    this.drawText(
                        key,
                        this.font,
                        color,
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
    }

    private renderRightIcons(rect: Rect, opacity: number, isFocused: boolean, draw2D?: IfDraw2D) {
        const mode = this.keyboardMode;
        for (let r = 0; r < 4; r++) {
            let icon = "";
            if (r === 0) {
                icon = this.capsLock ? "caps_on" : "caps_off";
            } else if (r === 1) {
                icon = mode === KeyboardModes.ALPHANUMERIC ? "alphanum_on" : "alphanum_off";
            } else if (r === 2) {
                icon = mode === KeyboardModes.SYMBOLS ? "symbols_on" : "symbols_off";
            } else if (r === 3) {
                icon = mode === KeyboardModes.ACCENTED ? "accent_on" : "accent_off";
            }
            const bmp = this.bmpIcons.get(icon);
            if (bmp?.isValid()) {
                let color = this.keyColor;
                if (isFocused && this.keyFocus.col === 11 && this.keyFocus.row === r) {
                    color = this.focusedKeyColor;
                }
                let offY = r * this.offsetY;
                const iconRect = {
                    x: rect.x + this.iconRightX,
                    y: rect.y + this.iconRightY + offY,
                    width: bmp.width,
                    height: bmp.height,
                };
                this.drawImage(bmp, iconRect, 0, opacity, draw2D, color);
            }
        }
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
