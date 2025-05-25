import { FieldKind, FieldModel } from "./Field";
import { Group } from "./Group";
import { AAMember } from "../components/RoAssociativeArray";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import {
    BrsBoolean,
    BrsInvalid,
    BrsString,
    BrsType,
    Float,
    Font,
    Int32,
    isBrsString,
    RoBitmap,
    rootObjects,
    TextEditBox,
} from "..";

export class MiniKeyboard extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "text", type: "string", value: "" },
        { name: "keyColor", type: "color", value: "0xFFFFFFFF" },
        { name: "focusable", type: "boolean", value: "true" },
        { name: "focusedKeyColor", type: "color", value: "0x000000FF" },
        { name: "keyboardBitmapUri", type: "uri", value: "" },
        { name: "focusBitmapUri", type: "uri", value: "" },
        { name: "textEditBox", type: "node" },
        { name: "showTextEditBox", type: "boolean", value: "true" },
        { name: "lowerCase", type: "boolean", value: "true" },
    ];
    readonly textEditBox: TextEditBox;
    private showTextEdit: boolean;
    private lowerCase: boolean;
    private keyColor: number;
    private focusedKeyColor: number;
    private bmpBack?: RoBitmap;
    private bmpFocus?: RoBitmap;
    private readonly textEditX: number;
    private readonly iconOffsetX: number;
    private readonly iconOffsetY: number;
    private readonly keyBaseX: number;
    private readonly keyBaseY: number;
    private readonly keyWidth: number;
    private readonly keyHeight: number;
    private readonly keyFocusDelta: number;
    private readonly widthOver: number;
    private readonly heightOver: number;
    private readonly offsetX: number;
    private readonly offsetY: number;
    private readonly font: Font;
    private readonly icons = ["clear", "space", "delete"];
    private readonly buttons: string[];
    private readonly bmpIcons: Map<string, RoBitmap> = new Map();
    private readonly keyFocus = { row: 0, col: 0, key: "" };

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Keyboard") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.font = new Font();

        this.lowerCase = true;
        this.buttons = "abcdefghijklmnopqrstuvwxyz1234567890".split("");
        this.textEditBox = new TextEditBox();
        this.showTextEdit = true;
        if (this.resolution === "FHD") {
            this.textEditBox.setFieldValue("width", new Float(558));
            this.textEditX = 12;
            this.iconOffsetX = 75;
            this.iconOffsetY = 81;
            this.keyBaseX = 18;
            this.keyBaseY = 24;
            this.keyWidth = 93;
            this.keyHeight = 81;
            this.keyFocusDelta = 18;
            this.offsetX = 90;
            this.offsetY = 84;
            this.widthOver = 3;
            this.heightOver = 78;
        } else {
            this.textEditBox.setFieldValue("width", new Float(372));
            this.textEditX = 8;
            this.iconOffsetX = 50;
            this.iconOffsetY = 54;
            this.keyBaseX = 12;
            this.keyBaseY = 16;
            this.keyWidth = 62;
            this.keyHeight = 54;
            this.keyFocusDelta = 12;
            this.offsetX = 60;
            this.offsetY = 56;
            this.widthOver = 2;
            this.heightOver = 52;
        }
        this.textEditBox.setTranslation([this.textEditX, 0]);
        this.textEditBox.setFieldValue("maxTextLength", new Int32(25));
        this.bmpBack = this.loadBitmap(`common:/images/keyboard_mini_${this.resolution}.png`);
        this.setFieldValue("width", new Float(this.bmpBack!.width + this.widthOver));
        this.setFieldValue("height", new Float(this.bmpBack!.height + this.heightOver));

        this.bmpFocus = this.loadBitmap("common:/images/focus_keyboard.9.png");
        this.icons.forEach((icon) => {
            const uri = `common:/images/icon_${icon}_${this.resolution}.png`;
            const bmp = this.loadBitmap(uri);
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
        }
        return handled;
    }

    private handleLeftRight(key: string) {
        this.isDirty = true;
        let handled = true;
        this.keyFocus.col += key === "left" ? -1 : 1;
        if (this.keyFocus.col > 5) {
            this.keyFocus.col = 5;
            handled = false;
        } else if (this.keyFocus.col < 0) {
            this.keyFocus.col = 0;
            handled = false;
        } else if (this.keyFocus.row === 6 && key === "left") {
            handled = this.keyFocus.col !== 0;
            this.keyFocus.col = this.keyFocus.col > 2 ? 2 : 0;
        } else if (this.keyFocus.row === 6) {
            handled = this.keyFocus.col !== 5;
            this.keyFocus.col = this.keyFocus.col < 3 ? 2 : 5;
        }
        return handled;
    }

    private handleUpDown(key: string) {
        let handled = false;
        if (key === "up" && this.keyFocus.row > 0) {
            this.keyFocus.row--;
            this.isDirty = true;
            handled = true;
        } else if (key === "down" && this.keyFocus.row < 6) {
            this.keyFocus.row++;
            this.isDirty = true;
            handled = true;
        }
        return handled;
    }

    private handleOK() {
        let handled = false;
        let text = this.getFieldValueJS("text") as string;
        if (this.keyFocus.row === 6) {
            if (this.keyFocus.col < 2) {
                text = "";
            } else if (this.keyFocus.col < 4) {
                text += " ";
            } else {
                text = text.slice(0, -1);
            }
            this.set(new BrsString("text"), new BrsString(text));
            handled = true;
        } else if (this.keyFocus.key.length) {
            text += this.keyFocus.key;
            this.set(new BrsString("text"), new BrsString(text));
            handled = true;
        }
        if (handled && this.showTextEdit) {
            this.textEditBox.moveCursor(text.length);
        }
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
            this.lowerCase = this.getFieldValueJS("lowerCase") as boolean;
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
        this.keyFocus.key = "";
        this.renderKeys(rect.x + this.keyBaseX, topY + this.keyBaseY, opacity, isFocused, draw2D);
        this.renderBottomIcons(
            rect.x + this.keyBaseX,
            topY + this.keyBaseY + this.offsetY * 6,
            opacity,
            isFocused,
            draw2D
        );

        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.updateParentRects(origin, angle);
        this.isDirty = false;
    }

    private renderKeys(x: number, y: number, opacity: number, isFocused: boolean, draw2D?: IfDraw2D) {
        for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 6; c++) {
                const index = r * 6 + c;
                let key = this.buttons[index] ?? "";
                if (!this.lowerCase) {
                    key = key.toUpperCase();
                }
                const buttonRect = {
                    x: x + c * this.offsetX,
                    y: y + r * this.offsetY,
                    width: this.keyWidth,
                    height: this.keyHeight,
                };
                let color = this.keyColor;
                if (isFocused && this.keyFocus.col === c && this.keyFocus.row === r) {
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

    private renderBottomIcons(x: number, y: number, opacity: number, isFocused: boolean, draw2D?: IfDraw2D) {
        for (let i = 0; i < 3; i++) {
            const bmp = this.bmpIcons.get(this.icons[i]);
            if (bmp?.isValid()) {
                let keyFocused = this.keyFocus.row === 6 && Math.floor(this.keyFocus.col / 2) === i;
                const offX = this.offsetX * i * 2;
                const iconRect = {
                    x: x + this.iconOffsetX + offX,
                    y: y + this.keyBaseY,
                    width: bmp.width,
                    height: bmp.height,
                };
                let color = this.keyColor;
                if (isFocused && keyFocused) {
                    color = this.focusedKeyColor;
                    const width = 2 * this.keyWidth;
                    const focusRect = {
                        x: x + offX - this.keyFocusDelta,
                        y: y - this.keyFocusDelta,
                        width: width + 2 * this.keyFocusDelta,
                        height: this.keyHeight + 2 * this.keyFocusDelta,
                    };
                    this.drawImage(this.bmpFocus!, focusRect, 0, opacity, draw2D);
                }
                this.drawImage(bmp, iconRect, 0, opacity, draw2D, color);
            }
        }
    }
}
