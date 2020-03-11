import { BrsComponent } from "./components/BrsComponent";
import { BrsValue, BrsType, ValueKind } from "./";

export interface Boxable {
    box(): BrsType;
}

export interface Unboxable {
    unbox(): BrsType;
}

export function isBoxable(value: BrsType): value is BrsType & Boxable {
    return "box" in value;
}

export function isUnboxable(value: BrsType): value is BrsType & Unboxable {
    return "unbox" in value;
}
