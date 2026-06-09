import { AAMember, BrsString } from "brs-engine";
import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Button } from "./Button";
import { Label } from "./Label";

/**
 * A single button in a StandardDialog's button area. Extends Button so it renders and handles focus
 * like any list button; the owning StdDlgButtonArea (a ButtonGroup) lays the buttons out and drives
 * focus/selection. Authored as `<StdDlgButton text="…" />` children or created from a dialog's
 * `buttons` array.
 */
export class StdDlgButton extends Button {
    readonly defaultFields: FieldModel[] = [{ name: "disabled", type: "boolean", value: "false" }];

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.StdDlgButton) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Button);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        // Standard dialog buttons have no icon and left-align their text (the button area also
        // clears the icon, but do it here too so a standalone StdDlgButton looks correct).
        this.setValueSilent("iconUri", new BrsString(""));
        this.setValueSilent("focusedIconUri", new BrsString(""));
        for (const child of this.getNodeChildren()) {
            if (child instanceof Label) {
                child.setValueSilent("horizAlign", new BrsString("left"));
                break;
            }
        }
    }
}
