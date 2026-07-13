import { AAMember, BrsType, Float } from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";
import { DynamicKeyboard } from "./DynamicKeyboard";
import { DynamicPinPad } from "./DynamicPinPad";
import { DynamicKeyboardBase } from "./DynamicKeyboardBase";
import { RSGPalette } from "./RSGPalette";
import { StdDlgItem, getDialogColors, colorFromPalette } from "./StdDlgItemBase";
import { toAssociativeArray, jsValueOf } from "../factory/Serializer";
import { convertHexColor } from "../SGUtil";

/**
 * A content item that hosts a keyboard or pin pad inside a StandardDialog, selected by `keyLayout`
 * ("keyboard" or "pinpad"). Per Roku's spec it hosts a DynamicKeyboard / DynamicPinPad, which bring
 * voice entry. The item's `text` mirrors the entered string and `textEditBox` exposes the widget's
 * VoiceTextEditBox.
 */
export class StdDlgKeyboardItem extends Group implements StdDlgItem {
    readonly defaultFields: FieldModel[] = [
        { name: "keyLayout", type: "string", value: "unspecified" },
        { name: "text", type: "string", value: "" },
        { name: "textEditBox", type: "node" },
    ];
    private widget?: DynamicKeyboardBase;
    private keyPalette?: RSGPalette;

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
            this.widget = new DynamicPinPad();
        } else if (layout === "keyboard") {
            this.widget = new DynamicKeyboard();
        } else {
            return;
        }
        // Expose the widget's VoiceTextEditBox and keep `text` as a single shared field.
        this.setValueSilent("textEditBox", this.widget.textEditBox);
        this.appendChildToParent(this.widget);
        this.linkField(this.widget, "text");
    }

    get pinPad(): DynamicPinPad | undefined {
        return this.widget instanceof DynamicPinPad ? this.widget : undefined;
    }

    get keyboard(): DynamicKeyboard | undefined {
        return this.widget instanceof DynamicKeyboard ? this.widget : undefined;
    }

    /** The focusable widget (pin pad or keyboard), if any. */
    get focusWidget(): Group | undefined {
        return this.widget;
    }

    /**
     * Themes the embedded keyboard / pin pad from the dialog palette. Both the Dynamic key grid (its
     * glyph/focus colors) and the keyboard's text box resolve colors from the nearest ancestor
     * `palette` (RSGPalette) node, so we bridge the dialog's `Dialog*` colors onto a palette node
     * attached to the widget — the key grid and text box both inherit it — using the names they
     * expect.
     */
    private applyPalette() {
        if (!this.widget) {
            return;
        }
        const colors = getDialogColors(this);
        const paletteColors = toAssociativeArray({
            PrimaryTextColor: colorFromPalette(colors, "DialogTextColor", "0xDDDDDDFF"),
            FocusItemColor: colorFromPalette(colors, "DialogFocusItemColor", "0x262626FF"),
            FocusColor: colorFromPalette(colors, "DialogFocusColor", "0xFFFFFFFF"),
            SecondaryItemColor: colorFromPalette(colors, "DialogSecondaryItemColor", "0xAAAAAAFF"),
            KeyboardColor: convertHexColor("0xFFFFFFFF"), // no tint on the keyboard background bitmap
        });
        this.keyPalette ??= new RSGPalette();
        this.keyPalette.setValue("colors", paletteColors);
        this.widget.setValue("palette", this.keyPalette);
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
