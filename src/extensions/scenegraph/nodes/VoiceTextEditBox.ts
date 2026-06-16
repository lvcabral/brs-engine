import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { TextEditBox } from "./TextEditBox";
import { AAMember, Float, IfDraw2D, Interpreter, Rect, RoBitmap } from "brs-engine";
import { Font } from "./Font";

export class VoiceTextEditBox extends TextEditBox {
    readonly defaultFields: FieldModel[] = [
        { name: "voiceEnabled", type: "boolean", value: "false" },
        { name: "voiceToolTipWidth", type: "float" },
        { name: "voiceEntryType", type: "string", value: "generic" },
        { name: "isDictating", type: "boolean", value: "false" },
        { name: "voiceInputRegexFilter", type: "string", value: "" },
    ];

    // Pin-pad display mode: a fixed number of per-digit underline slots (used by
    // DynamicPinPad) instead of the regular flowing text + cursor display.
    private pinPadMode = false;
    private pinPadSlots = 0;
    private pinPadFont?: Font;
    private pinPadBg?: RoBitmap;
    private readonly pinSecureChar = "•";

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.VoiceTextEditBox) {
        super([], name);
        this.setExtendsType(name, SGNodeType.TextEditBox);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        if (this.resolution === "FHD") {
            this.setValueSilent("voiceToolTipWidth", new Float(321));
        } else {
            this.setValueSilent("voiceToolTipWidth", new Float(214));
        }
    }

    /** Enables the per-digit underline display used by DynamicPinPad. */
    setPinPadMode(slots: number) {
        this.pinPadMode = true;
        this.pinPadSlots = slots;
        this.pinPadFont = new Font(); // same default size as the regular text display
        this.pinPadBg = this.loadBitmap("common:/images/inputField.9.png");
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.pinPadMode) {
            super.renderNode(interpreter, origin, angle, opacity, draw2D);
            return;
        }
        if (!this.isVisible()) {
            this.updateRenderTracking(true);
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const rotation = angle + this.getRotation();
        opacity *= this.getOpacity();
        const rect: Rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };

        if (this.pinPadBg?.isValid()) {
            this.drawImage(this.pinPadBg, { ...rect }, 0, opacity, draw2D);
        }

        const text = this.getValueJS("text") as string;
        const secure = this.getValueJS("secureMode") as boolean;
        const active = this.getValueJS("active") as boolean;
        const color = this.getValueJS("textColor") as number;
        const slots = this.pinPadSlots > 0 ? this.pinPadSlots : (this.getValueJS("maxTextLength") as number);

        // The slots are a compact group centered in the box (not spread to the full width).
        const fhd = this.resolution === "FHD";
        const pitch = fhd ? 40 : 27;
        const underlineW = fhd ? 24 : 16;
        const underlineH = fhd ? 4 : 3;
        const centerY = rect.y + rect.height / 2;
        const underlineY = centerY + (fhd ? 12 : 8);
        const dotCenterY = centerY - (fhd ? 4 : 3);
        const firstCenterX = rect.x + rect.width / 2 - ((slots - 1) * pitch) / 2;

        for (let i = 0; i < slots; i++) {
            const centerX = firstCenterX + i * pitch;
            const underlineRect: Rect = {
                x: Math.round(centerX - underlineW / 2),
                y: Math.round(underlineY),
                width: underlineW,
                height: underlineH,
            };
            const activeSlot = active && i === text.length;
            draw2D?.doDrawRotatedRect(underlineRect, color, 0, [0, 0], activeSlot ? opacity : opacity * 0.5);
            if (i < text.length && this.pinPadFont) {
                // Secure entries show a bullet glyph, otherwise the digit; both at the regular
                // text size, centered over the slot.
                const char = secure ? this.pinSecureChar : text[i];
                const charRect: Rect = {
                    x: centerX - pitch,
                    y: dotCenterY - rect.height / 2,
                    width: 2 * pitch,
                    height: rect.height,
                };
                this.drawText(char, this.pinPadFont, color, opacity, charRect, "center", "center", 0, draw2D, "", i);
            }
        }

        this.updateBoundingRects(rect, origin, rotation);
        this.nodeRenderingDone(origin, angle, opacity, draw2D);
    }
}
