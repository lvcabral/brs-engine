import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsComponent, BrsIterable } from "./BrsComponent";
import { BrsType, isBoxable, isUnboxable } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { RoArray } from "./RoArray";
import { IfEnum } from "../interfaces/IfEnum";
import { BrsDevice } from "../../device/BrsDevice";

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
    enumIndex: number;
    /** Maps lowercased element name to original name used in this.elements.
     * Main benefit of it is fast, case-insensitive access.
     */
    keyMap = new Map<string, Set<string>>();
    private modeCaseSensitive: boolean = false;

    constructor(elements: AAMember[]) {
        super("roAssociativeArray");
        elements.forEach((member) => {
            this.addChildRef(member.value);
            this.set(member.name, member.value, true);
        });
        this.enumIndex = elements.length ? 0 : -1;
        const ifEnum = new IfEnum(this);
        this.registerMethods({
            ifAssociativeArray: [
                this.clear,
                this.delete,
                this.addReplace,
                this.count,
                this.doesExist,
                this.append,
                this.keys,
                this.items,
                this.lookup,
                this.lookupCI,
                this.setModeCaseSensitive,
            ],
            ifEnum: [ifEnum.isEmpty, ifEnum.isNext, ifEnum.next, ifEnum.reset],
        });
    }

    toString(parent?: BrsType): string {
        if (parent) {
            return "<Component: roAssociativeArray>";
        }

        return [
            "<Component: roAssociativeArray> =",
            "{",
            ...Array.from(this.elements.entries())
                .sort()
                .map(([key, value]) => `    ${key}: ${value.toString(this)}`),
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
        if (isUnboxable(index)) {
            index = index.unbox();
        }
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
        return this.findElement(index.value, isCaseSensitive) || this.getMethod(index.value) || BrsInvalid.Instance;
    }

    set(index: BrsType, value: BrsType, isCaseSensitive = false) {
        if (isUnboxable(index)) {
            index = index.unbox();
        }
        if (index.kind !== ValueKind.String) {
            throw new Error("Associative array indexes must be strings");
        }
        // override old key with new one
        let oldKey = this.findElementKey(index.value);
        this.addChildRef(value);
        if (oldKey) this.removeChildRef(this.elements.get(oldKey));
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

    hasNext() {
        return BrsBoolean.from(this.enumIndex >= 0);
    }

    getNext() {
        const keys = Array.from(this.elements.keys());
        const index = this.enumIndex;
        if (index >= 0) {
            this.enumIndex++;
            if (this.enumIndex >= keys.length) {
                this.enumIndex = -1;
            }
        }
        const next = keys[index];
        return next ? new BrsString(next) : BrsInvalid.Instance;
    }

    resetNext() {
        this.enumIndex = this.elements.size > 0 ? 0 : -1;
    }

    updateNext() {
        const keys = Array.from(this.elements.keys());
        const hasItems = keys.length > 0;
        if (this.enumIndex === -1 && hasItems) {
            this.enumIndex = 0;
        } else if (this.enumIndex >= keys.length || !hasItems) {
            this.enumIndex = -1;
        }
    }

    dispose() {
        this.elements.forEach((element) => {
            this.removeChildRef(element);
        });
    }

    addChildRef(value: BrsType | undefined) {
        if (value instanceof BrsComponent) {
            value.addReference();
        } else if (value && isBoxable(value)) {
            value.inArray = true;
        }
    }

    removeChildRef(value: BrsType | undefined) {
        if (value instanceof BrsComponent) {
            value.removeReference();
        }
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
    private readonly clear = new Callable("clear", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.elements.forEach((element) => {
                this.removeChildRef(element);
            });
            this.elements.clear();
            this.keyMap.clear();
            this.enumIndex = -1;
            return BrsInvalid.Instance;
        },
    });

    /** Removes a given item from the associative array */
    private readonly delete = new Callable("delete", {
        signature: {
            args: [new StdlibArgument("str", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, str: BrsString) => {
            let key = this.findElementKey(str.value, this.modeCaseSensitive);
            if (key) {
                this.removeChildRef(this.elements.get(key));
            }
            let deleted = key ? this.elements.delete(key) : false;

            let lKey = str.value.toLowerCase();
            if (this.modeCaseSensitive) {
                let keySet = this.keyMap.get(lKey);
                if (keySet && key) {
                    keySet?.delete(key);
                }
                if (keySet?.size === 0) {
                    this.keyMap.delete(lKey);
                }
            } else {
                this.keyMap.delete(lKey);
            }
            this.updateNext();
            return BrsBoolean.from(deleted);
        },
    });

    /** Given a key and value, adds an item to the associative array if it doesn't exist
     * Or replaces the value of a key that already exists in the associative array
     */
    private readonly addReplace = new Callable("addReplace", {
        signature: {
            args: [new StdlibArgument("key", ValueKind.String), new StdlibArgument("value", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, key: BrsString, value: BrsType) => {
            this.set(key, value, /* isCaseSensitive */ true);
            this.updateNext();
            return BrsInvalid.Instance;
        },
    });

    /** Returns the number of items in the associative array */
    private readonly count = new Callable("count", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.elements.size);
        },
    });

    /** Returns a boolean indicating whether or not a given key exists in the associative array */
    private readonly doesExist = new Callable("doesExist", {
        signature: {
            args: [new StdlibArgument("str", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, str: BrsString) => {
            let key = this.findElementKey(str.value, this.modeCaseSensitive);
            return key && this.elements.has(key) ? BrsBoolean.True : BrsBoolean.False;
        },
    });

    /** Appends a new associative array to another. If two keys are the same, the value of the original AA is replaced with the new one. */
    private readonly append = new Callable("append", {
        signature: {
            args: [new StdlibArgument("obj", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, obj: BrsComponent) => {
            if (!(obj instanceof RoAssociativeArray)) {
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roAssociativeArray.Append: invalid parameter type ${obj.getComponentName()}: ${interpreter.formatLocation()}`
                );
                return BrsInvalid.Instance;
            }

            obj.elements.forEach((value, key) => {
                this.set(new BrsString(key), value, true);
            });
            this.updateNext();

            return BrsInvalid.Instance;
        },
    });

    /** Returns an array of keys from the associative array in lexicographical order */
    private readonly keys = new Callable("keys", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return new RoArray(this.getElements());
        },
    });

    /** Returns an array of values from the associative array in lexicographical order */
    private readonly items = new Callable("items", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
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
    private readonly lookup = new Callable("lookup", {
        signature: {
            args: [new StdlibArgument("key", ValueKind.String)],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter, key: BrsString) => {
            return this.get(key, true);
        },
    });

    /** Given a key, returns the value associated with that key. This method always is case insensitive. */
    private readonly lookupCI = new Callable("lookupCI", {
        signature: {
            args: [new StdlibArgument("key", ValueKind.String)],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter, key: BrsString) => {
            return this.get(key);
        },
    });

    /** Changes the sensitive case method for lookups */
    private readonly setModeCaseSensitive = new Callable("setModeCaseSensitive", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.modeCaseSensitive = true;
            return BrsInvalid.Instance;
        },
    });
}
