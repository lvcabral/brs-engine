import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { TextEditBox } from "./TextEditBox";
import { AAMember, Float } from "brs-engine";

export class VoiceTextEditBox extends TextEditBox {
    readonly defaultFields: FieldModel[] = [
        { name: "voiceEnabled", type: "boolean", value: "false" },
        { name: "voiceToolTipWidth", type: "float" },
        { name: "voiceEntryType", type: "string", value: "generic" },
        { name: "isDictating", type: "boolean", value: "false" },
        { name: "voiceInputRegexFilter", type: "string", value: "" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.VoiceTextEditBox) {
        super([], name);
        this.setExtendsType(name, SGNodeType.TextEditBox);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        if (this.resolution === "FHD") {
            this.setValueSilent("voiceToolTipWidth", new Float(321));
        } else {
            this.setValueSilent("voiceToolTipWidth", new Float(214));
        }
    }
}
