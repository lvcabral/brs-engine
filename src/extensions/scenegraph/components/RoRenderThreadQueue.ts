/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import {
    BrsBoolean,
    BrsComponent,
    BrsDevice,
    BrsInvalid,
    BrsString,
    BrsType,
    BrsValue,
    Callable,
    Environment,
    Int32,
    Interpreter,
    RoAssociativeArray,
    RoDateTime,
    RoTimespan,
    StdlibArgument,
    ValueKind,
} from "brs-engine";
import { Node } from "../nodes";
import { sgRoot } from "../SGRoot";
import { brsValueOf, fromSGNode, jsValueOf, toAssociativeArray } from "../factory/Serializer";

/** A render-thread handler registered for a given message id. */
interface QueueHandler {
    handler: string;
    observer: Callable;
    environment: Environment;
    hostNode: Node;
}

/** A message awaiting delivery to handlers on the render thread. */
interface PendingMessage {
    id: string;
    data: any;
    /** Name of the BrightScript function that posted the message, surfaced as `function`. */
    fn: string;
    /** Wall-clock creation time (epoch ms), surfaced as the `created` roDateTime. */
    time: number;
    /** `performance.now()` mark at creation, used to seed the `timespan` roTimespan. */
    mark: number;
}

/**
 * `roRenderThreadQueue` component (OS 15+). Queues messages to be consumed by handlers on the render
 * thread, enabling asynchronous (non-blocking) communication from Task threads to the render thread
 * without the overhead/blocking of a rendezvous. See `ifRenderThreadQueue`.
 *
 * It is registered with `CreateObject` by the SceneGraph extension and is a **per-thread singleton**
 * (see `getRenderThreadQueue`), mirroring `roTextureManager`. The render thread's instance holds the
 * registered handlers; a Task thread's instance is used only to `PostMessage`/`CopyMessage`, which are
 * delivered to the render thread with a fire-and-forget `post` thread update and drained during the
 * render loop. Channels are keyed globally by message id, so handler registration and message posting
 * do not need to share object identity across threads.
 *
 * Handler registration and invocation always happen on the render thread; `PostMessage`/`CopyMessage`
 * may be called from any thread.
 */
