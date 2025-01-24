import { BrsComponent } from "./BrsComponent";
import { ValueKind, BrsString, BrsValue, BrsBoolean } from "../BrsType";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RoSGNode } from "./RoSGNode";
import { BrsType, RoAssociativeArray } from "..";

export class RoSGNodeEvent extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;

    constructor(
        readonly node: RoSGNode,
        readonly fieldName: BrsString,
        readonly fieldValue: BrsType,
        readonly infoFields?: RoAssociativeArray
    ) {
        super("roSGNodeEvent");
        this.appendMethods([
            this.getData,
            this.getField,
            this.getRoSGNode,
            this.getNode,
            this.getInfo,
        ]);
    }

    equalTo(other: BrsType) {
        // RBI doesn't allow events to be compared.
        return BrsBoolean.False;
    }

    toString() {
        return "<Component: roSGNodeEvent>";
    }

    /** Retrieves the new field value at the time of the change. */
    private getData = new Callable("getdata", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.fieldValue;
        },
    });

    /** Retrieves the name of the field that changed. */
    private getField = new Callable("getfield", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.fieldName;
        },
    });

    /** Retrieves a pointer to the node. This can be used for nodes without an ID. */
    private getRoSGNode = new Callable("getrosgnode", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.node;
        },
    });

    /** Retrieves the ID of the node that changed. */
    private getNode = new Callable("getnode", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.node.get(new BrsString("id"));
        },
    });

    /** Retrieves an AA that contains the values of selected "context" fields. */
    private getInfo = new Callable("getinfo", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.infoFields ?? new RoAssociativeArray([]);
        },
    });
}
