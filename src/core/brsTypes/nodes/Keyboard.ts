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
    private textEditX: number;
    private iconLeftX: number;
    private iconRightX: number;
    private iconBaseY: number;
    private iconOffsetX: number;
    private iconOffsetY: number;
    private iconGapX: number;
    private keyLeftX: number;
    private keyRightX: number;
    private keyBaseY: number;
    private keyWidth: number;
    private keyHeight: number;
    private keyOffsetX: number;
    private keyOffsetY: number;
    private readonly font: Font;
    private readonly backUriHD = "common:/images/keyboard_full_HD.png";
    private readonly backUriFHD = "common:/images/keyboard_full_FHD.png";
    private readonly icons = [
        "shift",
        "space",
        "delete",
        "moveCursorLeft",
        "moveCursorRight",
        "checkboxOFF",
        "checkboxON",
        "radioButtonOFF",
        "radioButtonON",
    ];
    private readonly buttons: Map<string, string[]> = new Map();
    private readonly bmpIcons: Map<string, RoBitmap> = new Map();

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
            this.iconLeftX = 90;
            this.iconRightX = 1221;
            this.iconBaseY = 81;
            this.iconOffsetX = 45;
            this.iconOffsetY = 84;
            this.iconGapX = 9;
            this.keyLeftX = 228;
            this.keyRightX = 897;
            this.keyBaseY = 96;
            this.keyWidth = 93;
            this.keyHeight = 81;
            this.keyOffsetX = 90;
            this.keyOffsetY = 84;
        } else {
            this.bmpBack = getTextureManager().loadTexture(this.backUriHD);
            this.textEditBox.setFieldValue("width", new Float(914));
            this.textEditX = 8;
            this.iconLeftX = 60;
            this.iconRightX = 814;
            this.iconBaseY = 54;
            this.iconOffsetX = 30;
            this.iconOffsetY = 56;
            this.iconGapX = 6;
            this.keyLeftX = 152;
            this.keyRightX = 598;
            this.keyBaseY = 66;
            this.keyWidth = 62;
            this.keyHeight = 54;
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
            if (this.keyboardMode > KeyboardModes.ACCENTED) {
                this.keyboardMode = KeyboardModes.ALPHANUMERIC;
            } else if (this.keyboardMode < KeyboardModes.ALPHANUMERIC) {
                this.keyboardMode = KeyboardModes.ACCENTED;
            }
            this.isDirty = true;
            handled = true;
        } else if (key.startsWith("Lit_") || key === "replay") {
            handled = this.textEditBox.handleKey(key, press);
        } else if (key === "options") {
            this.capsLock = !this.capsLock;
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
            this.textEditBox.setTranslation([this.textEditX, 0]);
        }
        if (this.bmpBack?.isValid()) {
            this.drawImage(this.bmpBack, { ...rect, y: rect.y + this.iconBaseY }, 0, opacity, draw2D);
        }
        // Left Icons
        for (let i = 0; i < 5; i++) {
            const bmp = this.bmpIcons.get(this.icons[i]);
            if (bmp?.isValid()) {
                let offX = 0;
                let offY = i * this.iconOffsetY;
                if (i > 2) {
                    offX = i == 3 ? -this.iconOffsetX : this.iconOffsetX;
                    offY = 3 * this.iconOffsetY;
                }
                const iconRect = {
                    x: rect.x + this.iconLeftX + offX,
                    y: rect.y + this.iconBaseY + bmp.height + offY,
                    width: bmp.width,
                    height: bmp.height,
                };
                this.drawImage(bmp, iconRect, 0, opacity, draw2D);
            }
        }
        // Left Keys
        this.renderKeys(7, 0, rect.x + this.keyLeftX, rect.y + this.keyBaseY, opacity, draw2D);
        // Right Keys
        this.renderKeys(3, 28, rect.x + this.keyRightX, rect.y + this.keyBaseY, opacity, draw2D);
        // Right Icons
        for (let r = 0; r < 4; r++) {
            let icon: string;
            if (r === 0) {
                // Caps Lock
                icon = this.capsLock ? "checkboxON" : "checkboxOFF";
                const bmp = this.bmpIcons.get("shift");
                if (bmp?.isValid()) {
                    const iconRect = {
                        x: rect.x + this.iconRightX + this.iconGapX + bmp.width,
                        y: rect.y + this.iconBaseY + bmp.height,
                        width: bmp.width,
                        height: bmp.height,
                    };
                    this.drawImage(bmp, iconRect, 0, opacity, draw2D);
                }
            } else if (r === 1 && this.keyboardMode === KeyboardModes.ALPHANUMERIC) {
                icon = "radioButtonON";
            } else if (r === 2 && this.keyboardMode === KeyboardModes.SYMBOLS) {
                icon = "radioButtonON";
            } else if (r === 3 && this.keyboardMode === KeyboardModes.ACCENTED) {
                icon = "radioButtonON";
            } else {
                icon = "radioButtonOFF";
            }
            const bmp = this.bmpIcons.get(icon);
            if (bmp?.isValid()) {
                let offY = r * this.iconOffsetY;
                const iconRect = {
                    x: rect.x + this.iconRightX,
                    y: rect.y + this.iconBaseY + bmp.height + offY,
                    width: bmp.width,
                    height: bmp.height,
                };
                this.drawImage(bmp, iconRect, 0, opacity, draw2D);
            }
        }
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.updateParentRects(origin, angle);
        this.isDirty = false;
    }

    renderKeys(
        cols: number,
        start: number,
        x: number,
        y: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        const buttonsId = `${this.keyboardMode}${this.capsLock || this.shift ? "U" : "L"}`;
        const buttons = this.buttons.get(buttonsId);
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < cols; c++) {
                const index = start + r * cols + c;
                const button = buttons![index];
                if (button) {
                    const buttonRect = {
                        x: x + c * this.keyOffsetX,
                        y: y + r * this.keyOffsetY,
                        width: this.keyWidth,
                        height: this.keyHeight,
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
