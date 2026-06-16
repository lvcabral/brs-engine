import { AAMember } from "brs-engine";
import { SGNodeType } from ".";
import { DynamicKeyboardBase } from "./DynamicKeyboardBase";

/**
 * DynamicCustomKeyboard — voice-enabled keyboard with a developer-supplied layout.
 * The app must set `keyGrid.keyDefinitionUri` to a custom Key Definition File; the
 * DynamicKeyGrid loads and parses it. Default key-selection handling is inherited
 * from DynamicKeyboardBase (insert label, clear, backspace, space, etc.).
 */
export class DynamicCustomKeyboard extends DynamicKeyboardBase {
    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.DynamicCustomKeyboard) {
        super([], name);
        this.setExtendsType(name, SGNodeType.DynamicKeyboardBase);
        this.registerInitializedFields(initializedFields);

        this.configureVoiceBox({ voiceEntryType: "generic", voiceEnabled: true, maxTextLength: 75 });
    }
}
