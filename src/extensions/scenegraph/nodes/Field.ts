import {
    BrsBoolean,
    BrsComponent,
    BrsInvalid,
    BrsNumber,
    BrsString,
    BrsType,
    Double,
    FlexObject,
    Float,
    Int32,
    Int64,
    isAnyNumber,
    isBoxable,
    isBoxedNumber,
    isBrsBoolean,
    isBrsString,
    isInvalid,
    RoArray,
    RoAssociativeArray,
    RoMessagePort,
    ValueKind,
    Callable,
    Interpreter,
    Scope,
    BlockEnd,
    isStringComp,
    RuntimeError,
    DebugMode,
    Uninitialized,
    BrsDevice,
} from "brs-engine";
import { Node } from "./Node";
import { RoSGNodeEvent } from "../events/RoSGNodeEvent";
import { getValueKindFromFieldType } from "../factory/NodeFactory";
import { fromAssociativeArray, toAssociativeArray, jsValueOf } from "../factory/Serializer";
import { BrsCallback, FieldKind, isContentNode } from "../SGTypes";

export class Field {
    // Observer collections are allocated lazily. A node like ContentNode registers ~100 default
    // fields and is instantiated in the thousands (e.g. a TimeGrid EPG); eagerly allocating two
    // arrays + a Map per field wastes hundreds of MB on fields that are never observed. Almost all
    // fields have no observers, so these stay undefined until the first observeField.
    private permanentObservers?: BrsCallback[];
    private unscopedObservers?: BrsCallback[];
    private scopedObservers?: Map<Node, BrsCallback[]>;
    /** True while this field's observers are dispatching, to break re-entrant cascades. */
    private notifying = false;

    // ---- Roku-accurate deferred observer dispatch (per Worker thread) -------------------------
    // On a real Roku, a function-name field observer is dispatched from the owning thread's
    // message loop; it does NOT run reentrantly in the middle of another observer's execution.
    // We reproduce that: when a Callable observer would fire while another Callable observer is
    // already executing (reentrant) — and the notification is not part of a ContentNode
    // parentField cascade — we queue it and drain it FIFO once the outermost dispatch unwinds.
    // Same-field re-notification (`notifying`) and same-ContentNode re-entry (`propagating`) are
    // still suppressed before reaching this path, so the #904/#905/#943 cascades are unaffected.
    /** Depth of Callable observers currently executing on this thread (the reentrancy gate). */
    private static observerDepth = 0;
    /** >0 while inside `ContentNode.notifyParentFields`; disables deferral for cascade observers. */
    private static parentCascadeDepth = 0;
    /**
     * True while draining the deferred queue. Deferral happens only ONCE, at the boundary of the
     * original top-level handler; once we start draining, the reentrant cascade runs synchronously
     * (nested, with the normal per-field `notifying` stack) — the pre-existing behavior that
     * terminates same-field and cross-field observer cascades. Without this, flattening the nested
     * dispatch into a FIFO loses the guard nesting and two alwaysNotify fields whose observers write
     * each other (a manual field-alias ping-pong) loop forever.
     */
    private static draining = false;
    /** Deferred reentrant observer invocations, drained at the outermost unwind. */
    private static readonly deferredQueue: { field: Field; callback: BrsCallback; event: RoSGNodeEvent }[] = [];

    /** Marks entry into a ContentNode parentField cascade, so its observers dispatch inline. */
    static enterParentCascade() {
        Field.parentCascadeDepth++;
    }

    /** Marks exit from a ContentNode parentField cascade. */
    static exitParentCascade() {
        Field.parentCascadeDepth--;
    }

    /** Resets deferred-dispatch state between app runs so nothing leaks across setups. */
    static resetDispatch() {
        Field.observerDepth = 0;
        Field.parentCascadeDepth = 0;
        Field.draining = false;
        Field.deferredQueue.length = 0;
    }

