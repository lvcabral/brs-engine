import { AAMember, BrsBoolean, BrsDevice, BrsString, BrsType } from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { PinPad } from "./PinPad";

/**
 * ParentalControlPinPad — a PinPad variant used to gate blocked content. Differences from PinPad:
 *
 * - `pin`, `pinLength`, and `secureMode` are private to BrightScript (writes are ignored;
 *   `secureMode` is forced to true).
 * - Adds a read-only `pinSuccess` field: "incomplete" until a full PIN is entered, then "true" if
 *   it matches the configured parental-control PIN or "false" otherwise (entry is auto-cleared on
 *   a mismatch).
 *
 * The engine has no device-level parental PIN, so the expected PIN is read from the registry under
 * {@link ParentalControlPinPad.expectedPinKey}; tests/apps set it via `BrsDevice.registry`. When no
 * expected PIN is configured, a complete entry resolves to "false".
 */
export class ParentalControlPinPad extends PinPad {
    /** Registry key holding the expected parental-control PIN. */
    static readonly expectedPinKey = "brs.parentalControlPin";

    readonly defaultFields: FieldModel[] = [
        { name: "pinSuccess", type: "string", value: "incomplete", alwaysNotify: true },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.ParentalControlPinPad) {
        super([], name);
        this.setExtendsType(name, SGNodeType.PinPad);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
        // secureMode is always enabled for parental control entry.
        this.setValueSilent("secureMode", BrsBoolean.True);
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind, sync: boolean = true) {
        const fieldName = index.toLowerCase();
        if (fieldName === "securemode") {
            // Private + forced true: ignore the requested value.
            value = BrsBoolean.True;
        } else if (fieldName === "pinlength" || fieldName === "pinsuccess") {
            // Private (pinLength) / read-only (pinSuccess) to BrightScript.
            return;
        }
        super.setValue(index, value, alwaysNotify, kind, sync);
        if (fieldName === "pin") {
            this.evaluatePin();
        }
    }

    private setPinSuccess(result: string) {
        // Bypass this class's setValue block by going through the base implementation.
        super.setValue("pinSuccess", new BrsString(result));
    }

    private evaluatePin() {
        const pin = (this.getValueJS("pin") as string) ?? "";
        const pinLength = (this.getValueJS("pinLength") as number) ?? 4;
        if (pin.length < pinLength) {
            this.setPinSuccess("incomplete");
            return;
        }
        const expected = BrsDevice.registry.current.get(ParentalControlPinPad.expectedPinKey) ?? "";
        if (expected !== "" && pin === expected) {
            this.setPinSuccess("true");
            // TODO: start a 2-hour content-unblock override (no device-level analog in the engine yet).
        } else {
            this.setPinSuccess("false");
            // Incorrect PIN clears the entry automatically (re-evaluates to "incomplete").
            super.setValue("pin", new BrsString(""));
        }
    }
}
