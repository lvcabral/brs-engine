import { AAMember } from "brs-engine";
import { SGNodeType } from ".";
import { DynamicKeyboardBase } from "./DynamicKeyboardBase";
import { dynamicMiniKeyboardKDF } from "./kdf/builtinKDFs";

/**
 * DynamicMiniKeyboard — voice-enabled letters/digits keyboard, matching the legacy
 * MiniKeyboard layout. Typically used for search queries.
 */
export class DynamicMiniKeyboard extends DynamicKeyboardBase {
    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.DynamicMiniKeyboard) {
        super([], name);
        this.setExtendsType(name, SGNodeType.DynamicKeyboardBase);
        this.registerInitializedFields(initializedFields);

        this.configureVoiceBox({ voiceEntryType: "alphanumeric", voiceEnabled: true, maxTextLength: 75 });
        this.setKeyDefinition(dynamicMiniKeyboardKDF, "", {
            name: "keyboard_mini",
            insetFHD: { top: 19, right: 16, bottom: 17, left: 17 },
            insetHD: { top: 15, right: 16, bottom: 12, left: 15 },
        });
    }
}