    constructor(
        private readonly name: string = "",
        private value: BrsType,
        private readonly type: FieldKind,
        private readonly alwaysNotify: boolean = false,
        private readonly system: boolean = false,
        private hidden: boolean = false,
        private valueRef: boolean = false
    ) {
        this.value = this.convertValue(value);
    }

    toString(parent?: BrsType): string {
        return this.value.toString(parent);
    }

    /**
     * Returns whether or not the field is "hidden".
     *
     * The reason for this is that some fields (content metadata fields) are
     * by default "hidden". This means they are accessible on the
     * node without an access error, but they don't show up when you print the node.
     */
    isHidden() {
        return this.hidden;
    }

    setHidden(isHidden: boolean) {
        this.hidden = isHidden;
    }

    isSystem() {
        return this.system;
    }

    isAlwaysNotify() {
        return this.alwaysNotify;
    }

    isValueRef() {
        return this.valueRef;
    }

    getName(): string {
        return this.name;
    }

    getType(): FieldKind {
        return this.type;
    }

    getValue(unhide: boolean = true): BrsType {
        // Once a field is accessed, it is no longer hidden.
        if (unhide) {
            this.hidden = false;
        }

        return this.value;
    }

    setValue(value: BrsType, notify: boolean = true, byRef: boolean = false) {
        // Once a field is set, it is no longer hidden.
        this.hidden = false;

        // Set whether this field has a value by reference.
        this.valueRef = byRef;

        const oldValue = this.value;
        if (!byRef) {
            // Update parent field on content-capable nodes (e.g., ContentNode)
            if (isContentNode(oldValue)) {
                oldValue.removeParentField(this);
            }
            if (isContentNode(value)) {
                value.addParentField(this);
            }
            value = this.convertValue(value);
        }
        // Update field value and notify changes
        this.value = value;
        if (notify && (this.alwaysNotify || !this.isEqual(oldValue, value))) {
            this.notifyObservers();
            return true;
        }
        return false;
    }

    /**
     * Dispatches this field's observers synchronously (depth-first), matching Roku's
     * observer semantics. If an observer mutates other fields whose observers cascade back
     * to this same field while it is still dispatching, the re-entrant notification is
     * suppressed. This preserves ordering and sequential re-notifications (e.g. a field
     * legitimately notified twice within one cascade) while breaking the cyclic ContentNode
     * parentField cascades that overflowed the call stack (#904).
     */
    notifyObservers() {
        if (this.notifying) {
            return;
        }
        this.notifying = true;
        try {
            this.dispatchObservers();
        } finally {
            this.notifying = false;
        }
    }

    private dispatchObservers() {
        if (this.permanentObservers) {
            for (const observer of this.permanentObservers) {
                this.executeCallbacks(observer);
            }
        }
        if (this.unscopedObservers) {
            for (const observer of this.unscopedObservers) {
                this.executeCallbacks(observer);
            }
        }
        if (this.scopedObservers) {
            for (const [_node, callbacks] of this.scopedObservers) {
                for (const callback of callbacks) {
                    this.executeCallbacks(callback);
                }
            }
        }
    }

