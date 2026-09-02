import { BrsType } from ".";
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
