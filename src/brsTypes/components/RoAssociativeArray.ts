import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsComponent, BrsIterable } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { RoArray } from "./RoArray";

/** A member of an `AssociativeArray` in BrightScript. */
export interface AAMember {
    /** The member's name. */
    name: BrsString;
    /** The value associated with `name`. */
    value: BrsType;
}

export class RoAssociativeArray extends BrsComponent implements BrsValue, BrsIterable {
    readonly kind = ValueKind.Object;
    elements = new Map<string, BrsType>();
    /** Maps lowercased element name to original name used in this.elements.
     * Main benefit of it is fast, case-insensitive access.
     */
    keyMap = new Map<string, Set<string>>();
    private modeCaseSensitive: boolean = false;

    constructor(elements: AAMember[]) {
        super("roAssociativeArray");
        elements.forEach((member) => this.set(member.name, member.value, true));

        this.registerMethods({
            ifAssociativeArray: [
                this.clear,
                this.delete,
                this.addreplace,
                this.count,
                this.doesexist,
                this.append,
                this.keys,
                this.items,
                this.lookup,
                this.lookupCI,
                this.setmodecasesensitive,
            ],
            ifEnum: [this.isEmpty],
        });
    }

    toString(parent?: BrsType): string {
        if (parent) {
            return "<Component: roAssociativeArray>";
        }

        return [
            "<Component: roAssociativeArray> =",
            "{",
            ...Array.from(this.elements.entries()).map(
                ([key, value]) => `    ${key}: ${value.toString(this)}`
            ),
            "}",
        ].join("\n");
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
            .map((key) => new BrsString(key));
    }

    getValues() {
        return Array.from(this.elements.values())
            .sort()
            .map((value: BrsType) => value);
    }

    get(index: BrsType, isCaseSensitive = false) {
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
        // Same with RoAssociativeArrays I guess.
        return (
            this.findElement(index.value, isCaseSensitive) ||
            this.getMethod(index.value) ||
            BrsInvalid.Instance
        );
    }

    set(index: BrsType, value: BrsType, isCaseSensitive = false) {
        if (index.kind !== ValueKind.String) {
            throw new Error("Associative array indexes must be strings");
        }
        // override old key with new one
        let oldKey = this.findElementKey(index.value);
        if (!this.modeCaseSensitive && oldKey) {
            this.elements.delete(oldKey);
            this.keyMap.set(oldKey.toLowerCase(), new Set()); // clear key set cuz in insensitive mode we should have 1 key in set
        }

        let indexValue = isCaseSensitive ? index.value : index.value.toLowerCase();
        this.elements.set(indexValue, value);

        let lkey = index.value.toLowerCase();
        if (!this.keyMap.has(lkey)) {
            this.keyMap.set(lkey, new Set());
        }
        this.keyMap.get(lkey)?.add(indexValue);

        return BrsInvalid.Instance;
    }

    /** if AA is in insensitive mode, it means that we should do insensitive search of real key */
    private findElementKey(elementKey: string, isCaseSensitiveFind = false) {
        if (this.modeCaseSensitive && isCaseSensitiveFind) {
            return elementKey;
        } else {
            return this.keyMap.get(elementKey.toLowerCase())?.values().next().value;
        }
    }

    private findElement(elementKey: string, isCaseSensitiveFind = false) {
        let realKey = this.findElementKey(elementKey, isCaseSensitiveFind);
        return realKey !== undefined ? this.elements.get(realKey) : undefined;
    }

    /** Removes all elements from the associative array */
    private clear = new Callable("clear", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter) => {
            this.elements.clear();
            this.keyMap.clear();
            return BrsInvalid.Instance;
        },
    });

    /** Removes a given item from the associative array */
    private delete = new Callable("delete", {
        signature: {
            args: [new StdlibArgument("str", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, str: BrsString) => {
            let key = this.findElementKey(str.value, this.modeCaseSensitive);
            let deleted = key ? this.elements.delete(key) : false;

            let lKey = str.value.toLowerCase();
            if (this.modeCaseSensitive) {
                let keySet = this.keyMap.get(lKey);
                keySet?.delete(key);
                if (keySet?.size === 0) {
                    this.keyMap.delete(lKey);
                }
            } else {
                this.keyMap.delete(lKey);
            }
            return BrsBoolean.from(deleted);
        },
    });

    /** Given a key and value, adds an item to the associative array if it doesn't exist
     * Or replaces the value of a key that already exists in the associative array
     */
    private addreplace = new Callable("addreplace", {
        signature: {
            args: [
                new StdlibArgument("key", ValueKind.String),
                new StdlibArgument("value", ValueKind.Dynamic),
            ],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, key: BrsString, value: BrsType) => {
            this.set(key, value, /* isCaseSensitive */ true);
            return BrsInvalid.Instance;
        },
    });

    /** Returns the number of items in the associative array */
    private count = new Callable("count", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (interpreter: Interpreter) => {
            return new Int32(this.elements.size);
        },
    });

    /** Returns a boolean indicating whether or not a given key exists in the associative array */
    private doesexist = new Callable("doesexist", {
        signature: {
            args: [new StdlibArgument("str", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, str: BrsString) => {
            let strValue = this.modeCaseSensitive ? str.value : str.value.toLowerCase();
            let key = this.findElementKey(str.value, this.modeCaseSensitive);
            return key && this.elements.has(key) ? BrsBoolean.True : BrsBoolean.False;
        },
    });

    /** Appends a new associative array to another. If two keys are the same, the value of the original AA is replaced with the new one. */
    private append = new Callable("append", {
        signature: {
            args: [new StdlibArgument("obj", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, obj: BrsType) => {
            if (!(obj instanceof RoAssociativeArray)) {
                // TODO: validate against RBI
                return BrsInvalid.Instance;
            }

            obj.elements.forEach((value, key) => {
                this.set(new BrsString(key), value, true);
            });

            return BrsInvalid.Instance;
        },
    });

    /** Returns an array of keys from the associative array in lexicographical order */
    private keys = new Callable("keys", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            return new RoArray(this.getElements());
        },
    });

    /** Returns an array of values from the associative array in lexicographical order */
    private items = new Callable("items", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            return new RoArray(
                this.getElements().map((key: BrsString) => {
                    return new RoAssociativeArray([
                        {
                            name: new BrsString("key"),
                            value: key,
                        },
                        {
                            name: new BrsString("value"),
                            value: this.get(key),
                        },
                    ]);
                })
            );
        },
    });

    /** Given a key, returns the value associated with that key.
     * This method is case insensitive either-or case sensitive, depends on whether `setModeCasesensitive` was called or not.
     */
    private lookup = new Callable("lookup", {
        signature: {
            args: [new StdlibArgument("key", ValueKind.String)],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, key: BrsString) => {
            return this.get(key, true);
        },
    });

    /** Given a key, returns the value associated with that key. This method always is case insensitive. */
    private lookupCI = new Callable("lookupCI", {
        signature: {
            args: [new StdlibArgument("key", ValueKind.String)],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, key: BrsString) => {
            return this.get(key);
        },
    });

    /** Changes the sensitive case method for lookups */
    private setmodecasesensitive = new Callable("setModeCaseSensitive", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter) => {
            this.modeCaseSensitive = true;
            return BrsInvalid.Instance;
        },
    });

    //--------------------------------- ifEnum ---------------------------------

    /** Returns true if enumeration contains no elements, false otherwise	 */
    private isEmpty = new Callable("isEmpty", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter) => {
            return BrsBoolean.from(this.elements.size === 0);
        },
    });
}
