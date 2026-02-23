import {
    AAMember,
    BrsBoolean,
    BrsString,
    Float,
    IfDraw2D,
    Interpreter,
    Int32,
    Rect,
    RoBitmap,
    BrsType,
    isAnyNumber,
} from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";
import { Font } from "./Font";
import { sgRoot } from "../SGRoot";
import { jsValueOf } from "../factory/Serializer";

/**
 * Key layout: 3 columns × 4 rows.
 *   Row 0: "1", "2", "3"
 *   Row 1: "4", "5", "6"
 *   Row 2: "7", "8", "9"
 *   Row 3: "clear", "0", "delete"
 */
const PIN_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "delete"];

export class PinPad extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "pin", type: "string", value: "" },
        { name: "pinLength", type: "integer", value: "4" },
        { name: "secureMode", type: "boolean", value: "true" },
        { name: "keyColor", type: "color", value: "0xFFFFFFFF" },
        { name: "focusedKeyColor", type: "color", value: "0x000000FF" },
        { name: "pinDisplayTextColor", type: "color", value: "0xFFFFFFFF" },
        { name: "keyboardBitmapUri", type: "uri", value: "" },
        { name: "pinDisplayBitmapUri", type: "uri", value: "" },
        { name: "focusBitmapUri", type: "uri", value: "" },
        { name: "showPinDisplay", type: "boolean", value: "true" },
        { name: "itemFocused", type: "integer", value: "0" },
        { name: "focusVisible", type: "boolean", value: "true" },
    ];

    private pin: string = "";
    private pinLength: number = 4;
    private secureMode: boolean = true;
    private showPinDisplay: boolean = true;
    private keyColor: number;
    private focusedKeyColor: number;
    private pinDisplayTextColor: number;
    private bmpBack?: RoBitmap;
    private bmpFocus?: RoBitmap;
    private bmpInputField?: RoBitmap;
    private readonly bmpDot?: RoBitmap;
    private readonly bmpDelete?: RoBitmap;
    private readonly bmpClear?: RoBitmap;

    // Layout constants (set in constructor based on resolution)
    private readonly keyBaseX: number;
    private readonly keyBaseY: number;
    private readonly keyFocusDelta: number;
    private readonly offsetX: number;
    private readonly offsetY: number;
    private readonly pinDisplayOffsetY: number;
    private readonly boxHeight: number;

    private readonly font: Font;
    private readonly keyFocus = { row: 0, col: 0 };

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.PinPad) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);
        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.font = new Font();

        if (this.resolution === "FHD") {
            this.keyBaseX = 21;
            this.keyBaseY = 21;
            this.keyFocusDelta = 15;
            this.offsetX = 122;
            this.offsetY = 84;
            this.pinDisplayOffsetY = 72;
            this.boxHeight = 75;
        } else {
            this.keyBaseX = 14;
            this.keyBaseY = 14;
            this.keyFocusDelta = 10;
            this.offsetX = 81;
            this.offsetY = 56;
            this.pinDisplayOffsetY = 48;
            this.boxHeight = 50;
        }

        // Load assets
        this.bmpBack = this.loadBitmap(`common:/images/${this.resolution}/keyboard_pinpad.png`);
        this.bmpFocus = this.loadBitmap("common:/images/focus_keyboard.9.png");
        this.bmpInputField = this.loadBitmap("common:/images/inputField.9.png");
        this.bmpDot = this.loadBitmap(`common:/images/${this.resolution}/dialog_pinpad_dot.png`);
        this.bmpDelete = this.loadBitmap(`common:/images/${this.resolution}/icon_delete.png`);
        this.bmpClear = this.loadBitmap(`common:/images/${this.resolution}/icon_clear.png`);

        // Node dimensions: keyboard image width, keyboard + pin-display area height
        const imgWidth = this.bmpBack?.width ?? (this.resolution === "FHD" ? 408 : 272);
        const imgHeight = this.bmpBack?.height ?? (this.resolution === "FHD" ? 378 : 252);
        this.setValueSilent("focusable", BrsBoolean.True);
        this.setValueSilent("width", new Float(imgWidth));
        this.setValueSilent("height", new Float(imgHeight + this.pinDisplayOffsetY));

        this.keyColor = this.getValueJS("keyColor") as number;
        this.focusedKeyColor = this.getValueJS("focusedKeyColor") as number;
        this.pinDisplayTextColor = this.getValueJS("pinDisplayTextColor") as number;
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind, sync: boolean = true) {
        const fieldName = index.toLowerCase();
        if (fieldName === "itemfocused" && isAnyNumber(value)) {
            const newValue = jsValueOf(value) ?? 0;
            if (newValue >= 0 && newValue <= 11) {
                const itemFocused = Math.max(0, Math.min(11, newValue));
                this.keyFocus.row = Math.floor(itemFocused / 3);
                this.keyFocus.col = itemFocused % 3;
            }
        } else if (fieldName === "pinlength" && isAnyNumber(value)) {
            const newValue = jsValueOf(value) ?? this.pinLength;
            if (newValue >= 0 && newValue !== this.pinLength) {
                this.pinLength = newValue;
            }
        }
        super.setValue(index, value, alwaysNotify, kind, sync);
    }

    // -------------------------------------------------------------------------
    // Key handling
    // -------------------------------------------------------------------------

    handleKey(key: string, press: boolean): boolean {
        if (!press) return false;
        if (key === "left" || key === "right") {
            return this.handleLeftRight(key);
        } else if (key === "up" || key === "down") {
            return this.handleUpDown(key);
        } else if (key === "OK") {
            return this.handleOK();
        } else if (key === "replay") {
            return this.deleteLastDigit();
        }
        return false;
    }

    private handleLeftRight(key: string) {
        let handled = true;
        this.keyFocus.col += key === "left" ? -1 : 1;
        if (this.keyFocus.col > 2) {
            this.keyFocus.col = 2;
            handled = false;
        } else if (this.keyFocus.col < 0) {
            this.keyFocus.col = 0;
            handled = false;
        }
        if (handled) {
            super.setValue("itemFocused", new Int32(this.keyFocus.row * 3 + this.keyFocus.col));
        }
        return handled;
    }

    private handleUpDown(key: string) {
        let handled = false;
        if (key === "up" && this.keyFocus.row > 0) {
            this.keyFocus.row--;
            handled = true;
        } else if (key === "down" && this.keyFocus.row < 3) {
            this.keyFocus.row++;
            handled = true;
        }
        if (handled) {
            super.setValue("itemFocused", new Int32(this.keyFocus.row * 3 + this.keyFocus.col));
        }
        return handled;
    }

    private handleOK() {
        const keyIndex = this.keyFocus.row * 3 + this.keyFocus.col;
        const key = PIN_KEYS[keyIndex] ?? "";
        if (key === "delete") {
            return this.deleteLastDigit();
        } else if (key === "clear") {
            return this.clearPin();
        } else if (key === "") {
            return false;
        }
        return this.addDigit(key);
    }

    private clearPin() {
        if (this.pin.length === 0) return false;
        this.pin = "";
        this.setValue("pin", new BrsString(""));
        return true;
    }

    private addDigit(digit: string) {
        if (this.pin.length >= this.pinLength) return false;
        this.pin += digit;
        this.setValue("pin", new BrsString(this.pin));
        return true;
    }

    private deleteLastDigit() {
        if (this.pin.length === 0) return false;
        this.pin = this.pin.slice(0, -1);
        this.setValue("pin", new BrsString(this.pin));
        return true;
    }

    // -------------------------------------------------------------------------
    // Rendering
    // -------------------------------------------------------------------------

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            this.updateRenderTracking(true);
            return;
        }
        const isFocused = sgRoot.focused === this;
        const nodeTrans = this.getTranslation();
        const drawTrans = nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const rotation = angle + this.getRotation();
        opacity = opacity * this.getOpacity();
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };

        if (this.isDirty) {
            this.keyColor = this.getValueJS("keyColor") as number;
            this.focusedKeyColor = this.getValueJS("focusedKeyColor") as number;
            this.pinDisplayTextColor = this.getValueJS("pinDisplayTextColor") as number;
            this.pin = (this.getValueJS("pin") as string) ?? "";
            this.secureMode = (this.getValueJS("secureMode") as boolean) ?? true;
            this.showPinDisplay = (this.getValueJS("showPinDisplay") as boolean) ?? true;

            // Custom keyboard background
            const backgroundUri = this.getValueJS("keyboardBitmapUri") as string;
            if (backgroundUri && this.bmpBack?.getImageName() !== backgroundUri) {
                this.bmpBack = this.getBitmap("keyboardBitmapUri");
            }
            // Custom pin display box image
            const pinDisplayUri = this.getValueJS("pinDisplayBitmapUri") as string;
            if (pinDisplayUri && this.bmpInputField?.getImageName() !== pinDisplayUri) {
                this.bmpInputField = this.getBitmap("pinDisplayBitmapUri");
            }
            // Custom focus indicator
            const focusUri = this.getValueJS("focusBitmapUri") as string;
            if (focusUri && this.bmpFocus?.getImageName() !== focusUri) {
                this.bmpFocus = this.getBitmap("focusBitmapUri");
            }
        }

        // Y origin of the keyboard portion (below pin display area)
        const topY = rect.y + (this.showPinDisplay ? this.pinDisplayOffsetY : 0);

        // Draw keyboard background image
        this.drawImage(this.bmpBack!, { x: rect.x, y: topY, width: 0, height: 0 }, 0, opacity, draw2D);

        // Draw numeric keys and delete icon
        this.renderKeys(rect.x + this.keyBaseX, topY + this.keyBaseY, opacity, isFocused, draw2D);

        // Draw pin entry display boxes above the keyboard
        if (this.showPinDisplay && this.pinLength > 0) {
            this.renderPinDisplay(rect, opacity, draw2D);
        }

        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.nodeRenderingDone(origin, angle, opacity, draw2D);
    }

    private renderPinDisplay(rect: Rect, opacity: number, draw2D?: IfDraw2D) {
        // Inner keyboard area (excluding image margins)
        const innerWidth = (this.bmpBack?.width ?? rect.width) - 2 * this.keyBaseX;
        // Gap between boxes is exactly boxPaddingX (8px HD / 12px FHD)
        const baseBoxWidth = Math.floor(innerWidth / this.pinLength);
        const remainder = innerWidth - baseBoxWidth * this.pinLength;
        // Boxes sit flush against the top of the keyboard background (no bottom margin)
        const boxY = rect.y + this.pinDisplayOffsetY - this.boxHeight;

        for (let i = 0; i < this.pinLength; i++) {
            // Distribute leftover pixels into the last box so the row fills exactly
            const boxWidth = i === this.pinLength - 1 ? baseBoxWidth + remainder : baseBoxWidth;
            const boxX = rect.x + this.keyBaseX + i * baseBoxWidth;
            const boxRect: Rect = { x: boxX, y: boxY, width: boxWidth, height: this.boxHeight };

            // Draw box background (9-patch stretches to fill boxRect)
            if (this.bmpInputField?.isValid()) {
                this.drawImage(this.bmpInputField, boxRect, 0, opacity, draw2D);
            }

            if (i < this.pin.length) {
                if (this.secureMode) {
                    // Always show dot in secure mode
                    if (this.bmpDot?.isValid()) {
                        const dotX = boxX + Math.floor((boxWidth - this.bmpDot.width) / 2);
                        const dotY = boxY + Math.floor((this.boxHeight - this.bmpDot.height) / 2);
                        this.drawImage(
                            this.bmpDot,
                            { x: dotX, y: dotY, width: 0, height: 0 },
                            0,
                            opacity,
                            draw2D,
                            this.pinDisplayTextColor
                        );
                    }
                } else {
                    // Always show digit when not in secure mode
                    this.drawText(
                        this.pin[i],
                        this.font,
                        this.pinDisplayTextColor,
                        opacity,
                        boxRect,
                        "center",
                        "center",
                        0,
                        draw2D,
                        "",
                        100 + i // offset past key cache slots (0-11) to avoid collisions
                    );
                }
            }
        }
    }

    private renderKeys(x: number, y: number, opacity: number, isFocused: boolean, draw2D?: IfDraw2D) {
        const focusVisible = (this.getValueJS("focusVisible") as boolean) ?? true;

        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 3; c++) {
                const keyIndex = r * 3 + c;
                const key = PIN_KEYS[keyIndex] ?? "";

                const buttonRect: Rect = {
                    x: x + c * this.offsetX,
                    y: y + r * this.offsetY,
                    width: this.offsetX,
                    height: this.offsetY,
                };

                let color = this.keyColor;
                const isKeyFocused = isFocused && focusVisible && this.keyFocus.col === c && this.keyFocus.row === r;

                if (isKeyFocused && this.bmpFocus?.isValid()) {
                    color = this.focusedKeyColor;
                    const focusRect: Rect = {
                        x: buttonRect.x - this.keyFocusDelta,
                        y: buttonRect.y - this.keyFocusDelta,
                        width: buttonRect.width + 2 * this.keyFocusDelta,
                        height: buttonRect.height + 2 * this.keyFocusDelta,
                    };
                    this.drawImage(this.bmpFocus, focusRect, 0, opacity, draw2D);
                }

                if (key === "clear" || key === "delete") {
                    const bmp = key === "clear" ? this.bmpClear : this.bmpDelete;
                    if (bmp?.isValid()) {
                        const iconX = buttonRect.x + Math.floor((this.offsetX - bmp.width) / 2);
                        const iconY = buttonRect.y + Math.floor((this.offsetY - bmp.height) / 2);
                        this.drawImage(
                            bmp,
                            { x: iconX, y: iconY, width: bmp.width, height: bmp.height },
                            0,
                            opacity,
                            draw2D,
                            color
                        );
                    }
                } else if (key.length) {
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
                        keyIndex
                    );
                }
            }
        }
    }
}
