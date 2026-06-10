import { AAMember, BrsString, Float, RoArray } from "brs-engine";
import { SGNodeType } from ".";
import { ButtonGroup } from "./ButtonGroup";
import { jsValueOf } from "../factory/Serializer";

/**
 * The button row positioned at the bottom of a StandardDialog. Extends ButtonGroup so it reuses the
 * existing button rendering, focus, and up/down navigation, while holding its buttons as real child
 * nodes (StdDlgButton when authored in XML, or Button created from a `buttons` array) — so
 * `getChild(buttonFocused)` and `buttonSelected`/`buttonFocused` work as documented.
 */
export class StdDlgButtonArea extends ButtonGroup {
    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.StdDlgButtonArea) {
        super([], name);
        this.setExtendsType(name, SGNodeType.ButtonGroup);

        this.registerInitializedFields(initializedFields);

        // Standard dialog buttons show only their text — no generic button icon. ButtonGroup copies
        // these onto every button (authored StdDlgButton children and `buttons`-array buttons alike).
        this.setValueSilent("iconUri", new BrsString(""));
        this.setValueSilent("focusedIconUri", new BrsString(""));
    }

    get hasButtons(): boolean {
        const buttons = jsValueOf(this.getValue("buttons")) as string[];
        return Array.isArray(buttons) && buttons.length > 0;
    }

    /** Replaces the displayed buttons; pass the dialog's `buttons` string array. */
    setButtons(buttons: string[]) {
        const current = jsValueOf(this.getValue("buttons")) as string[];
        if (Array.isArray(current) && current.length === buttons.length && current.every((b, i) => b === buttons[i])) {
            return; // unchanged — avoid rebuilding the button children every frame
        }
        this.setValue("buttons", new RoArray(buttons.map((text) => new BrsString(text))));
    }

    /** Sizes the row to the given content width and returns its total height. */
    layoutArea(width: number): number {
        this.setValueSilent("minWidth", new Float(width));
        this.setValueSilent("maxWidth", new Float(width));
        const buttons = jsValueOf(this.getValue("buttons")) as string[];
        const count = Array.isArray(buttons) ? buttons.length : 0;
        const buttonHeight = this.getValueJS("buttonHeight") as number;
        return count > 0 ? count * buttonHeight : 0;
    }
}
