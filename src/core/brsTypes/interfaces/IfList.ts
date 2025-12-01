import { BrsBoolean, BrsInvalid, ValueKind, BrsType, RoArray } from "..";
import { BrsComponent } from "../components/BrsComponent";
import { Interpreter } from "../../interpreter";
import { Callable, StdlibArgument } from "../Callable";
import { BrsArray } from "./IfArray";

/**
 * BrightScript Interface ifList
 * https://developer.roku.com/docs/references/brightscript/interfaces/iflist.md
 */
export class IfList {
    private readonly component: BrsComponent & BrsList;

    constructor(component: BrsComponent & BrsList) {
        this.component = component;
    }

    /** Adds typed value to head of list */
    readonly addHead = new Callable("addHead", {
        signature: {
            args: [new StdlibArgument("tvalue", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, tvalue: BrsType) => {
            this.component.add(tvalue, false);
            return BrsInvalid.Instance;
        },
    });

    /** Adds typed value to tail of list */
    readonly addTail = new Callable("addTail", {
        signature: {
            args: [new StdlibArgument("tvalue", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, tvalue: BrsType) => {
            const elements = this.component.getValue();
            elements.push(tvalue);
            return BrsInvalid.Instance;
        },
    });

    /** Gets the entry at head of list and keep entry in list */
    readonly getHead = new Callable("getHead", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            const elements = this.component.getValue();
            return elements[0] || BrsInvalid.Instance;
        },
    });

    /** Gets the Object at tail of List and keep Object in list */
    readonly getTail = new Callable("getTail", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            const elements = this.component.getValue();
            return elements[this.component.tail()] || BrsInvalid.Instance;
        },
    });

    /** Removes entry at head of list */
    readonly removeHead = new Callable("removeHead", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.component.remove(0) || BrsInvalid.Instance;
        },
    });

    /** Removes entry at tail of list */
    readonly removeTail = new Callable("removeTail", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.component.remove(this.component.tail()) || BrsInvalid.Instance;
        },
    });

    /** Resets the current index or position in list to the head element */
    readonly resetIndex = new Callable("resetIndex", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.component.resetCurrent());
        },
    });

    /** Gets the entry at current index or position from the list and increments the index or position in the list */
    readonly getIndex = new Callable("getIndex", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.component.getCurrent() ?? BrsInvalid.Instance;
        },
    });

    /** Removes the entry at the current index or position from the list and increments the index or position in the list */
    readonly removeIndex = new Callable("removeIndex", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.component.remove(this.component.listIndex) || BrsInvalid.Instance;
        },
    });
}

/**
 * Interface IfListToArray
 * https://developer.roku.com/docs/references/brightscript/interfaces/iflisttoarray.md
 */
export class IfListToArray {
    readonly kind = ValueKind.Object;
    private readonly component: BrsComponent & BrsArray;

    constructor(component: BrsComponent & BrsArray) {
        this.component = component;
    }
    /** Returns an roArray containing the same elements as the list */
    readonly toArray = new Callable("toArray", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return new RoArray(this.component.getValue());
        },
    });
}

export interface BrsList extends BrsArray {
    readonly listIndex: number;

    getCurrent(): BrsType;

    resetCurrent(): boolean;
}