    canAcceptValue(value: BrsType) {
        // Objects are allowed to be set to invalid.
        const fieldIsObject = getValueKindFromFieldType(this.type) === ValueKind.Object;
        if (
            (fieldIsObject && isInvalid(value)) ||
            (isAnyNumber(this.value) && isAnyNumber(value)) ||
            (isBrsString(this.value) && isBrsString(value)) ||
            (isBrsString(this.value) && isAnyNumber(value)) ||
            (isBrsString(this.value) && isBrsBoolean(value)) ||
            (isBrsBoolean(this.value) && isBrsString(value))
        ) {
            return true;
        } else if (this.type === FieldKind.String && isStringComp(value)) {
            return true;
        } else if (this.type === FieldKind.StringArray && value instanceof RoArray) {
            return value.elements.every((element) => isBrsString(element));
        } else if (this.type === FieldKind.Node && value instanceof Node) {
            return true;
        } else if (this.type === FieldKind.Rect2D && value instanceof RoArray) {
            return value.elements.length === 4 && value.elements.every((element) => isAnyNumber(element));
        } else if (this.type === FieldKind.Rect2D && value instanceof RoAssociativeArray) {
            const valueObj = fromAssociativeArray(value);
            return (
                valueObj &&
                typeof valueObj.x === "number" &&
                typeof valueObj.y === "number" &&
                typeof valueObj.width === "number" &&
                typeof valueObj.height === "number"
            );
        } else if (this.type === FieldKind.Vector2D && value instanceof RoArray) {
            return value.elements.length === 2 && value.elements.every((element) => isAnyNumber(element));
        } else if (this.type === FieldKind.Vector2D && value instanceof RoAssociativeArray) {
            const valueObj = fromAssociativeArray(value);
            return valueObj && typeof valueObj.x === "number" && typeof valueObj.y === "number";
        } else if (this.type === FieldKind.Vector2DArray && value instanceof RoArray) {
            return (
                (value.elements.length === 2 && value.elements.every((element) => isAnyNumber(element))) ||
                value.elements.every(
                    (element) =>
                        element instanceof RoArray &&
                        element.elements.length === 2 &&
                        element.elements.every((item) => isAnyNumber(item))
                )
            );
        } else if (
            [FieldKind.FloatArray, FieldKind.IntArray, FieldKind.ColorArray, FieldKind.TimeArray].includes(this.type) &&
            (isAnyNumber(value) || value instanceof RoArray)
        ) {
            return true;
        } else if (this.type === FieldKind.BoolArray && (isBrsBoolean(value) || value instanceof RoArray)) {
            return true;
        }
        const result = this.type === FieldKind.fromBrsType(value);
        return result;
    }

    addObserver(
        mode: "permanent" | "unscoped" | "scoped",
        interpreter: Interpreter,
        observer: Callable | RoMessagePort,
        target: Node,
        fieldName: BrsString,
        infoFields?: RoArray
    ) {
        // Once a field is accessed, it is no longer hidden.
        this.hidden = false;
        const subscriber = (interpreter.environment.hostNode ?? target) as Node;
        let brsCallback: BrsCallback = {
            interpreter,
            environment: interpreter.environment,
            hostNode: subscriber,
            observer,
            eventParams: {
                node: target,
                fieldName,
                infoFields,
            },
        };
        if (mode === "scoped") {
            this.scopedObservers ??= new Map();
            const maybeCallbacks = this.scopedObservers.get(subscriber) || [];
            this.scopedObservers.set(subscriber, [...maybeCallbacks, brsCallback]);
        } else if (mode === "unscoped") {
            this.unscopedObservers ??= [];
            this.unscopedObservers.push(brsCallback);
        } else {
            this.permanentObservers ??= [];
            this.permanentObservers.push(brsCallback);
        }
    }

    getObserversWithPort(scope?: Node): BrsCallback[] {
        const observers: BrsCallback[] = [];
        if (this.unscopedObservers) {
            for (const callback of this.unscopedObservers) {
                if (callback.observer instanceof RoMessagePort) {
                    observers.push(callback);
                }
            }
        }
        if (this.scopedObservers) {
            for (const [node, callbacks] of this.scopedObservers) {
                if (scope !== undefined && node !== scope) {
                    continue;
                }
                for (const callback of callbacks) {
                    if (callback.observer instanceof RoMessagePort) {
                        observers.push(callback);
                    }
                }
            }
        }
        return observers;
    }

    removeUnscopedObservers() {
        this.unscopedObservers?.splice(0);
    }

    removeScopedObservers(scope: Node) {
        this.scopedObservers?.get(scope)?.splice(0);
        this.scopedObservers?.delete(scope);
    }

    clearObservers() {
        this.permanentObservers = undefined;
        this.unscopedObservers = undefined;
        this.scopedObservers = undefined;
    }

    isObserved() {
        return (
            (this.permanentObservers?.length ?? 0) > 0 ||
            (this.unscopedObservers?.length ?? 0) > 0 ||
            (this.scopedObservers?.size ?? 0) > 0
        );
    }

