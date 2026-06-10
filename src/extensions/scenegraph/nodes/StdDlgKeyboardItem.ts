import { AAMember, BrsType, Float, Int32 } from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";
import { PinPad } from "./PinPad";
import { Keyboard } from "./Keyboard";
import { VoiceTextEditBox } from "./VoiceTextEditBox";
import { StdDlgItem, getDialogColors, colorFromPalette } from "./StdDlgItemBase";
import { jsValueOf } from "../factory/Serializer";

/**
 * A content item that hosts a keyboard or pin pad inside a StandardDialog, selected by `keyLayout`
 * ("keyboard" or "pinpad"). Roku uses a DynamicKeyboard / DynamicPinPad; this engine reuses the
 * existing Keyboard / PinPad nodes. The item's `text` mirrors the entered string and `textEditBox`
 * exposes the widget's VoiceTextEditBox.
 */
export class StdDlgKeyboardItem extends Group implements StdDlgItem {
    readonly defaultFields: FieldModel[] = [
        { name: "keyLayout", type: "string", value: "unspecified" },
        { name: "text", type: "string", value: "" },
        { name: "textEditBox", type: "node" },
    ];
    private widget?: PinPad | Keyboard;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.StdDlgKeyboardItem) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
        // Honor a keyLayout supplied via initialized/XML fields.
        this.applyLayout(this.getValueJS("keyLayout") as string);
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        super.setValue(index, value, alwaysNotify, kind);
        if (index.toLowerCase() === "keylayout") {
            this.applyLayout(jsValueOf(value) as string);
        }
    }

    private applyLayout(layout: string) {
        if (this.widget) {
            return; // widget already created
        }
        if (layout === "pinpad") {
            const pad = new PinPad();
            const textEditBox = new VoiceTextEditBox();
            // Default to a 4-digit PIN; apps widen it via textEditBox.maxTextLength.
            textEditBox.setValueSilent("maxTextLength", new Int32(4));
            this.setValueSilent("textEditBox", textEditBox);
            this.widget = pad;
            this.appendChildToParent(pad);
            this.linkField(pad, "pin", "text");
        } else if (layout === "keyboard") {
            const keyboard = new Keyboard();
            this.setValueSilent("textEditBox", keyboard.textEditBox);
            this.widget = keyboard;
            this.appendChildToParent(keyboard);
            this.linkField(keyboard, "text");
        }
    }

    get pinPad(): PinPad | undefined {
        return this.widget instanceof PinPad ? this.widget : undefined;
    }

    get keyboard(): Keyboard | undefined {
        return this.widget instanceof Keyboard ? this.widget : undefined;
    }

    /** The focusable widget (pin pad or keyboard), if any. */
    get focusWidget(): Group | undefined {
        return this.widget;
    }

    /** Applies the keyboard item's text length limit to a pin pad widget. */
    syncTextLimit() {
        const textEditBox = this.getValue("textEditBox");
        if (this.widget instanceof PinPad && textEditBox instanceof VoiceTextEditBox) {
            const maxLength = textEditBox.getValueJS("maxTextLength") as number;
            if (typeof maxLength === "number" && maxLength > 0) {
                this.widget.setValue("pinLength", new Int32(maxLength));
            }
        }
    }

    /** Themes the embedded keyboard / pin pad from the dialog palette (key glyph colors). */
    private applyPalette() {
        if (!this.widget) {
            return;
        }
        const colors = getDialogColors(this);
        const keyColor = colorFromPalette(colors, "DialogTextColor", "0xFFFFFFFF");
        const focusedKeyColor = colorFromPalette(colors, "DialogFocusItemColor", "0x000000FF");
        const focusBlend = colorFromPalette(colors, "DialogFocusColor", "0xFFFFFFFF");
        this.widget.setValueSilent("keyColor", new Int32(keyColor));
        this.widget.setValueSilent("focusedKeyColor", new Int32(focusedKeyColor));
        // Tint the per-key focus highlight 9-patch with the palette focus color.
        this.widget.setValueSilent("focusBitmapBlendColor", new Int32(focusBlend));
        if (this.widget instanceof PinPad) {
            this.widget.setValueSilent("pinDisplayTextColor", new Int32(keyColor));
        }
    }

    layoutItem(width: number): number {
        if (!this.widget) {
            return 0;
        }
        this.applyPalette();
        const size = this.widget.getDimensions();
        this.widget.setTranslation([Math.max(0, (width - size.width) / 2), 0]);
        this.setValueSilent("width", new Float(Math.max(width, size.width)));
        this.setValueSilent("height", new Float(size.height));
        return size.height;
    }
}
