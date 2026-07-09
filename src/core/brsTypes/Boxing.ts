import { BrsType } from ".";

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
