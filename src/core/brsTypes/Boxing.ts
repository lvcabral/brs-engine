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
 * `test/simulator/probes/type-legacy-probe` and `collection-index-probe`):
 * - `build`: the runtime fills the container (`ParseJson`, `Slice`, `Items`, `Append`, a node field copy, …):
 *   the member keeps the type it reports.
 * - `add`: a container literal or an add (`Push`, `Unshift`, `AddTail`, `AddHead`, any associative array
 *   assignment, `SetEntry`): numbers and booleans report their legacy name (`roInteger`, `roBoolean`, …).
 * - `assign`: an array or list index assignment (`a[i] = x`): numbers, booleans and strings report their plain
 *   name.
 *
 * Otherwise a literal string reports `roString` and a computed string `String`.
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
    if (store === "build" || !isBoxable(value)) {
        return value;
    }
    switch (value.kind) {
        case ValueKind.Invalid:
            return (store === "add" && legacyInvalid ? BrsInvalid.Legacy : BrsInvalid.Instance) as unknown as T;
        case ValueKind.Boolean:
        case ValueKind.Int32:
        case ValueKind.Int64:
        case ValueKind.Float:
        case ValueKind.Double:
            return store === "add" ? asLegacyLiteral(value) : asPlain(value);
        case ValueKind.String:
            if (store === "assign") {
                return asPlain(value);
            }
            return value.literal ? asLegacyLiteral(value) : value;
        default:
            return value;
    }
}

/**
 * `value` as a literal that reports its legacy type name (`roInteger`, `roString`, …).
 * @param value Primitive to flag.
 * @returns `value` when it already is one, otherwise a flagged copy.
 */
function asLegacyLiteral<T extends BrsType>(value: T & Boxable): T {
    if (value.literal && value.legacy) {
        return value;
    }
    switch (value.kind) {
        case ValueKind.String:
            return new BrsString(value.value, true, true) as T;
        case ValueKind.Int32:
            return new Int32(value.getValue(), true, true) as T;
        case ValueKind.Int64:
            return new Int64(value.getValue(), true, true) as T;
        case ValueKind.Float:
            return new Float(value.getValue(), true, true) as T;
        case ValueKind.Double:
            return new Double(value.getValue(), true, true) as T;
        case ValueKind.Boolean:
            return (value.toBoolean() ? BrsBoolean.LegacyTrue : BrsBoolean.LegacyFalse) as T;
        default:
            return value;
    }
}

/**
 * `value` as a computed value, which reports its plain type name (`Integer`, `Boolean`, `String`, …).
 * @param value Number, boolean or string.
 * @returns `value` when it is not a literal, otherwise an unflagged copy.
 */
function asPlain<T extends BrsType>(value: T & Boxable): T {
    if (!value.literal) {
        return value;
    }
    switch (value.kind) {
        case ValueKind.String:
            return new BrsString(value.value) as T;
        case ValueKind.Int32:
            return new Int32(value.getValue()) as T;
        case ValueKind.Int64:
            return new Int64(value.getValue()) as T;
        case ValueKind.Float:
            return new Float(value.getValue()) as T;
        case ValueKind.Double:
            return new Double(value.getValue()) as T;
        case ValueKind.Boolean:
            return BrsBoolean.from(value.toBoolean()) as T;
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
        return asLegacyLiteral(value);
    }
    return !value.literal || toBoxKinds.includes(value.kind) ? value.box() : value;
}
