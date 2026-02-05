import {
    BrsBoolean,
    BrsString,
    BrsType,
    BrsValue,
    isBrsString,
    RoArray,
    ValueKind,
    Callable,
    Interpreter,
    SyncType,
    StdlibArgument,
    Int32,
    RoMessagePort,
    BrsInvalid,
} from "brs-engine";
import { FieldKind } from "../SGTypes";
import { Node } from "../nodes/Node";
import { sgRoot } from "../SGRoot";
import { SGNodeType } from ".";

/**
 * Base implementation for a SceneGraph node that is used in task threads to perform remote field and method requests.
 */
export class RemoteNode extends Node implements BrsValue {
    /**
     * Creates a new remote node instance.
     * @param nodeSubtype Concrete subtype identifier used for serialization and debugging.
     * @param syncType Sync type used for remote field and method requests.
     */
    constructor(readonly nodeSubtype: string = SGNodeType.Node, readonly syncType: SyncType) {
        super([], nodeSubtype);
        this.owner = 0; // Remote node is always owned by render thread
        const methods = [this.hasField, this.observeField, this.getChildCount];
        this.overrideMethods(methods);
        postMessage(
            `debug, [node:${sgRoot.threadId}] Created RemoteNode of subtype "${this.nodeSubtype}" with sync type "${this.syncType}"`
        );
    }

    /**
     * @override
     * Looks up a field or method by name, mimicking BrightScript associative-array semantics.
     * @param index Field or method name as a BrightScript string value.
     * @throws Error when an unsupported index type is provided.
     * @returns Field value, method, or invalid when missing.
     */
    get(index: BrsType): BrsType {
        if (sgRoot.inTaskThread() && isBrsString(index)) {
            const key = index.toString().toLowerCase();
            const task = sgRoot.getCurrentThreadTask();
            if (this.fields.has(key)) {
                if (task?.active && !this.consumeFreshField(key)) {
                    task.requestFieldValue(this.syncType, key);
                }
            } else {
                const method = this.getMethod(key);
                if (method) {
                    return method;
                }
            }
        }
        return super.get(index);
    }

    /**
     * @override
     * Sets or aliases a field value, performing type validation and notification.
     * @param index Field name to update.
     * @param value New BrightScript value.
     * @param alwaysNotify When provided, controls observer notification behavior for new fields.
     * @param kind Optional explicit field kind used when creating new dynamic fields.
     * @param sync When true, synchronizes the field change to remote observers.
     */
    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind, sync: boolean = true) {
        postMessage(`debug, [node:${sgRoot.threadId}] RemoteNode.setValue() called for field "${index}"`);
        const fieldName = index.toLowerCase();
        super.setValue(index, value, alwaysNotify, kind);
        if (sync && this.changed) {
            this.syncRemoteObservers(fieldName, "global");
            this.changed = false;
        }
    }

    /**
     * @override
     * Remote node owner cannot be changed.
     */
    setOwner(_threadId: number): void {
        // Remote node owner cannot be changed
        return;
    }

    /**
     * Helper to perform a remote method call via the current task.
     * @param interpreter Current BrightScript interpreter.
     * @param methodName Name of the method to call.
     * @param args Arguments to pass to the remote method.
     * @returns Result of the remote method call, or undefined if not available.
     */
    private remoteMethodCall(interpreter: Interpreter, methodName: string, args?: BrsType[]): BrsType | undefined {
        let result: BrsType | undefined;
        const task = sgRoot.getCurrentThreadTask();
        if (task?.active) {
            let host = this.address;
            const hostNode = interpreter.environment.hostNode;
            if (hostNode instanceof Node) {
                host = hostNode.getAddress();
            }
            const payload = args ? { host, args } : { host };
            result = task.requestMethodCall(this.syncType, methodName, payload);
        }
        return result;
    }

    /**
     * @override
     * Returns true if the field exists
     * */
    protected readonly hasField = new Callable("hasField", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString) => {
            const result = this.remoteMethodCall(interpreter, "hasField", [fieldName]);
            return result ?? BrsBoolean.False;
        },
    });

    /**
     * @override
     * Registers a callback to be executed when the value of the field changes
     */
    protected readonly observeField = new Callable(
        "observeField",
        {
            signature: {
                args: [
                    new StdlibArgument("fieldName", ValueKind.String),
                    new StdlibArgument("functionName", ValueKind.String),
                    new StdlibArgument("infoFields", ValueKind.Object, BrsInvalid.Instance),
                ],
                returns: ValueKind.Boolean,
            },
            impl: (interpreter: Interpreter, fieldName: BrsString, funcName: BrsString, infoFields: RoArray) => {
                const result = this.remoteMethodCall(interpreter, "observeField", [fieldName, funcName, infoFields]);
                return result ?? BrsBoolean.False;
            },
        },
        {
            signature: {
                args: [
                    new StdlibArgument("fieldName", ValueKind.String),
                    new StdlibArgument("port", ValueKind.Object),
                    new StdlibArgument("infoFields", ValueKind.Object, BrsInvalid.Instance),
                ],
                returns: ValueKind.Boolean,
            },
            impl: (interpreter: Interpreter, fieldName: BrsString, port: RoMessagePort, infoFields: RoArray) => {
                const result = this.remoteMethodCall(interpreter, "observeField", [fieldName, port, infoFields]);
                return result ?? BrsBoolean.False;
            },
        }
    );

    /**
     * @override
     * Returns the current number of children in the subject node list of children.
     * This is always a non-negative number.
     */
    protected readonly getChildCount = new Callable("getChildCount", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (interpreter: Interpreter) => {
            const result = this.remoteMethodCall(interpreter, "getChildCount");
            return result ?? new Int32(0);
        },
    });
}
