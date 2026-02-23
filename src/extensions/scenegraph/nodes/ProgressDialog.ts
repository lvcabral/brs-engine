import { AAMember, BrsBoolean, BrsString, Float } from "brs-engine";
import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Dialog } from "./Dialog";
import { BusySpinner } from "./BusySpinner";

export class ProgressDialog extends Dialog {
    readonly defaultFields: FieldModel[] = [{ name: "busySpinner", type: "node" }];

    protected readonly minHeight: number;
    private readonly spinner: BusySpinner;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.ProgressDialog) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Dialog);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.spinner = new BusySpinner();

        // Resize the dialog and position the spinner, resolution-aware
        let spinnerSize: number;
        let spinnerY: number;

        if (this.resolution === "FHD") {
            spinnerSize = 120;
            spinnerY = this.dialogTrans[1] + 105 + this.vertOffset + this.gap;
            this.minHeight = 159 + spinnerSize + this.vertOffset * 2;
        } else {
            spinnerSize = 80;
            spinnerY = this.dialogTrans[1] + 70 + this.vertOffset + this.gap;
            this.minHeight = 106 + spinnerSize + this.vertOffset * 2;
        }
        this.height = this.minHeight;

        // Center spinner horizontally within the dialog
        const spinnerX = this.dialogTrans[0] + (this.width - spinnerSize) / 2;
        this.spinner.setTranslation([spinnerX, spinnerY]);
        this.spinner.setValue("control", new BrsString("start"));
        this.setValueSilent("busySpinner", this.spinner);

        // Adjust background height
        this.background.setValueSilent("height", new Float(this.minHeight));

        // Hide elements not used by ProgressDialog
        this.message.setValueSilent("visible", BrsBoolean.False);
        this.icon.setValueSilent("visible", BrsBoolean.False);
        this.setValueSilent("iconUri", new BrsString(""));

        this.appendChildToParent(this.spinner);
    }

    protected updateChildren() {
        this.height = this.minHeight;
        const width = this.getValueJS("width") as number;
        if (width) {
            this.background.setValue("width", new Float(width));
            this.width = width;
        }
        this.copyField(this.background, "uri", "backgroundUri");
        this.copyField(this.title, "text", "title");
        this.copyField(this.title, "color", "titleColor");
        this.copyField(this.title, "font", "titleFont");
        this.copyField(this.divider, "uri", "dividerUri");

        // Set dialog height and reposition elements
        const newY = (this.sceneRect.height - this.height) / 2;
        const offsetY = newY - this.dialogTrans[1];
        this.dialogTrans[1] = newY;
        this.background.setTranslation(this.dialogTrans);
        this.background.setValue("height", new Float(this.height));
        this.title.setTranslationOffset(0, offsetY);
        this.divider.setTranslationOffset(0, offsetY);
        this.spinner.setTranslationOffset(0, offsetY);
    }
}
