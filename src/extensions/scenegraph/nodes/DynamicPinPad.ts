import { AAMember, BrsBoolean } from "brs-engine";
import { SGNodeType } from ".";
import { DynamicKeyboardBase } from "./DynamicKeyboardBase";
import { dynamicPinPadKDF } from "./kdf/builtinKDFs";

/**
 * DynamicPinPad — voice-enabled numeric PIN pad, matching the legacy PinPad. The
 * VoiceTextEditBox displays a per-digit underline for each of the `maxTextLength`
 * digits rather than flowing text.
 */
export class DynamicPinPad extends DynamicKeyboardBase {
    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.DynamicPinPad) {
        super([], name);
        this.setExtendsType(name, SGNodeType.DynamicKeyboardBase);
        this.registerInitializedFields(initializedFields);

        this.configureVoiceBox({ voiceEntryType: "numeric", voiceEnabled: true, maxTextLength: 4 });
        // PIN entry hides the digits by default (shows dots). The number of underline slots tracks
        // `textEditBox.maxTextLength`, so apps (e.g. StandardPinPadDialog) resize the pin via that field.
        this.textEditBox.setValueSilent("secureMode", BrsBoolean.True);
        this.textEditBox.setPinPadMode();
        this.setKeyDefinition(dynamicPinPadKDF, "", {
            name: "keyboard_pinpad",
            insetFHD: { top: 22, right: 23, bottom: 24, left: 21 },
            insetHD: { top: 15, right: 16, bottom: 16, left: 14 },
        });
    }

    handleKey(key: string, press: boolean): boolean {
        // Numeric entry only: ignore non-digit literal keys.
        if (key.startsWith("Lit_") && !/^\d$/.test(key.substring(4))) {
            return false;
        }
        return super.handleKey(key, press);
    }
}
