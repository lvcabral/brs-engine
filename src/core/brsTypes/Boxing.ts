import { BrsBoolean, BrsInvalid, BrsString, BrsType, Double, Float, Int32, Int64 } from ".";
import { ValueKind } from "./BrsType";

/**
 * Cycle guard for a container copy: maps an already-copied container to its copy, so a back-pointer
 * resolves to the in-progress copy instead of recursing forever.
 */
export type CopyVisited = WeakMap<object, BrsType>;

export interface Boxable {
    box(): BrsType;
    literal: boolean; // Flag marking a value written directly in source (skips auto-boxing)
    legacy: boolean; // Flag to inform `type()` to return legacy types
}

export interface Unboxable {
    unbox(): BrsType;
    copy(): BrsType;
}

export function isBoxable(value: BrsType): value is BrsType & Boxable {
    return value !== undefined && "box" in value && "literal" in value && "legacy" in value;
}

/**
 * How a member gets into a container, which decides what `type()` reports for it (device-verified in
 * `test/simulator/probes/type-legacy-probe`):
 * - `build`: the runtime fills the container (`ParseJson`, `Slice`, `Items`, `Append`, a node field copy, …):
 *   the member keeps the type it reports.
 * - `add`: a container literal or an add (`Push`, `Unshift`, `AddTail`, `AddHead`, any associative array
 *   assignment): numbers and booleans report their legacy name (`roInteger`, `roBoolean`, …).
 * - `assign`: an array or list index assignment (`a[i] = x`): numbers and booleans report their plain name.
 *
 * Strings follow one rule in every case: a literal reports `roString`, a computed string `String`.
 */
export type MemberStore = "build" | "add" | "assign";

/**
 * The value a container stores for `value`. The variable a value came from keeps its own `type()`, so a member
 * that has to report differently is stored as a flagged copy; the shared `true`/`false`/`invalid` instances are
 * never changed.
 * @param value Member being stored.
 * @param store How the member is stored.
 * @param legacyInvalid True for arrays and lists, where an added `invalid` reports `roInvalid`.
 * @returns The member to store.
 */
export function containerMember<T extends BrsType>(value: T, store: MemberStore = "build", legacyInvalid = false): T {
    if (!isBoxable(value)) {
        return value;
    }
    switch (value.kind) {
        case ValueKind.Invalid: {
            if (store === "build") {
                return value;
            }
            return (store === "add" && legacyInvalid ? BrsInvalid.Legacy : BrsInvalid.Instance) as unknown as T;
        }
        case ValueKind.Boolean:
        case ValueKind.Int32:
        case ValueKind.Int64:
        case ValueKind.Float:
        case ValueKind.Double: {
            if (store === "add") {
                return value.literal && value.legacy ? value : withFlags(value, true, true);
            } else if (store === "assign") {
                return value.literal ? withFlags(value, false, false) : value;
            }
            break;
        }
        case ValueKind.String:
            break;
        default:
            return value;
    }
    return value.literal && !value.legacy ? withFlags(value, true, true) : value;
}

/**
 * A copy of a primitive with the given flags.
 * @param value Primitive to copy.
 * @param literal Copy's `literal` flag.
 * @param legacy Copy's `legacy` flag.
 * @returns The copy.
 */
function withFlags<T extends BrsType>(value: T, literal: boolean, legacy: boolean): T {
    switch (value.kind) {
        case ValueKind.String:
            return new BrsString(value.value, literal, legacy) as T;
        case ValueKind.Int32:
            return new Int32(value.getValue(), literal, legacy) as T;
        case ValueKind.Int64:
            return new Int64(value.getValue(), literal, legacy) as T;
        case ValueKind.Float:
            return new Float(value.getValue(), literal, legacy) as T;
        case ValueKind.Double:
            return new Double(value.getValue(), literal, legacy) as T;
        case ValueKind.Boolean:
            return (
                literal ? BrsBoolean.fromLiteral(value.toBoolean(), legacy) : BrsBoolean.from(value.toBoolean())
            ) as T;
        default:
            return value;
    }
}

export function isUnboxable(value: BrsType): value is BrsType & Unboxable {
    return value !== undefined && "unbox" in value && "copy" in value;
}

/**
 * The member a node field copy stores for `value`, mirroring Roku's literal-aware rule: the no-box kinds are
 * stored as a literal legacy copy, a computed value or one of the to-box kinds is stored boxed.
 *
 * The two kind lists differ between `RoArray` and `RoAssociativeArray` (device-derived in #979:
 * `Double` boxes in an AA but not an array, `String` the reverse), so they are passed in rather than
 * baked in — keeping the one interesting asymmetry visible at the two call sites.
 * @param value Member being copied.
 * @param noBoxKinds Kinds that are stored as literal legacy values, unboxed.
 * @param toBoxKinds Kinds that are always boxed.
 * @returns The member to store in the copy.
 */
export function fieldCopyMember(value: BrsType & Boxable, noBoxKinds: ValueKind[], toBoxKinds: ValueKind[]): BrsType {
    if (noBoxKinds.includes(value.kind)) {
        return value.literal && value.legacy ? value : withFlags(value, true, true);
    }
    return !value.literal || toBoxKinds.includes(value.kind) ? value.box() : value;
}
