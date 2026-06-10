import { AAMember, BrsBoolean, BrsString, Float, Int32 } from "brs-engine";
import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";
import { MultiStyleLabel } from "./MultiStyleLabel";
import { StdDlgItem, getDialogColors, colorFromPalette } from "./StdDlgItemBase";

/**
 * A line of mixed-style text inside a StandardDialog's content area. Mirrors Roku's
 * StdDlgMultiStyleTextItem: the `drawingStyles` associative array defines named font styles
 * (fontSize / fontUri / color) and the `text` field uses `<style>…</style>` markup to switch
 * styles. Rendering is delegated to a wrapping MultiStyleLabel child; the `text`/`drawingStyles`
 * fields are shared with it. Untagged text without a "default" style falls back to the dialog's
 * text color. Extends Group (Roku's StdDlgItemBase is an abstract Group subclass).
 */
export class StdDlgMultiStyleTextItem extends Group implements StdDlgItem {
    readonly defaultFields: FieldModel[] = [
        { name: "text", type: "string", value: "" },
        { name: "drawingStyles", type: "assocarray" },
        { name: "audioGuideText", type: "string", value: "" },
    ];
    private label: MultiStyleLabel;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.StdDlgMultiStyleTextItem) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
        this.label = this.buildLabel();
    }

    /** Creates the wrapping MultiStyleLabel and shares the `text`/`drawingStyles` fields with it. */
    private buildLabel(): MultiStyleLabel {
        const label = new MultiStyleLabel();
        label.setValueSilent("wrap", BrsBoolean.True);
        label.setValueSilent("horizAlign", new BrsString("left"));
        label.setValueSilent("vertAlign", new BrsString("top"));
        this.appendChildToParent(label);
        this.linkField(label, "text");
        this.linkField(label, "drawingStyles");
        return label;
    }

    layoutItem(width: number): number {
        // Untagged text (or text with no "default" style) uses the dialog's text color.
        const color = colorFromPalette(getDialogColors(this), "DialogTextColor", "0xDDDDDDFF");
        this.label.setValueSilent("color", new Int32(color));
        // Set width through setValue (not silent) so the label rebuilds styles and re-measures
        // against the shared text/drawingStyles before we read its height.
        this.label.setValue("width", new Float(width));

        const height = this.label.getMeasured().height;
        this.setValueSilent("width", new Float(width));
        this.setValueSilent("height", new Float(height));
        return height;
    }
}
