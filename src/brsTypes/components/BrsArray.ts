import { BrsValue, ValueKind, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsType } from "..";
import { BrsComponent, BrsIterable } from "./BrsComponent";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";

export class BrsArray extends BrsComponent implements BrsValue, BrsIterable {
    readonly kind = ValueKind.Object;
    private elements: BrsType[];

    constructor(elements: BrsType[]) {
        super("roArray");
        this.elements = elements;
        this.registerMethods([
            this.peek,
            this.pop,
            this.push,
            this.clear,
            this.shift
        ]);
    }

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
        switch (index.kind) {
            case ValueKind.Int32:
                return this.getElements()[index.getValue()] || BrsInvalid.Instance;
            case ValueKind.String:
                return this.getMethod(index.value) || BrsInvalid.Instance;
            default:
                throw new Error("Array indexes must be 32-bit integers, or method names must be strings");
        }
    }

    set(index: BrsType, value: BrsType) {
        if (index.kind !== ValueKind.Int32) {
            throw new Error("Array indexes must be 32-bit integers");
        }

        this.elements[index.getValue()] = value;

        return BrsInvalid.Instance;
    }

    private clear = new Callable(
        "clear",
        {
            signature: {
                args: [],
                returns: ValueKind.Void
            },
            impl: (interpreter: Interpreter) => {
                this.elements = [];
                return BrsInvalid.Instance;
            }
        }
    );

    private push = new Callable(
        "push",
        {
            signature: {
                args: [
                    { name: "tvalue", type: ValueKind.Dynamic }
                ],
                returns: ValueKind.Void
            },
            impl: (interpreter: Interpreter, tvalue: BrsType) => {
                this.elements.push(tvalue);
                return BrsInvalid.Instance;
            }
        }
    );

    private pop = new Callable(
        "pop",
        {
            signature: {
                args: [],
                returns: ValueKind.Dynamic
            },
            impl: (interpreter: Interpreter) => {
                return this.elements.pop() || BrsInvalid.Instance;
            }
        }
    );

    private peek = new Callable(
        "peek",
        {
            signature: {
                args: [],
                returns: ValueKind.Dynamic
            },
            impl: (interpreter: Interpreter) => {
                return this.elements[this.elements.length - 1] || BrsInvalid.Instance;
            }
        }
    );

    private shift = new Callable(
        "shift",
        {
            signature: {
                args: [],
                returns: ValueKind.Dynamic
            },
            impl: (interpreter: Interpreter) => {
                return this.elements.shift() || BrsInvalid.Instance;
            }
        }
    );

    // TODO: implement append!
}