    isPortObserved(scope: Node) {
        return (
            (this.unscopedObservers?.some((callback) => callback.observer instanceof RoMessagePort) ?? false) ||
            (this.scopedObservers?.get(scope)?.some((callback) => callback.observer instanceof RoMessagePort) ?? false)
        );
    }

    private convertValue(value: BrsType) {
        if (isAnyNumber(value) && value.kind !== getValueKindFromFieldType(this.type)) {
            if (isBoxedNumber(value)) {
                value = value.unbox();
            }
            value = this.convertNumber(value);
        } else if (isBrsBoolean(value) && this.type === FieldKind.String) {
            value = new BrsString(value.toBoolean() ? "1" : "0");
        } else if (isInvalid(value) && this.type === FieldKind.StringArray) {
            value = new RoArray([]);
        } else if (isBrsString(value) && this.type === FieldKind.Boolean) {
            value = BrsBoolean.from(value.getValue().toLowerCase() === "true");
        } else if (isBrsBoolean(value) && this.type === FieldKind.BoolArray) {
            value = new RoArray([value]);
        } else if (this.type === FieldKind.Rect2D) {
            value = this.convertRect2D(value);
        } else if (this.type === FieldKind.Vector2D) {
            value = this.convertVector2D(value);
        } else if (this.type === FieldKind.Vector2DArray) {
            value = this.convertVector2DArray(value);
        } else if (this.type === FieldKind.String && isStringComp(value)) {
            value = new BrsString(value.getValue());
        }
        if (isBoxable(value)) {
            value = value.box();
        }
        return value;
    }

    private convertNumber(value: BrsNumber): BrsType {
        let newValue: BrsType = value;
        if (this.type === FieldKind.Float) {
            newValue = new Float(value.getValue());
        } else if (this.type === FieldKind.Int32) {
            newValue = new Int32(value.getValue());
        } else if (this.type === FieldKind.Int64) {
            newValue = new Int64(value.getValue());
        } else if (this.type === FieldKind.Double) {
            newValue = new Double(value.getValue());
        } else if (this.type === FieldKind.String) {
            newValue = new BrsString(value.toString());
        } else if (this.type === FieldKind.IntArray || this.type === FieldKind.ColorArray) {
            newValue = new RoArray([new Int32(value.getValue()).box()]);
        } else if (this.type === FieldKind.FloatArray) {
            newValue = new RoArray([new Float(value.getValue()).box()]);
        } else if (this.type === FieldKind.TimeArray) {
            newValue = new RoArray([new Double(value.getValue()).box()]);
        }
        return newValue;
    }

    private convertRect2D(value: BrsType): RoAssociativeArray {
        const rectObject: FlexObject = { x: 0, y: 0, width: 0, height: 0 };
        if (value instanceof RoArray) {
            const rectArray = jsValueOf(value);
            if (
                Array.isArray(rectArray) &&
                rectArray.length === 4 &&
                rectArray.every((item: any) => typeof item === "number")
            ) {
                rectObject.x = rectArray[0];
                rectObject.y = rectArray[1];
                rectObject.width = rectArray[2];
                rectObject.height = rectArray[3];
            }
        } else if (value instanceof RoAssociativeArray) {
            const rectValue = fromAssociativeArray(value);
            if (
                typeof rectValue.x === "number" &&
                typeof rectValue.y === "number" &&
                typeof rectValue.width === "number" &&
                typeof rectValue.height === "number"
            ) {
                rectObject.x = rectValue.x;
                rectObject.y = rectValue.y;
                rectObject.width = rectValue.width;
                rectObject.height = rectValue.height;
            }
        }
        return toAssociativeArray(rectObject);
    }

