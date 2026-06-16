import { AAMember } from "brs-engine";
import { SGNodeType } from ".";
import { DynamicKeyboardBase } from "./DynamicKeyboardBase";
import { dynamicKeyboardKDF } from "./kdf/builtinKDFs";

/**
 * DynamicKeyboard — voice-enabled full keyboard (alphanumeric + symbols + accents),
 * matching the legacy Keyboard layout. Typically used for emails or passwords.
 */
export class DynamicKeyboard extends DynamicKeyboardBase {
    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.DynamicKeyboard) {
        super([], name);
        this.setExtendsType(name, SGNodeType.DynamicKeyboardBase);
        this.registerInitializedFields(initializedFields);

        this.configureVoiceBox({ voiceEntryType: "alphanumeric", voiceEnabled: true, maxTextLength: 75 });
        this.setKeyDefinition(dynamicKeyboardKDF, "ABC123Lower", {
            name: "keyboard_full",
            insetFHD: { top: 15, right: 13, bottom: 15, left: 11 },
            insetHD: { top: 11, right: 10, bottom: 11, left: 10 },
        });
    }
}
