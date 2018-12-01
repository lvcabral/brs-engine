import { BrsValue, ValueKind, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsType } from "..";
import { BrsComponent, BrsIterable } from "./BrsComponent";

export class BrsArray implements BrsValue, BrsComponent, BrsIterable {
    readonly kind = ValueKind.Array;

    constructor(readonly elements: BrsType[]) { }

    toString(parent?: BrsType): string {
        if (parent) {
            return "<Component: roArray>";
        }

        return [
            "<Component: roArray> =",
            "[",
            ...this.elements.map((el: BrsValue) => `    ${el.toString(this)}`),
            "]"
        ].join("\n");
    }

    lessThan(other: BrsType) {
        return BrsBoolean.False;
    }

    greaterThan(other: BrsType) {
        return BrsBoolean.False;
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    getValue() {
        return this.elements;
    }

    getElements() {
        return this.elements.slice();
    }

    get(index: BrsType) {
        if (index.kind !== ValueKind.Int32) {
            throw new Error("Array indexes must be 32-bit integers");
        }

        return this.getElements()[index.getValue()] || BrsInvalid.Instance;
    }

    set(index: BrsType, value: BrsType) {
        if (index.kind !== ValueKind.Int32) {
            throw new Error("Array indexes must be 32-bit integers");
        }

        this.elements[index.getValue()] = value;

        return BrsInvalid.Instance;
    }
}