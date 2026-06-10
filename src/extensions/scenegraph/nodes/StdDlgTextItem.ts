import { AAMember, BrsBoolean, BrsString, Float, Int32 } from "brs-engine";
import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";
import { Label } from "./Label";
import { ScrollableText } from "./ScrollableText";
import { StdDlgItem, getDialogColors, colorFromPalette } from "./StdDlgItemBase";

/**
 * A block of text inside a StandardDialog's content area. Resolves its color and font from the
 * dialog palette via the `namedTextStyle` field ("normal" / "secondary" / "bold"). By default the
 * text wraps across multiple lines (a Label) and the item grows to fit. When `scrollable` is true it
 * uses a ScrollableText: the text wraps inside a fixed-height viewport and scrolls vertically (with a
 * scrollbar) when it overflows. Extends Group (Roku's StdDlgItemBase is an abstract Group subclass).
 */
export class StdDlgTextItem extends Group implements StdDlgItem {
    readonly defaultFields: FieldModel[] = [
        { name: "text", type: "string", value: "" },
        { name: "namedTextStyle", type: "string", value: "normal" },
        { name: "audioGuideText", type: "string", value: "" },
        { name: "scrollable", type: "boolean", value: "false" },
    ];
    /** Width reserved by ScrollableText for its scrollbar (mirrors that node's constants). */
    private readonly scrollbarWidth: number;
    /** Cap for the scrollable viewport height; longer text scrolls within it. */
    private readonly maxViewport: number;
    private textNode: Group;
    /** The font URI last applied to the text node, so layout only re-sets it on a real change
     * (ScrollableText resets its scroll position whenever its font is set). */
    private appliedFont?: string;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.StdDlgTextItem) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.scrollbarWidth = this.resolution === "FHD" ? 54 : 36;
        this.maxViewport = this.resolution === "FHD" ? 600 : 400;
        this.textNode = this.buildTextNode();
    }

    /** Creates the text node matching the current `scrollable` value and links it to `text`. */
    private buildTextNode(): Group {
        const scrollable = this.getValueJS("scrollable") as boolean;
        const node: Group = scrollable ? new ScrollableText() : new Label();
        node.setValueSilent("horizAlign", new BrsString("left"));
        node.setValueSilent("vertAlign", new BrsString("top"));
        if (node instanceof Label) {
            node.setValueSilent("wrap", BrsBoolean.True);
        }
        this.appendChildToParent(node);
        this.linkField(node, "text");
        return node;
    }

    /**
     * The focusable widget for this item, used by the dialog's focus navigation. Only a scrollable
     * text item exposes one (its ScrollableText, which scrolls on up/down); a plain text block has none.
     */
    getFocusWidget(): Group | undefined {
        return this.textNode instanceof ScrollableText ? this.textNode : undefined;
    }

    /** Rebuilds the text node if `scrollable` changed since it was last created. */
    private syncTextNode() {
        const scrollable = this.getValueJS("scrollable") as boolean;
        if (scrollable === this.textNode instanceof ScrollableText) {
            return;
        }
        // linkField makes this node adopt the new child's `text` field, so capture the current text
        // and restore it onto the shared field after rebuilding.
        const currentText = this.getValueJS("text") as string;
        this.removeChildByReference(this.textNode);
        this.textNode = this.buildTextNode();
        this.appliedFont = undefined; // the new node needs its font applied
        this.setValueSilent("text", new BrsString(currentText ?? ""));
    }

    /** Measures the wrapped height of `text` at the given width using a throwaway Label. */
    private measureWrappedHeight(text: string, width: number, fontName: string): number {
        const measurer = new Label();
        measurer.setValueSilent("wrap", BrsBoolean.True);
        measurer.setValueSilent("width", new Float(Math.max(0, width)));
        measurer.setValue("font", new BrsString(`font:${fontName}`));
        measurer.setValue("text", new BrsString(text));
        return measurer.getMeasured().height;
    }

    layoutItem(width: number): number {
        this.syncTextNode();
        const style = (this.getValueJS("namedTextStyle") as string) || "normal";
        const fontName =
            style === "secondary" ? "SmallestSystemFont" : style === "bold" ? "SmallBoldSystemFont" : "SmallSystemFont";
        const colorName = style === "secondary" ? "DialogSecondaryTextColor" : "DialogTextColor";
        const colors = getDialogColors(this);
        const color = colorFromPalette(colors, colorName, "0xDDDDDDFF");

        // Only set the font when it actually changes: setting it goes through setValue (needed to
        // convert the "font:…" string into a Font), and ScrollableText.setValue resets its scroll
        // position on a font change — re-setting it on every relayout would jump scroll to the top.
        const fontUri = `font:${fontName}`;
        if (this.appliedFont !== fontUri) {
            this.textNode.setValue("font", new BrsString(fontUri));
            this.appliedFont = fontUri;
        }
        this.textNode.setValueSilent("color", new Int32(color));

        let height: number;
        if (this.textNode instanceof ScrollableText) {
            // Fixed-height viewport: cap the natural (wrapped) height, scrolling the overflow. The
            // text wraps to the width minus the scrollbar so the measurement matches the scrolled case.
            const text = (this.getValueJS("text") as string) ?? "";
            const natural = this.measureWrappedHeight(text, width - this.scrollbarWidth, fontName);
            height = Math.min(natural, this.maxViewport);
            this.textNode.setValueSilent("width", new Float(width));
            this.textNode.setValueSilent("height", new Float(height));
            // Theme the scrollbar: track + unfocused thumb use DialogFootprintColor, the focused
            // thumb uses DialogFocusColor.
            const footprint = new Int32(colorFromPalette(colors, "DialogFootprintColor", "0x55555580"));
            this.textNode.setValueSilent("scrollbarTrackBlendColor", footprint);
            this.textNode.setValueSilent("scrollbarThumbBlendColor", footprint);
            this.textNode.setValueSilent(
                "scrollbarThumbFocusedBlendColor",
                new Int32(colorFromPalette(colors, "DialogFocusColor", "0xFFFFFFFF"))
            );
        } else {
            this.textNode.setValueSilent("width", new Float(width));
            height = (this.textNode as Label).getMeasured().height;
        }

        this.setValueSilent("width", new Float(width));
        this.setValueSilent("height", new Float(height));
        return height;
    }
}
