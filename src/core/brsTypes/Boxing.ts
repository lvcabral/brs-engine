import { BrsType, isNumberKind } from ".";
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
 * The value a container (array, list or associative array) stores for `value`. A primitive inside a container
 * reports its legacy type name to `type()` (`roInteger`, `roString`, …) while the variable it came from keeps its
 * own (`Integer`, `String`, …), as on a device: so a fresh primitive is stored as a legacy-flagged copy instead of
 * flagging the caller's value. Shared instances (`true`/`false`, `invalid`) and functions are flagged in place, as
 * identity checks elsewhere rely on them.
 * @param value Member being stored.
 * @returns The member to store.
 */
export function containerMember<T extends BrsType>(value: T): T {
    if (!isBoxable(value) || value.legacy) {
        return value;
    }
    const fresh =
        value.kind === ValueKind.String ||
        value.kind === ValueKind.Int32 ||
        value.kind === ValueKind.Int64 ||
        value.kind === ValueKind.Float ||
        value.kind === ValueKind.Double ||
        (value.kind === ValueKind.Boolean && value.literal);
    if (!fresh) {
        value.legacy = true;
        return value;
    }
    const copy = Object.assign(Object.create(Object.getPrototypeOf(value)), value) as T & Boxable;
    copy.legacy = true;
    return copy;
}

/**
 * A legacy number written into a container literal reports its legacy type name (a Roku edge case for `type()`):
 * returns a copy flagged `literal`, so the value the caller holds keeps reporting its own type.
 * @param value Member of an array or associative array literal.
 * @returns The member to store.
 */
export function literalMember<T extends BrsType>(value: T): T {
    if (!isBoxable(value) || !isNumberKind(value.kind) || !value.legacy || value.literal) {
        return value;
    }
    const copy = Object.assign(Object.create(Object.getPrototypeOf(value)), value) as T & Boxable;
    copy.literal = true;
    return copy;
}

export function isUnboxable(value: BrsType): value is BrsType & Unboxable {
    return value !== undefined && "unbox" in value && "copy" in value;
}

/**
 * Decides whether a container member should be stored boxed when a node field is copied, mirroring
 * Roku's literal-aware rule. Note it MUTATES `value`'s `literal`/`legacy` flags for the no-box kinds —
 * that is deliberate and load-bearing for `Type()` reporting.
 *
 * The two kind lists differ between `RoArray` and `RoAssociativeArray` (device-derived in #979:
 * `Double` boxes in an AA but not an array, `String` the reverse), so they are passed in rather than
 * baked in — keeping the one interesting asymmetry visible at the two call sites.
 * @param value Member being copied.
 * @param noBoxKinds Kinds that are marked literal/legacy and left unboxed.
 * @param toBoxKinds Kinds that are always boxed.
 * @returns True when the member should be stored as its boxed form.
 */
export function boxForFieldCopy(
    value: Boxable & { kind: ValueKind },
    noBoxKinds: ValueKind[],
    toBoxKinds: ValueKind[]
): boolean {
    if (noBoxKinds.includes(value.kind)) {
        value.literal = true;
        value.legacy = true;
    }
    return !value.literal || toBoxKinds.includes(value.kind);
}
