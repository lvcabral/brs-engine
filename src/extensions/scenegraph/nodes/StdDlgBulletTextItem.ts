import { AAMember, BrsBoolean, BrsString, Float, Int32 } from "brs-engine";
import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";
import { Label } from "./Label";
import { StdDlgItem, getDialogColors, colorFromPalette } from "./StdDlgItemBase";

/**
 * A bulleted, numbered, or lettered list inside a StandardDialog's content area. Each entry in the
 * `bulletText` array is rendered on its own line with a delimiter chosen by `bulletType`.
 */
export class StdDlgBulletTextItem extends Group implements StdDlgItem {
    readonly defaultFields: FieldModel[] = [
        { name: "bulletText", type: "stringarray", value: "[]" },
        { name: "bulletType", type: "string", value: "bullet" },
    ];
    private readonly labels: Label[] = [];
    private readonly lineGap: number;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.StdDlgBulletTextItem) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
        this.lineGap = this.resolution === "FHD" ? 12 : 8;
    }

    private delimiter(bulletType: string, index: number): string {
        if (bulletType === "numbered") {
            return `${index + 1}. `;
        } else if (bulletType === "lettered") {
            return `${String.fromCodePoint(97 + (index % 26))}. `;
        }
        return "• ";
    }

    layoutItem(width: number): number {
        const entries = (this.getValueJS("bulletText") as string[]) ?? [];
        const bulletType = (this.getValueJS("bulletType") as string) || "bullet";
        const color = colorFromPalette(getDialogColors(this), "DialogTextColor", "0xDDDDDDFF");

        let y = 0;
        for (let i = 0; i < entries.length; i++) {
            let label = this.labels[i];
            if (!label) {
                label = new Label();
                label.setValueSilent("wrap", BrsBoolean.True);
                label.setValueSilent("horizAlign", new BrsString("left"));
                label.setValueSilent("vertAlign", new BrsString("top"));
                this.labels.push(label);
                this.appendChildToParent(label);
            }
            label.setValueSilent("visible", BrsBoolean.True);
            label.setValueSilent("width", new Float(width));
            label.setValue("font", new BrsString("font:SmallSystemFont"));
            label.setValueSilent("color", new Int32(color));
            label.setValue("text", new BrsString(this.delimiter(bulletType, i) + entries[i]));
            label.setTranslation([0, y]);
            y += label.getMeasured().height + this.lineGap;
        }
        for (let i = entries.length; i < this.labels.length; i++) {
            this.labels[i].setValueSilent("visible", BrsBoolean.False);
        }

        const height = entries.length ? y - this.lineGap : 0;
        this.setValueSilent("width", new Float(width));
        this.setValueSilent("height", new Float(height));
        return height;
    }
}