export class RoRenderThreadQueue extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    /** Registered handlers keyed by message id (render-thread only). */
    private readonly handlers: Map<string, QueueHandler[]> = new Map();
    /** Messages awaiting delivery to handlers (render-thread only). */
    private readonly pending: PendingMessage[] = [];
    /** Count of objects copied (rather than moved) when posting. */
    private copyCount: number = 0;

    constructor() {
        super("roRenderThreadQueue");
        this.registerMethods({
            ifRenderThreadQueue: [this.addMessageHandler, this.postMessage, this.copyMessage, this.numCopies],
        });
    }

    equalTo(_other: BrsType) {
        return BrsBoolean.False;
    }

    toString() {
        return "<Component: roRenderThreadQueue>";
    }

    /**
     * Enqueues a serialized message into this (render-thread) instance and registers it for draining.
     * @param messageId Channel id the message was posted to.
     * @param data Serialized (plain JS) message payload.
     * @param fn Name of the BrightScript function that posted the message (for `msgInfo.function`).
     */
    enqueue(messageId: string, data: any, fn: string = "") {
        this.pending.push({ id: messageId, data, fn, time: Date.now(), mark: performance.now() });
        sgRoot.registerRenderQueue(this);
    }

    /**
     * Drains all pending messages, invoking each registered handler on the render thread. Must only
     * be called from a safe (between-handler) point in the render loop to avoid interpreter re-entry.
     * @param interpreter The render-thread interpreter used to invoke handlers.
     * @returns True if any pending messages were drained.
     */
    drain(interpreter: Interpreter): boolean {
        if (this.pending.length === 0) {
            return false;
        }
        const messages = this.pending.splice(0, this.pending.length);
        for (const message of messages) {
            const handlers = this.handlers.get(message.id);
            if (!handlers?.length) {
                continue;
            }
            const data = brsValueOf(message.data);
            const msgInfo = this.buildMsgInfo(message);
            for (const entry of handlers) {
                this.invokeHandler(interpreter, entry, data, msgInfo);
            }
        }
        return true;
    }

    /** Registers a render-thread handler for a message id. */
    protected readonly addMessageHandler = new Callable("AddMessageHandler", {
        signature: {
            args: [new StdlibArgument("message_id", ValueKind.String), new StdlibArgument("handler", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, messageId: BrsString, handler: BrsString) => {
            if (sgRoot.inTaskThread()) {
                BrsDevice.stderr.write(
                    `warning,[roRenderThreadQueue] AddMessageHandler can only be called on the render thread`
                );
                return BrsInvalid.Instance;
            }
            const observer = interpreter.getCallableFunction(handler.getValue());
            if (!(observer instanceof Callable)) {
                BrsDevice.stderr.write(
                    `warning,[roRenderThreadQueue] Handler function not found: ${handler.getValue()}`
                );
                return BrsInvalid.Instance;
            }
            const id = messageId.getValue();
            const hostNode = (interpreter.environment.hostNode ?? sgRoot.scene) as Node;
            const entry: QueueHandler = {
                handler: handler.getValue(),
                observer,
                environment: interpreter.environment,
                hostNode,
            };
            const list = this.handlers.get(id) ?? [];
            list.push(entry);
            this.handlers.set(id, list);
            sgRoot.registerRenderQueue(this);
            return toAssociativeArray({ id, handler: handler.getValue() });
        },
    });

    /** Posts a message to the queue, moving the data (non-blocking). */
    protected readonly postMessage = new Callable("PostMessage", {
        signature: {
            args: [new StdlibArgument("message_id", ValueKind.String), new StdlibArgument("data", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, messageId: BrsString, data: BrsType) => {
            this.dispatch(messageId.getValue(), data, false, currentFunctionName(interpreter));
            return BrsInvalid.Instance;
        },
    });

    /** Posts a message to the queue, copying the data (non-blocking). */
    protected readonly copyMessage = new Callable("CopyMessage", {
        signature: {
            args: [new StdlibArgument("message_id", ValueKind.String), new StdlibArgument("data", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, messageId: BrsString, data: BrsType) => {
            this.dispatch(messageId.getValue(), data, true, currentFunctionName(interpreter));
            return BrsInvalid.Instance;
        },
    });

    /**
     * Returns the number of objects that `PostMessage` had to copy instead of move. Per the spec
     * this counts `PostMessage` copies only; `CopyMessage` (which always copies by design) is not
     * counted.
     */
    protected readonly numCopies = new Callable("NumCopies", {
        signature: { args: [], returns: ValueKind.Int32 },
        impl: (_: Interpreter) => new Int32(this.copyCount),
    });

    /**
     * Serializes the payload and routes it to the render-thread queue, either directly (when already
     * on the render thread) or via a fire-and-forget `post` thread update (when on a Task thread).
     * @param messageId Channel id to post to.
     * @param data Message payload.
     * @param copy Whether the caller requested a copy (CopyMessage) rather than a move (PostMessage).
     * @param fn Name of the BrightScript function posting the message (for `msgInfo.function`).
     */
    private dispatch(messageId: string, data: BrsType, copy: boolean, fn: string) {
        const serialized = this.serializeData(data, copy);
        if (sgRoot.inTaskThread()) {
            const task = sgRoot.getCurrentThreadTask();
            task?.postRenderQueueMessage(messageId, serialized, fn);
        } else {
            this.enqueue(messageId, serialized, fn);
        }
    }

    /**
     * Converts a message payload to a plain JS form suitable for cross-thread delivery. Per the
     * spec, `NumCopies` tracks objects that `PostMessage` had to copy instead of move: a node
     * cannot be exclusively moved across threads, so a `PostMessage` of a node counts as a copy.
     * Movable values (associative arrays, primitives) are moved, and `CopyMessage` is never counted.
     * @param data Message payload.
     * @param copy Whether the caller requested an explicit copy (CopyMessage).
     * @returns The serialized payload.
     */
    private serializeData(data: BrsType, copy: boolean): any {
        if (data instanceof Node) {
            data.setOwner(0); // Nodes posted to the render thread are owned by it.
            if (!copy) {
                this.copyCount++; // PostMessage must copy a node rather than move it.
            }
            return fromSGNode(data, true);
        }
        return jsValueOf(data);
    }

    /**
     * Builds the `msgInfo` metadata associative array passed as the handler's second argument,
     * matching the fields a real Roku device provides: `message_id` (channel id), `created`
     * (roDateTime of creation), `function` (name of the function that posted the message), and
     * `timespan` (roTimespan marked at creation, so a handler can measure how long it waited).
     * @param message The pending message being delivered.
     * @returns The populated metadata associative array.
     */
    private buildMsgInfo(message: PendingMessage): RoAssociativeArray {
        const msgInfo = new RoAssociativeArray([]);
        msgInfo.set(new BrsString("message_id"), new BrsString(message.id), true);
        msgInfo.set(new BrsString("created"), new RoDateTime(message.time / 1000), true);
        msgInfo.set(new BrsString("function"), new BrsString(message.fn), true);
        msgInfo.set(new BrsString("timespan"), new RoTimespan(message.mark), true);
        return msgInfo;
    }

    /**
     * Invokes a single handler on the render thread, restoring the registering component's scope.
     * @param interpreter The render-thread interpreter.
     * @param entry The handler to invoke.
     * @param data The deserialized message payload.
     * @param msgInfo Metadata (id + creation time) passed as the handler's second argument.
     */
    private invokeHandler(interpreter: Interpreter, entry: QueueHandler, data: BrsType, msgInfo: RoAssociativeArray) {
        const { observer, environment, hostNode, handler } = entry;
        const allArgs: BrsType[] = [data, msgInfo];
        interpreter.inSubEnv((subInterpreter) => {
            subInterpreter.environment.hostNode = hostNode;
            subInterpreter.environment.setM(hostNode.m);
            subInterpreter.environment.setRootM(hostNode.m);
            const satisfied =
                observer.getFirstSatisfiedSignature(allArgs) ??
                observer.getFirstSatisfiedSignature([data]) ??
                observer.getFirstSatisfiedSignature([]);
            if (!satisfied) {
                BrsDevice.stderr.write(
                    `warning,[roRenderThreadQueue] Handler ${handler} has an incompatible signature`
                );
                return BrsInvalid.Instance;
            }
            const callArgs = allArgs.slice(0, satisfied.signature.args.length);
            const originalLocation = interpreter.location;
            const funcLoc = observer.getLocation() ?? originalLocation;
            interpreter.addToStack({
                functionName: handler,
                functionLocation: funcLoc,
                callLocation: originalLocation,
                signature: satisfied.signature,
            });
            try {
                observer.call(subInterpreter, ...callArgs);
            } finally {
                interpreter.popFromStack();
                interpreter.location = originalLocation;
            }
            return BrsInvalid.Instance;
        }, environment);
    }
}

/**
 * Returns the name of the BrightScript function currently executing (the one that called
 * PostMessage/CopyMessage). Native callables don't push a stack frame, so the top of the call
 * stack is the user function that posted the message.
 * @param interpreter The interpreter whose call stack to inspect.
 * @returns The posting function name, or "" if the stack is empty.
 */
function currentFunctionName(interpreter: Interpreter): string {
    return interpreter.stackCopy.at(-1)?.functionName ?? "";
}

/** Per-thread singleton instance of `roRenderThreadQueue` (mirrors `getTextureManager`). */
let renderThreadQueue: RoRenderThreadQueue;

/** Returns the per-thread singleton `roRenderThreadQueue` instance, creating it on first use. */
export function getRenderThreadQueue(): RoRenderThreadQueue {
    renderThreadQueue ||= new RoRenderThreadQueue();
    return renderThreadQueue;
}
