import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsComponent, BrsIterable } from "./BrsComponent";
import { BrsType } from "..";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";

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

        this.registerMethods([
            this.clear,
            this.delete,
            this.addreplace,
            this.count
        ]);
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

        // TODO: this works for now, in that a property with the same name as a method essentially
        // overwrites the method. The only reason this doesn't work is that getting a method from an
        // associative array and _not_ calling it returns `invalid`, but calling it returns the
        // function itself. I'm not entirely sure why yet, but it's gotta have something to do with
        // how methods are implemented within RBI.
        //
        // Are they stored separately from elements, like they are here? Or does
        // `Interpreter#visitCall` need to check for `invalid` in its callable, then try to find a
        // method with the desired name separately? That last bit would work but it's pretty gross.
        // That'd allow roArrays to have methods with the methods not accessible via `arr["count"]`.
        // Same with AssociativeArrays I guess.
        return this.elements.get(index.value) || this.getMethod(index.value) || BrsInvalid.Instance;
    }

    set(index: BrsType, value: BrsType) {
        if (index.kind !== ValueKind.String) {
            throw new Error("Associative array indexes must be strings");
        }

        this.elements.set(index.value, value);
        return BrsInvalid.Instance;
    }

    /** Removes all elements from the associative array */
    private clear = new Callable(
        "clear",
        {
            signature: {
                args: [],
                returns: ValueKind.Void
            },
            impl: (interpreter: Interpreter) => {
                this.elements.clear();
                return BrsInvalid.Instance;
            }
        }
    );
    
    /** Removes a given item from the associative array */
    private delete = new Callable(
        "delete",
        {
            signature: {
                args: [
                    { name: "str", type: ValueKind.String }
                ],
                returns: ValueKind.Boolean
            },
            impl: (interpreter: Interpreter, str: BrsString) => {
                this.elements.delete(str.value);
                return BrsInvalid.Instance;
            }
        }
    );

    private addreplace = new Callable(
        "addreplace",
        {
            signature: {
                args: [
                    { name: "key", type: ValueKind.String },
                    { name: "value", type: ValueKind.Dynamic }
                ],
                returns: ValueKind.Void
            },
            impl: (interpreter: Interpreter, key: BrsString, value: BrsType) => {
                this.set(key, value);
                return BrsInvalid.Instance;
            }
        }
    );

    private count = new Callable(
        "count",
        {
            signature: {
                args: [],
                returns: ValueKind.Int32
            },
            impl: (interpreter: Interpreter) => {
                return new Int32(this.elements.size);
            }
        }
    );
}
