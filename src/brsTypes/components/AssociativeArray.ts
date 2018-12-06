import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsComponent, BrsIterable } from "./BrsComponent";
import { BrsType } from "..";

/** A member of an `AssociativeArray` in BrightScript. */
export interface AAMember {
    /** The member's name. */
    name: BrsString,
    /** The value associated with `name`. */
    value: BrsType
}

export class AssociativeArray extends BrsComponent implements BrsValue, BrsIterable {
    readonly kind = ValueKind.Object;
    private elements = new Map<string, BrsType>();

    constructor(elements: AAMember[]) {
        super("roAssociativeArray");
        elements.forEach(member => this.elements.set(member.name.value, member.value));
    }

    toString(parent?: BrsType): string {
        if (parent) {
            return "<Component: roAssociativeArray>";
        }

        return [
            "<Component: roAssociativeArray> =",
            "{",
            ...Array.from(this.elements.keys())
                    .map(key => `    ${key}: ${this.elements.get(key)!.toString(this)}`),
            "}"
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
        return Array.from(this.elements.keys())
            .sort()
            .map(key => new BrsString(key));
    }

    get(index: BrsType) {
        if (index.kind !== ValueKind.String) {
            throw new Error("Associative array indexes must be strings");
        }

        return this.elements.get(index.value) || BrsInvalid.Instance;
    }

    set(index: BrsType, value: BrsType) {
        if (index.kind !== ValueKind.String) {
            throw new Error("Associative array indexes must be strings");
        }

        this.elements.set(index.value, value);
        return BrsInvalid.Instance;
    }
}
