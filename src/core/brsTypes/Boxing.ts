import { BrsType } from ".";

export interface Boxable {
    box(): BrsType;
    legacy: boolean; // Flag to inform `type()` to return legacy types
}

export interface Unboxable {
    unbox(): BrsType;
    copy(): BrsType;
}

export function isBoxable(value: BrsType): value is BrsType & Boxable {
    return "box" in value && "legacy" in value;
}

export function isUnboxable(value: BrsType): value is BrsType & Unboxable {
    return "unbox" in value && "copy" in value;
}
