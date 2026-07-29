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
    // On a real Roku, a DIRECT BrightScript field assignment (`node.field = x`) on the owning
    // thread fires function-name observers synchronously, even nested inside another observer —
    // apps rely on set-then-read-back (assign a field, immediately read a value the observer
    // computed). What Roku dispatches from the message loop are fields changed by a node's
    // INTERNAL machinery (e.g. `itemFocused` emitted by an ArrayGrid processing `jumpToItem`,
    // `content`, or a focus move): those observers do not run reentrantly in the middle of another
    // observer's execution. We reproduce that: when a Callable observer for an engine-initiated
    // emission (`internalUpdateDepth` > 0) would fire while another Callable observer is already
    // executing (reentrant) — and the notification is not part of a ContentNode parentField
    // cascade — we queue it and drain it FIFO once the outermost dispatch unwinds.
    // Same-field re-notification (`notifying`) and same-ContentNode re-entry (`propagating`) are
    // still suppressed before reaching this path, so the #904/#905/#943 cascades are unaffected.
    /** Depth of Callable observers currently executing on this thread (the reentrancy gate). */
    private static observerDepth = 0;
    /** >0 while inside `ContentNode.notifyParentFields`; disables deferral for cascade observers. */
    private static parentCascadeDepth = 0;
    /**
     * >0 while engine machinery (not app BrightScript) is emitting field changes — grid focus
     * bookkeeping such as `itemFocused`/`rowItemFocused`. Only those notifications defer; a direct
     * BrightScript assignment always dispatches synchronously (Roku's set-then-read-back
     * semantics). Stashed to 0 while an observer callback executes (`invoke`), so a handler
     * dispatched from inside an engine emission still has its own direct assignments treated as
     * app-initiated; a nested engine site re-enters and is again marked internal.
     */
    private static internalUpdateDepth = 0;
    /**
     * >0 while a component's `init()` is running (the `init` hierarchy walk in `initializeNode`).
     * Focus emissions raised during `init` must defer until the OUTERMOST init unwinds — on Roku a
     * `setFocus(true)` in `init()` dispatches its `focusedChild` observers from the message loop
     * after `init` returns, so an observer registered LATER in the same `init` still catches it.
     * Nests: a component's `init` can create/append child components (their own `init` runs
     * reentrantly), so the queue drains only when this returns to 0.
     */
    private static initDepth = 0;
    /**
     * >0 while `Node.setNodeFocus`/`restoreFocusChainOnAttach` is writing `focusedChild` down the
     * ancestor chain. Combined with `initDepth`, this defers ONLY the init-time focus notifications;
     * a focus change outside `init` (normal navigation, or reentrant from inside an observer) is
     * unaffected and still dispatches synchronously.
     */
    private static focusEmissionDepth = 0;
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
    /**
     * Fields whose focus-chain notification was raised during a component's init() and deferred.
     * The observer that reacts is often registered LATER in the same init (after the setFocus call),
     * so we can't queue a specific callback at emission time — instead we remember the FIELD and
     * re-run notifyObservers() at the outermost init unwind, reading whatever observers exist by then
     * (matching Roku dispatching focus notifications from the message loop after init returns).
     * A Set coalesces repeated writes to one final notification per field, in insertion order.
     */
    private static readonly pendingInitFocusFields = new Set<Field>();

    /** Marks entry into a ContentNode parentField cascade, so its observers dispatch inline. */
    static enterParentCascade() {
        Field.parentCascadeDepth++;
    }

    /** Marks exit from a ContentNode parentField cascade. */
    static exitParentCascade() {
        Field.parentCascadeDepth--;
    }

    /** Marks entry into an engine-initiated field emission (message-loop dispatch on Roku). */
    static enterInternalUpdate() {
        Field.internalUpdateDepth++;
    }

    /** Marks exit from an engine-initiated field emission. */
    static exitInternalUpdate() {
        Field.internalUpdateDepth--;
    }

    /** Marks entry into a component's `init()` (the init hierarchy walk). */
    static enterInit() {
        Field.initDepth++;
    }

    /** Marks exit from a component's `init()`. The pending focus notifications are NOT dispatched
     * here — they are delivered from the next message-loop iteration (see deliverPendingInitFocus),
     * matching Roku, where a `setFocus` in init() fires its observers from the message loop after
     * init returns rather than synchronously at the end of init. */
    static exitInit() {
        Field.initDepth--;
    }

    /**
     * Delivers focus notifications deferred during init(), from the message loop (the extension
     * `tick` hook) once the outermost init has fully unwound. Called on every tick; it is a cheap
     * no-op unless there is pending work and it is safe to dispatch (not mid-init, not inside another
     * observer, not already draining).
     */
    static deliverPendingInitFocus() {
        if (
            Field.pendingInitFocusFields.size > 0 &&
            Field.initDepth === 0 &&
            Field.observerDepth === 0 &&
            !Field.draining
        ) {
            Field.drainInitFocus();
        }
    }

    /**
     * Re-notifies the fields whose focus-chain notification was deferred during init(). Runs each
     * field's observers synchronously (they were never dispatched during init), draining in
     * insertion order and picking up any fields a handler defers in turn, until quiescent.
     */
    private static drainInitFocus() {
        let guard = 0;
        // notifyObservers() consumes each field from the set as it dispatches (see the delete there),
        // so an inline re-focus of a still-pending ancestor won't be dispatched twice. We still pop
        // here to guarantee loop progress (e.g. if a field's dispatch is suppressed by `notifying`).
        for (const field of Field.pendingInitFocusFields) {
            if (++guard > 100000) {
                BrsDevice.stderr.write("error,[sg] init focus drain exceeded limit; possible observer loop");
                Field.pendingInitFocusFields.clear();
                break;
            }
            Field.pendingInitFocusFields.delete(field);
            field.notifyObservers();
        }
    }

    /** Marks entry into a focus-chain emission (`focusedChild` writes in setNodeFocus/attach). */
    static enterFocusEmission() {
        Field.focusEmissionDepth++;
    }

    /** Marks exit from a focus-chain emission. */
    static exitFocusEmission() {
        Field.focusEmissionDepth--;
    }

    /** Resets deferred-dispatch state between app runs so nothing leaks across setups. */
    static resetDispatch() {
        Field.observerDepth = 0;
        Field.parentCascadeDepth = 0;
        Field.internalUpdateDepth = 0;
        Field.initDepth = 0;
        Field.focusEmissionDepth = 0;
        Field.draining = false;
        Field.deferredQueue.length = 0;
        Field.pendingInitFocusFields.clear();
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
        // Focus-chain notification raised during a component's init(): defer to the outermost init
        // unwind and re-notify then, reading observers registered later in the same init. Recording
        // the FIELD (not a callback) is what lets an observer added AFTER the setFocus call still
        // fire — see pendingInitFocusFields / drainInitFocus. Skipped while draining.
        if (Field.focusEmissionDepth > 0 && Field.initDepth > 0 && !Field.draining) {
            Field.pendingInitFocusFields.add(this);
            return;
        }
        // We are dispatching this field now, so consume any owed init-focus notification for it:
        // if a drain is in progress and an earlier field's observer re-focused this one (an inline
        // dispatch, since initDepth is 0 during delivery), removing it here stops drainInitFocus
        // from dispatching the same field a second time.
        Field.pendingInitFocusFields.delete(this);
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

    /**
     * Whether `scope` observes this field through a port.
     *
     * The `hostNode` match matters: an unscoped observer used to answer true for *every* scope, so
     * callers picking cross-thread fan-out targets delivered each update to every active task. The
     * node that registered the observer is recorded on the callback, so attribution is exact — and
     * for a Task that registered in `init()` (on the render thread, never via rendezvous) this is the
     * only record that it is waiting.
     * @param scope Node to test for port observation.
     */
    isPortObserved(scope: Node) {
        return (
            (this.unscopedObservers?.some(
                (callback) => callback.observer instanceof RoMessagePort && callback.hostNode === scope
            ) ??
                false) ||
            (this.scopedObservers?.get(scope)?.some((callback) => callback.observer instanceof RoMessagePort) ?? false)
        );
    }

    /**
     * Task threads that observe this field through an `roMessagePort`.
     *
     * A port cannot cross a thread boundary: `observeField(field, port)` from a task rendezvouses
     * the call here and the port is rebuilt as a fresh, empty one, while the task's real port is
     * registered only on its own copy. So the render side cannot tell *which* thread is waiting by
     * looking at its observer list — and `isPortObserved` answers true for any scope once a single
     * unscoped port observer exists, which would broadcast every update to every task. Recording
     * the originating thread id makes the fan-out exact.
     */
    private remotePortObservers?: Set<number>;

    /**
     * Registers a task thread as a port observer of this field.
     * @param threadId Task thread that called observeField with a port.
     */
    addRemotePortObserver(threadId: number) {
        this.hidden = false;
        this.remotePortObservers ??= new Set();
        this.remotePortObservers.add(threadId);
    }

    /**
     * Removes a task thread's port observation of this field.
     * @param threadId Task thread that called unobserveField.
     */
    removeRemotePortObserver(threadId: number) {
        this.remotePortObservers?.delete(threadId);
    }

    /**
     * Checks whether a task thread observes this field through a port.
     * @param threadId Task thread to test.
     */
    hasRemotePortObserver(threadId: number) {
        return this.remotePortObservers?.has(threadId) ?? false;
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

        // Roku-accurate deferral: if this notification comes from an engine-initiated emission
        // (grid focus bookkeeping — a direct BrightScript assignment never defers), another
        // Callable observer is already executing (reentrant), and it is not part of a ContentNode
        // parentField cascade, queue it and let the outermost dispatch drain it after the current
        // handler returns.
        // Defer only while inside the ORIGINAL top-level handler (not while draining). Once draining,
        // the cascade runs synchronously/nested so the per-field `notifying` guards terminate it.
        if (
            Field.internalUpdateDepth > 0 &&
            Field.observerDepth > 0 &&
            !Field.draining &&
            Field.parentCascadeDepth === 0
        ) {
            Field.deferredQueue.push({ field: this, callback, event });
            return;
        }

        Field.observerDepth++;
        try {
            this.invoke(callback, event);
            if (Field.observerDepth === 1 && !Field.draining) {
                Field.drainDeferred();
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
    private static drainDeferred() {
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
        if (!(callback.observer instanceof Callable)) {
            return;
        }
        // While the handler's BrightScript executes, its direct field assignments are
        // app-initiated even when this dispatch happens inside an engine emission site (e.g. a
        // panel callback fired from ArrayGrid.setFocusedItem, or a focus-chain write). Stash the
        // internal-update and focus-emission markers and restore them after; a nested engine site
        // re-enters them on its own.
        const stashedInternalDepth = Field.internalUpdateDepth;
        const stashedFocusDepth = Field.focusEmissionDepth;
        Field.internalUpdateDepth = 0;
        Field.focusEmissionDepth = 0;
        try {
            this.invokeCallable(callback, event);
        } finally {
            Field.internalUpdateDepth = stashedInternalDepth;
            Field.focusEmissionDepth = stashedFocusDepth;
        }
    }

    private invokeCallable(callback: BrsCallback, event: RoSGNodeEvent) {
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
