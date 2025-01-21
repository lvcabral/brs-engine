import { FieldModel } from "../components/RoSGNode";
import { Group } from "./Group";
import { AAMember } from "../components/RoAssociativeArray";
import { BrsString } from "../BrsType";
import { TextEditBox } from "./TextEditBox";

export class MiniKeyboard extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "text", type: "string", value: "" },
        { name: "keyColor", type: "string", value: "0x000000FF" },
        { name: "focusedKeyColor", type: "string", value: "0x000000FF" },
        { name: "keyboardBitmapUri", type: "string", value: "" },
        { name: "focusBitmapUri", type: "string", value: "" },
        { name: "textEditBox", type: "node" },
        { name: "showTextEditBox", type: "boolean", value: "true" },
        { name: "lowerCase", type: "boolean", value: "true" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = "MiniKeyboard") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.set(new BrsString("textEditBox"), new TextEditBox());
    }
}