    private convertVector2D(value: BrsType): RoArray {
        const vectorArray: number[] = [];
        if (value instanceof RoArray) {
            if (value.elements.length === 2 && value.elements.every((item: any) => isAnyNumber(item))) {
                return value;
            }
        } else if (value instanceof RoAssociativeArray) {
            const vecValue = fromAssociativeArray(value);
            if (typeof vecValue.x === "number" && typeof vecValue.y === "number") {
                vectorArray.push(vecValue.x, vecValue.y);
            }
        }
        return new RoArray(vectorArray.map((num) => new Float(num).box()));
    }

    private convertVector2DArray(value: BrsType): RoArray {
        const vector2DArray: RoArray = new RoArray([]);
        if (value instanceof RoArray) {
            if (value.elements.length === 2 && value.elements.every((item: any) => isAnyNumber(item))) {
                // Single Vector2D case
                vector2DArray.elements.push(this.convertVector2D(value));
            } else {
                // Array of Vector2D case
                for (const element of value.elements) {
                    if (element instanceof RoArray) {
                        vector2DArray.elements.push(this.convertVector2D(element));
                    }
                }
            }
        }
        return vector2DArray;
    }

    private isEqual(oldValue: BrsType, newValue: BrsType): boolean {
        if (isAnyNumber(oldValue) && isAnyNumber(newValue)) {
            return oldValue.getValue() === newValue.getValue();
        } else if (isBrsString(oldValue) && isBrsString(newValue)) {
            return oldValue.getValue() === newValue.getValue();
        } else if (isBrsBoolean(oldValue) && isBrsBoolean(newValue)) {
            return oldValue.toBoolean() === newValue.toBoolean();
        } else if (oldValue instanceof Node && newValue instanceof Node) {
            return oldValue === newValue && !newValue.changed;
        } else if (oldValue instanceof BrsComponent && newValue instanceof BrsComponent) {
            return oldValue === newValue || oldValue.equalTo(newValue).toBoolean();
        } else {
            return oldValue.equalTo(newValue).toBoolean();
        }
    }

    private executeCallbacks(callback: BrsCallback) {
        if (callback.running) {
            // Prevent stack overflow by not re-entering a running callback
            return;
        }
        // Snapshot the event (value + info fields) at notification time, matching the RoMessagePort
        // branch which also builds the event before deferring via pushMessage.
        const event = this.buildEvent(callback);

        if (callback.observer instanceof RoMessagePort) {
            callback.observer.pushMessage(event);
            return;
        }

        // Roku-accurate deferral: if another Callable observer is already executing (reentrant) and
        // this notification is not part of a ContentNode parentField cascade, queue it and let the
        // outermost dispatch drain it after the current handler returns.
        // Defer only while inside the ORIGINAL top-level handler (not while draining). Once draining,
        // the cascade runs synchronously/nested so the per-field `notifying` guards terminate it.
        if (Field.observerDepth > 0 && !Field.draining && Field.parentCascadeDepth === 0) {
            Field.deferredQueue.push({ field: this, callback, event });
            return;
        }

        Field.observerDepth++;
        try {
            this.invoke(callback, event);
            if (Field.observerDepth === 1 && !Field.draining) {
                this.drainDeferred();
            }
        } finally {
            Field.observerDepth--;
            if (Field.observerDepth === 0) {
                // Safety: on an exception unwinding through the drain, don't leave stale work queued.
                Field.deferredQueue.length = 0;
            }
        }
    }

    /** Builds the event delivered to an observer, snapshotting the field value and info fields. */
    private buildEvent(callback: BrsCallback): RoSGNodeEvent {
        const { eventParams } = callback;
        // Get info fields current value, if exists.
        let infoFields: RoAssociativeArray | undefined;
        if (eventParams.infoFields) {
            const fieldsMap = new Map();
            if (eventParams.infoFields.elements?.length) {
                for (const element of eventParams.infoFields.elements) {
                    if (isBrsString(element)) {
                        const key = element.getValue();
                        fieldsMap.set(key, eventParams.node.getValue(key));
                    }
                }
            }
            infoFields = toAssociativeArray(fieldsMap);
        }
        // Every time a callback happens, a new event is created.
        return new RoSGNodeEvent(eventParams.node, eventParams.fieldName, this.value, infoFields);
    }

