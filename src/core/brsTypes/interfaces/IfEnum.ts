import { BrsIterable } from "..";
import { Interpreter } from "../../interpreter";
import { BrsBoolean, BrsInvalid, ValueKind } from "../BrsType";
import { Callable } from "../Callable";

export class IfEnum {
    private readonly component: BrsIterable;

    constructor(component: BrsIterable) {
        this.component = component;
    }

    /** Checks whether the array contains no elements. */
    readonly isEmpty = new Callable("isEmpty", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.component.getElements().length === 0);
        },
    });

    /** Checks whether the current position is not past the end of the enumeration. */
    readonly isNext = new Callable("isNext", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return this.component.hasNext();
        },
    });

    /** Resets the current position to the first element of the enumeration. */
    readonly reset = new Callable("reset", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.component.resetNext();
            return BrsInvalid.Instance;
        },
    });

    /** Increments the position of an enumeration. */
    readonly next = new Callable("next", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.component.getNext() ?? BrsInvalid.Instance;
        },
    });
}
