import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { KeyboardDialog } from "./KeyboardDialog";
import { AAMember } from "brs-engine";

export class StandardKeyboardDialog extends KeyboardDialog {
    readonly defaultFields: FieldModel[] = [
        { name: "textEditBox", type: "node" },
        { name: "keyboardDomain", type: "string", value: "generic" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.StandardKeyboardDialog) {
        super([], name);
        this.setExtendsType(name, SGNodeType.StandardDialog);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
        this.setValueSilent("textEditBox", this.keyboard.textEditBox);
    }
}