    /**
     * Drains deferred reentrant observer invocations FIFO. `observerDepth` stays at 1 for the whole
     * drain, so a callback that itself triggers a reentrant notification re-enqueues and is picked
     * up by the loop — iterating until quiescent, in the order the fields changed.
     */
    private drainDeferred() {
        Field.draining = true;
        try {
            let guard = 0;
            while (Field.deferredQueue.length > 0) {
                if (++guard > 100000) {
                    BrsDevice.stderr.write("error,[sg] observer drain exceeded limit; possible observer loop");
                    Field.deferredQueue.length = 0;
                    break;
                }
                const deferred = Field.deferredQueue.shift()!;
                const field = deferred.field;
                // Run the deferred callback synchronously (nested): while it executes, hold the
                // field's `notifying` guard and count it in `observerDepth`, so any notifications it
                // triggers dispatch inline with the normal per-field guard stack. This mirrors what
                // the original synchronous dispatch did before the handler-boundary deferral, and is
                // what terminates same-field self-writes and cross-field alias ping-pongs.
                const wasNotifying = field.notifying;
                field.notifying = true;
                Field.observerDepth++;
                try {
                    field.invoke(deferred.callback, deferred.event);
                } finally {
                    Field.observerDepth--;
                    field.notifying = wasNotifying;
                }
            }
        } finally {
            Field.draining = false;
        }
    }

    /** Runs a single Callable observer callback with the caller's host node / m scope restored. */
    private invoke(callback: BrsCallback, event: RoSGNodeEvent) {
        const { interpreter, observer, hostNode, environment } = callback;
        if (!(observer instanceof Callable)) {
            return;
        }
        interpreter.inSubEnv((subInterpreter) => {
            callback.running = true;
            subInterpreter.environment.hostNode = hostNode;
            subInterpreter.environment.setRootM(hostNode.m);
            // Check whether the callback is expecting an event parameter.
            const satisfiedSignature =
                observer.getFirstSatisfiedSignature([event]) ?? observer.getFirstSatisfiedSignature([]);
            if (satisfiedSignature) {
                const { signature, impl } = satisfiedSignature;
                const originalLocation = interpreter.location;
                const funcLoc = observer.getLocation() ?? originalLocation;
                interpreter.addToStack({
                    functionName: observer.getName(),
                    functionLocation: funcLoc,
                    callLocation: originalLocation,
                    signature: satisfiedSignature.signature,
                });
                try {
                    if (signature.args.length > 0) {
                        // Roku invokes an observer callback with only the event as its first
                        // argument; any remaining declared parameters fall back to their default
                        // values. Bind them all here — previously only the first parameter was
                        // defined, leaving later ones <uninitialized> (e.g. a timer `fire`
                        // callback declared as `sub cb(event, opt = true)` crashed reading `opt`).
                        for (const [index, param] of signature.args.entries()) {
                            let paramValue: BrsType;
                            if (index === 0) {
                                paramValue = event;
                            } else if (param.defaultValue) {
                                paramValue = subInterpreter.evaluate(param.defaultValue);
                            } else {
                                paramValue = Uninitialized.Instance;
                            }
                            subInterpreter.environment.define(Scope.Function, param.name.text, paramValue);
                        }
                        impl(subInterpreter, event);
                    } else {
                        impl(subInterpreter);
                    }
                    interpreter.popFromStack();
                    interpreter.location = originalLocation;
                } catch (err) {
                    if (err instanceof RuntimeError) {
                        interpreter.checkCrashDebug(err);
                    }
                    if (interpreter.debugMode === DebugMode.EXIT) {
                        throw err;
                    } else {
                        interpreter.popFromStack();
                        interpreter.location = originalLocation;
                    }
                    if (!(err instanceof BlockEnd)) {
                        callback.running = false;
                        throw err;
                    }
                }
            }
            callback.running = false;
            return BrsInvalid.Instance;
        }, environment);
    }
}
