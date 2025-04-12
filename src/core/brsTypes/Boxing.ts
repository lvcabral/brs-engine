import { BrsType } from ".";

export interface Boxable {
    box(): BrsType;
    inArray: boolean; // Flag to inform `type()` to return legacy types
}

export interface Unboxable {
    unbox(): BrsType;
}

export function isBoxable(value: BrsType): value is BrsType & Boxable {
    return "box" in value && "inArray" in value;
}

export function isUnboxable(value: BrsType): value is BrsType & Unboxable {
    return "unbox" in value;
}
