import { BrsValue, ValueKind, BrsBoolean } from "../BrsType";
import { BrsType } from "..";
import { BrsComponent } from "./BrsComponent";

export class BrsArray implements BrsValue, BrsComponent {
    readonly kind = ValueKind.Array;

    constructor(readonly elements: BrsType[]) { }

    toString() {
        return "roArray";
    }

    lessThan(other: BrsType) {
        return BrsBoolean.False;
    }

    greaterThan(other: BrsType) {
        return BrsBoolean.False;
    }

    equalTo(other: BrsType) {
        if (other.kind === ValueKind.Array) {
            return BrsBoolean.from(this.elements === other.elements);
        }

        return BrsBoolean.False;
    }

    getValue() {
        return this.elements;
    }
}