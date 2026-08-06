/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import {
    BrsDevice,
    BufferType,
    DataType,
    genHexAddress,
    Interpreter,
    MediaEvent,
    MediaTrack,
    RoMessagePort,
} from "brs-engine";
import { ComponentDefinition } from "./parser/ComponentDefinition";
import { Global } from "./nodes/Global";
import { ThreadInfo } from "./SGTypes";
import type { SoundEffect } from "./nodes/SoundEffect";
import type { RoSGNode } from "./components/RoSGNode";
import type { RoSGScreen } from "./components/RoSGScreen";
import type { AnimationBase, Audio, Dialog, Node, Scene, StandardDialog, Task, Timer, Video } from "./nodes";
import type { RoRenderThreadQueue } from "./components/RoRenderThreadQueue";

/**
 * A singleton object that holds the Node that represents the m.global, the root Scene,
 * the currently focused node, the arrays of tasks and timers and sound effects,
 * and a map of node definitions. Optional Audio and Video instances are also included.
 * */

export class SGRoot {
    private _interpreter: Interpreter | undefined;
    private _mGlobal: Global | undefined;
    private _nodeDefMap: Map<string, ComponentDefinition>;
    /** Tracks the load status of component libraries, keyed by lowercase library id. */
    private _componentLibraries: Map<string, string>;
    /** Deferred ComponentLibrary loadStatus notifications, flushed on the next render frame. */
    private readonly _pendingLibraryNotifications: (() => void)[] = [];
    private _screen?: RoSGScreen;
    private _scene?: Scene;
    private _focused?: RoSGNode;
    private _threadId: number;
    private _resolution: string;
    private readonly _autoSub: { search: string; replace: string };
    private readonly _threads: Map<number, { task?: Task; info: ThreadInfo }>;
    private readonly _timers: Timer[];
    private readonly _animations: AnimationBase[];
    private readonly _sfx: (SoundEffect | undefined)[];
    private _audio?: Audio;
    private _video?: Video;
    private _dirty: boolean = false;
    private _rendering: boolean = false;
    private _measuring: boolean = false;
    private _renderPass: "layout" | "paint" = "paint";
    private readonly _pendingPorts: RoMessagePort[] = [];
    /**
     * When `true`, recently-written fields can be re-read from the local copy for a short window,
     * skipping a rendezvous (a performance heuristic). Defaults to `false` so that every Task-thread
     * field get rendezvouses with the owning thread, matching real Roku device behavior.
     */
    fastFieldReads: boolean = false;
    /** Fallback for `logRendezvous` before the shared control array is available. */
    private localLogRendezvous: boolean = false;

    /**
     * When `true`, each rendezvous logs its action, target, and duration (mirroring the Roku
     * SceneGraph debug console `logrendezvous` command). Defaults to `false`.
     *
     * Backed by the shared control array rather than a per-thread field, because a rendezvous has
     * two ends: tracing only the thread the flag was set on shows half of each exchange. Sharing it
     * also makes the toggle live — a host can turn tracing on mid-run and every existing Task thread
     * picks it up, instead of the value being frozen into each worker's launch payload.
     */
    get logRendezvous(): boolean {
        const shared = BrsDevice.sharedArray;
        if (shared && shared.length > DataType.RDZ) {
            return Atomics.load(shared, DataType.RDZ) === 1;
        }
        return this.localLogRendezvous;
    }

    set logRendezvous(enabled: boolean) {
        this.localLogRendezvous = enabled;
        const shared = BrsDevice.sharedArray;
        if (shared && shared.length > DataType.RDZ) {
            Atomics.store(shared, DataType.RDZ, enabled ? 1 : 0);
        }
    }
    /** Fallback for `rendezvousTracking` before the shared control array is available. */
    private localRendezvousTracking: boolean = false;

    /**
     * When `true`, each completed rendezvous is reported as a `RendezvousEvent` for ECP
     * `query/sgrendezvous` to collect, independent of {@link logRendezvous}. Toggled by
     * `sgrendezvous/track` and `sgrendezvous/untrack`. Backed by the shared control array for the
     * same reason as `logRendezvous`: the toggle must be live and visible to every Task thread.
     */
    get rendezvousTracking(): boolean {
        const shared = BrsDevice.sharedArray;
        if (shared && shared.length > DataType.RDT) {
            return Atomics.load(shared, DataType.RDT) === 1;
        }
        return this.localRendezvousTracking;
    }

    set rendezvousTracking(enabled: boolean) {
        this.localRendezvousTracking = enabled;
        const shared = BrsDevice.sharedArray;
        if (shared && shared.length > DataType.RDT) {
            Atomics.store(shared, DataType.RDT, enabled ? 1 : 0);
        }
    }
    /**
     * Maximum time (ms) a Task thread will wait for the render thread to serve a rendezvous before
     * treating it as a blocked render thread. On a real device a render-thread block terminates the
     * app (10s for production apps, 3s for sideloaded); on timeout the engine raises an
     * `ExecutionTimeout` runtime error instead of silently returning `invalid`. Defaults to 10s.
     */
    rendezvousTimeout: number = 10000;
    /**
     * True while the serializer is rebuilding a node from cross-thread data (`toSGNode`). Media nodes
     * (`Video`/`Audio`) check this in their constructor to skip the render-init that registers them as
     * the singleton `sgRoot.video`/`sgRoot.audio` and posts player-reset messages — a deserialization
     * proxy must never hijack the real player instance the app created.
     */
    deserializing: boolean = false;
    /**
     * Thread id the data currently being rebuilt came from, or -1 outside a cross-thread rebuild.
     * `toSGNode` uses it to attribute a node's `_observed_` port observations to the thread whose
     * real port is waiting on them (see `Field.remotePortObservers`); passing it through every
     * serializer signature would touch a dozen call sites for one narrow need.
     */
    deserializingThread: number = -1;
    /** The render thread's roRenderThreadQueue singleton (holds handlers), drained each frame. */
    private _renderQueue?: RoRenderThreadQueue;
    /**
     * Nodes that have crossed the thread boundary (serialized to, or rebuilt from, another thread),
     * keyed by address. A rendezvous update targets a node by this address, and on a real Roku any
     * node the other thread holds a reference to stays reachable — even when it is no longer part of
     * the task/scene/global trees (e.g. a per-request callback node that a field stopped pointing
     * at). WeakRefs keep the registry from retaining nodes; the FinalizationRegistry prunes entries
     * once a node is collected.
     */
    private readonly _crossThreadNodes = new Map<string, WeakRef<Node>>();
    private readonly _crossThreadCleanup = new FinalizationRegistry((address: string) => {
        if (this._crossThreadNodes.get(address)?.deref() === undefined) {
            this._crossThreadNodes.delete(address);
        }
    });

    get interpreter(): Interpreter | undefined {
        return this._interpreter;
    }

    get mGlobal(): Global {
        this._mGlobal ??= new Global();
        return this._mGlobal;
    }

    get nodeDefMap(): Map<string, ComponentDefinition> {
        return this._nodeDefMap;
    }

    get threadTasks(): Task[] {
        return Array.from(this._threads.values())
            .map((thread) => thread.task)
            .filter((task): task is Task => task !== undefined);
    }

    get screen(): RoSGScreen | undefined {
        return this._screen;
    }

    get scene(): Scene | undefined {
        return this._scene;
    }

    get focused(): RoSGNode | undefined {
        return this._focused;
    }

    get sfx(): (SoundEffect | undefined)[] {
        return this._sfx;
    }

    get timers(): Timer[] {
        return this._timers;
    }

    get animations(): AnimationBase[] {
        return this._animations;
    }

    get audio(): Audio | undefined {
        return this._audio;
    }

    get video(): Video | undefined {
        return this._video;
    }

    get threadId(): number {
        return this._threadId;
    }

    get resolution(): string {
        return this._resolution;
    }

    get autoSub(): { search: string; replace: string } {
        return this._autoSub;
    }

    get isDirty(): boolean {
        return this._dirty;
    }

    /**
     * True while the scene tree is being rendered. Used to suppress re-entrant full-scene
     * re-renders triggered by `localBoundingRect`/`boundingRect` queries that run inside an
     * observer or `init()` during rendering (which would otherwise recurse and overflow the stack).
     */
    get rendering(): boolean {
        return this._rendering;
    }

    set rendering(value: boolean) {
        this._rendering = value;
    }

    /**
     * True while a bounding-rect query is measuring a single node's subtree from inside an active
     * render (see `Node.getBoundingRect`). A nested query raised during that local measurement pass
     * must return the rects it is computing rather than starting yet another local pass — this flag
     * bounds that recursion, the same way `rendering` bounds full-scene refreshes.
     */
    get measuring(): boolean {
        return this._measuring;
    }

    set measuring(value: boolean) {
        this._measuring = value;
    }

    /**
     * Which kind of render pass is currently traversing the tree. A `layout` pass (started by
     * `Node.layoutNode` — bounding-rect refreshes, `measureUnsizedChildren`) must be idempotent
     * and clock-free: rects only. A `paint` pass (`Node.paintNode` — the per-frame render) may
     * additionally advance time-based state and draw. Defaults to `paint` so direct `renderNode`
     * calls (external node registrations, tests) keep today's semantics. See
     * `docs/scenegraph-layout-passes.md`.
     */
    get renderPass(): "layout" | "paint" {
        return this._renderPass;
    }

    set renderPass(value: "layout" | "paint") {
        this._renderPass = value;
    }

    /**
     * True while a full-tree layout refresh may skip settled subtrees (`Node.subtreeStale` false
     * and unchanged origin/angle/opacity). Enabled only around `refreshLayoutFromRoot`'s pass —
     * scoped subtree measurements (the mid-render fallback, `measureUnsizedChildren`) never prune.
     * Sound only because layout passes are pure (see docs/scenegraph-layout-passes.md).
     */
    pruneLayout: boolean = false;

    /** Set by BRS_PRUNE_DISABLE: turns pruned layout refreshes off entirely (field debugging). */
    pruneDisabled: boolean = false;

    private audioFlags: number = -1;
    private audioIndex: number = -1;
    private audioDuration: number = -1;
    private audioPosition: number = -1;
    private videoIndex: number = -1;
    private videoProgress: number = -1;
    private videoDuration: number = -1;
    private videoPosition: number = -1;

    constructor() {
        this._nodeDefMap = new Map<string, ComponentDefinition>();
        this._componentLibraries = new Map<string, string>();
        this._sfx = [];
        this._timers = [];
        this._animations = [];
        this._threads = new Map();
        // Add Render thread by default
        this._threadId = 0;
        const threadInfo: ThreadInfo = { id: genHexAddress(), type: "Render" };
        this._threads.set(this._threadId, { info: threadInfo });
        // Default resolution and auto substitution parameters
        this._resolution = "HD";
        this._autoSub = { search: "", replace: "" };
        // Pruned-layout escape hatch from the environment (node builds; browsers/tests set the
        // field programmatically). Runtime-guarded rather than ifdef'd — the same bundle also
        // loads in Web Workers, where `process` does not exist.
        if (typeof process !== "undefined" && process.env) {
            this.pruneDisabled = process.env.BRS_PRUNE_DISABLE === "1";
        }
    }

    /**
     * Sets the interpreter and updates resolution and auto substitution parameters based on the manifest.
     * @param interpreter Interpreter instance to set
     */
    setInterpreter(interpreter: Interpreter) {
        this._interpreter = interpreter;
        const resolutions = interpreter.manifest.get("ui_resolutions");
        if (resolutions?.length) {
            const resArray = resolutions.split(",");
            if (resArray[0].toUpperCase() === "FHD") {
                this._resolution = "FHD";
            } else if (resArray[0].toUpperCase() === "HD") {
                this._resolution = "HD";
            } else if (resArray[0].toUpperCase() === "SD") {
                this._resolution = "SD";
            }
        }
        // Format: uri_resolution_autosub=<search>,<replace...>
        // The full form lists replacements for SD, HD and FHD, but channels often omit the
        // resolutions they don't ship (most commonly SD), e.g. "$$RES$$,hd,fhd". The replacements
        // are an ascending-resolution suffix of [SD, HD, FHD] (FHD is always the last one), so map
        // the current resolution from the end of the list. Roku trims surrounding whitespace.
        const autoSub = (interpreter.manifest.get("uri_resolution_autosub") ?? "").trim();
        if (autoSub) {
            const subs = autoSub.split(",").map((sub) => sub.trim());
            const replacements = subs.slice(1);
            if (replacements.length && subs[0] !== "") {
                this._autoSub.search = subs[0];
                // Offset from the end: FHD = last, HD = second-to-last, SD = third-to-last.
                const offset = this._resolution === "FHD" ? 1 : this._resolution === "HD" ? 2 : 3;
                const index = Math.min(Math.max(replacements.length - offset, 0), replacements.length - 1);
                this._autoSub.replace = replacements[index];
            }
        }
    }

    /**
     * Sets the map of component definitions.
     * @param nodeDefMap Map of component names to their definitions
     */
    setNodeDefMap(nodeDefMap: Map<string, ComponentDefinition>) {
        this._nodeDefMap = nodeDefMap;
        this._componentLibraries = new Map<string, string>();
        this._pendingLibraryNotifications.length = 0;
    }

    /**
     * Records the load status of a component library.
     * @param id Library id (the ComponentLibrary node's `id` field, used as namespace prefix)
     * @param status Load status ("none" | "loading" | "ready" | "failed")
     */
    setLibraryStatus(id: string, status: string) {
        this._componentLibraries.set(id.toLowerCase(), status);
    }

    /**
     * Gets the load status of a previously loaded component library.
     * @param id Library id to look up
     * @returns The recorded load status, or undefined if the library was never loaded
     */
    getLibraryStatus(id: string): string | undefined {
        return this._componentLibraries.get(id.toLowerCase());
    }

    /**
     * Queues a deferred ComponentLibrary loadStatus notification. Because libraries load
     * synchronously at startup (before the scene exists), the `loadStatus` transition to
     * "ready"/"failed" is deferred to the next render frame so observers attached during a
     * component's `init()` are notified, matching the asynchronous behavior on a Roku device.
     * @param notify Callback that emits the loadStatus change with observer notification
     */
    addPendingLibraryNotification(notify: () => void) {
        this._pendingLibraryNotifications.push(notify);
    }

    /**
     * Flushes any deferred ComponentLibrary loadStatus notifications.
     * @returns True if any notification was emitted, false otherwise
     */
    processComponentLibraries(): boolean {
        if (this._pendingLibraryNotifications.length === 0) {
            return false;
        }
        const pending = this._pendingLibraryNotifications.splice(0);
        for (const notify of pending) {
            notify();
        }
        return true;
    }

    /**
     * Stores a port to be registered with the screen once it is created.
     * @param port RoMessagePort to register later
     */
    addPendingPort(port: RoMessagePort) {
        this._pendingPorts.push(port);
    }

    /**
     * Sets the RoSGScreen instance for the application.
     * Retroactively registers any ports created before the screen.
     * @param screen RoSGScreen instance to set
     */
    setScreen(screen: RoSGScreen) {
        this._screen = screen;
        for (const port of this._pendingPorts) {
            screen.registerPort(port);
        }
        this._pendingPorts.length = 0;
    }

    /**
     * Sets the root Scene node.
     * @param scene Scene instance to set as root
     */
    setScene(scene: Scene) {
        this._scene = scene;
        scene.setResolution(this._resolution);
    }

    /**
     * Removes the dialog if the current one.
     * @param dialog Dialog instance to set
     */
    removeDialog(dialog: Dialog | StandardDialog) {
        if (this._scene?.dialog === dialog) {
            this._scene.dialog = undefined;
        }
    }

    /**
     * Sets the currently focused node.
     * @param node Node to set as focused, or undefined to clear focus
     */
    setFocused(node?: RoSGNode) {
        this._focused = node;
    }

    /**
     * Records a node whose address has crossed the thread boundary, so later rendezvous
     * updates can resolve it even when it is unreachable from the task/scene/global trees.
     * @param node Node being serialized to (or rebuilt from) another thread
     */
    registerCrossThreadNode(node: Node) {
        const address = node.getAddress();
        if (this._crossThreadNodes.get(address)?.deref() === node) {
            return;
        }
        this._crossThreadNodes.set(address, new WeakRef(node));
        this._crossThreadCleanup.register(node, address);
    }

    /**
     * Resolves a previously registered cross-thread node by address.
     * @param address Node address to look up
     * @returns The live node, or undefined if never registered or already collected
     */
    getCrossThreadNode(address: string): Node | undefined {
        return this._crossThreadNodes.get(address)?.deref();
    }

    /**
     * Resolves an address to the instance of that node this thread should actually use.
     *
     * Live reachability wins over the cross-thread registry: `toSGNode` copies `_address_` when it
     * rebuilds a node, so repeated serializations of one logical node mint instances sharing its
     * address and the registry keeps only the latest. Walking the trees first means a node still
     * wired into the scene, the global node or a task always resolves to its authoritative copy,
     * with the registry left as the fallback for a true orphan held only by the other thread.
     * Mirrors the ordering in `Task.resolveNode` — see the regression it documents.
     * @param address Node address to resolve.
     * @returns The live node, or undefined when this thread has no instance for that address.
     */
    resolveLiveNode(address: string): Node | undefined {
        if (!address) {
            return undefined;
        }
        // Fast reject: every node that has ever crossed a thread boundary is registered here
        // (`fromSGNode`/`toSGNode`/`updateSGNode` all call `registerCrossThreadNode` unconditionally),
        // so an address absent from the registry cannot possibly be found by the tree walk below —
        // this lets a node crossing for the first time (the common case for a freshly built subtree,
        // now checked on every deserialized node, not just field syncs) skip walking
        // scene/global/every task tree entirely.
        if (!this.getCrossThreadNode(address)) {
            return undefined;
        }
        const roots: (Node | undefined)[] = [this._scene, this._mGlobal];
        for (const thread of this._threads.values()) {
            roots.push(thread.task);
        }
        for (const root of roots) {
            const found = root?.findNodeByAddress(root, address, true);
            if (found) {
                return found;
            }
        }
        return this.getCrossThreadNode(address);
    }

    /**
     * Adds a new task thread to the SGRoot.
     * @param task Task instance to add
     * @param threadId Optional thread ID (auto-assigned if not provided)
     */
    addTask(task: Task, threadId?: number) {
        task.threadId = threadId ?? this._threads.size;
        this.setThread(task.threadId, task.getAddress(), task);
    }

    /**
     * Sets thread data and optionally makes it the current thread.
     * @param threadId Thread ID (0 for render thread, >0 for task threads)
     * @param address Optional hex address for the thread (auto-generated if not provided)
     * @param task Optional Task instance associated with the thread
     */
    setThread(threadId: number, address?: string, task?: Task) {
        const threadInfo: ThreadInfo = { id: address ?? genHexAddress(), type: threadId > 0 ? "Task" : "Render" };
        this._threads.set(threadId, { info: threadInfo, task });
    }

    /**
     * Sets the current thread ID and updates related properties.
     * @param threadId The ID of the thread to set as current
     */
    setCurrentThread(threadId: number) {
        this._threadId = threadId;
        BrsDevice.threadId = threadId;
    }

    /**
     * Gets the count of task threads.
     * @param runningOnly If true, counts only active and started tasks
     * @returns The number of task threads
     */
    getTasksCount(runningOnly?: boolean): number {
        let count = 0;
        for (const thread of this._threads.values()) {
            const task = thread.task;
            if ((task && !runningOnly) || (task?.active && task.started)) {
                count++;
            }
        }
        return count;
    }

    /**
     * Updates all application tasks.
     * Processes task state and checks for active tasks.
     * @returns True if any tasks were updated, false otherwise
     */
    processTasks(): boolean {
        let updates = false;
        // Snapshot the thread list so a handler that creates/stops a task mid-iteration can't disturb
        // the loop, and isolate each task: a fault while serving one task must never tear down the
        // render thread (which would stall every rendezvous and silently drop in-flight updates).
        for (const thread of Array.from(this._threads.values())) {
            const task = thread.task;
            try {
                updates = task?.processThreadUpdate() !== undefined || updates;
                if (task?.active) {
                    task.checkTaskRun();
                }
                // Phase 3b: drain any queued direct fan-out into the task's buffer (render thread only).
                task?.flushFanout();
            } catch (err: any) {
                BrsDevice.stderr.write(
                    `error,[sg] Error processing task ${task?.nodeSubtype} (thread ${task?.threadId}): ${
                        err?.message ?? err
                    }${err?.stack ? `\n${err.stack}` : ""}`
                );
            }
        }
        return updates;
    }

    /**
     * Registers the render-thread roRenderThreadQueue singleton so it is drained each render frame.
     * @param queue The queue singleton holding the registered handlers.
     */
    registerRenderQueue(queue: RoRenderThreadQueue) {
        this._renderQueue = queue;
    }

    /**
     * Enqueues a message (delivered from a Task thread via a `post` update) into the render-thread
     * queue singleton, if registered.
     * @param messageId Channel id the message was posted to.
     * @param data Serialized message payload.
     * @param fn Name of the BrightScript function that posted the message (for `msgInfo.function`).
     */
    enqueueRenderQueueMessage(messageId: string, data: any, fn: string = "") {
        this._renderQueue?.enqueue(messageId, data, fn);
    }

    /**
     * Drains the render-thread queue singleton, invoking its handlers. Called from the render loop
     * (a safe, between-handler point) to avoid re-entering the interpreter mid-statement.
     * @returns True if the queue had pending messages drained.
     */
    processRenderQueues(): boolean {
        if (!this._renderQueue || !this._interpreter) {
            return false;
        }
        return this._renderQueue.drain(this._interpreter);
    }

    /**
     * Updates all application timers.
     * Checks which timers should fire and triggers them.
     * @returns True if any timers fired, false otherwise
     */
    processTimers(): boolean {
        let fired = false;
        for (const timer of this._timers) {
            if (timer.active && timer.checkFire()) {
                fired = true;
            }
        }
        return fired;
    }

    /**
     * Updates all application animations.
     * Checks which animations should update and triggers them.
     * @returns True if any animation updated, false otherwise
     */
    processAnimations(): boolean {
        let updated = false;
        for (const animation of this._animations) {
            if (animation.tick()) {
                updated = true;
            }
        }
        return updated;
    }

    /**
     * Resets and prepares to track a new Audio instance.
     * Clears audio state flags in shared array.
     * @param audio Audio instance to track
     */
    setAudio(audio: Audio) {
        this._audio = audio;
        this.audioFlags = -1;
        this.audioIndex = -1;
        this.audioDuration = -1;
        this.audioPosition = -1;
        Atomics.store(BrsDevice.sharedArray, DataType.SND, -1);
        Atomics.store(BrsDevice.sharedArray, DataType.SDX, -1);
        Atomics.store(BrsDevice.sharedArray, DataType.SDR, -1);
        Atomics.store(BrsDevice.sharedArray, DataType.SPS, -1);
    }

    /**
     * Updates the Audio instance based on data from render thread.
     * Reads state, index, duration, and position from shared array.
     * @returns True if audio state changed, false otherwise
     */
    processAudio(): boolean {
        if (!this._audio) {
            return false;
        }
        let isDirty = false;
        const flags = Atomics.load(BrsDevice.sharedArray, DataType.SND);
        if (flags !== this.audioFlags) {
            this.audioFlags = flags;
            this._audio.setState(flags);
            isDirty = true;
        }
        const index = Atomics.load(BrsDevice.sharedArray, DataType.SDX);
        if (index !== this.audioIndex) {
            this.audioIndex = index;
            this._audio.setContentIndex(index);
            isDirty = true;
        }
        const duration = Atomics.load(BrsDevice.sharedArray, DataType.SDR);
        if (duration !== this.audioDuration) {
            this.audioDuration = duration;
            this._audio.setDuration(duration);
            isDirty = true;
        }
        const position = Atomics.load(BrsDevice.sharedArray, DataType.SPS);
        if (position !== this.audioPosition) {
            this.audioPosition = position;
            this._audio.setPosition(position);
            isDirty = true;
        }
        return isDirty;
    }

    /**
     * Resets and prepares to track a new Video instance.
     * Clears video state flags in shared array.
     * @param video Video instance to track
     */
    setVideo(video: Video) {
        this._video = video;
        this.videoIndex = -1;
        this.videoProgress = -1;
        this.videoDuration = -1;
        this.videoPosition = -1;
        Atomics.store(BrsDevice.sharedArray, DataType.VDO, -1);
        Atomics.store(BrsDevice.sharedArray, DataType.VDX, -1);
        Atomics.store(BrsDevice.sharedArray, DataType.VSE, -1);
        Atomics.store(BrsDevice.sharedArray, DataType.VDR, -1);
        Atomics.store(BrsDevice.sharedArray, DataType.VPS, -1);
        Atomics.store(BrsDevice.sharedArray, DataType.VAT, -1);
        Atomics.store(BrsDevice.sharedArray, DataType.VTT, -1);
    }

    /**
     * Updates the Video instance based on data from render thread.
     * Reads state, index, duration, position, tracks, and other video data from shared array.
     * @returns True if video state changed, false otherwise
     */
    processVideo(): boolean {
        if (!this._video) {
            return false;
        }
        let isDirty = false;
        const progress = Atomics.load(BrsDevice.sharedArray, DataType.VLP);
        if (progress >= 0 && progress <= 1000) {
            // Consume the slot so an identical value published by a LATER load is still seen.
            // Apps commonly reuse a single Video node across content: nothing resets
            // `videoProgress` between loads, and a fast (cached) load can climb back to the same
            // value before this thread ever observes the main thread's load-start reset. A
            // snapshot compare would then skip the whole buffering progression, and an app that
            // requires bufferingStatus to reach 100% before state turns "playing" (a real-device
            // guarantee) would never reveal its player.
            if (Atomics.compareExchange(BrsDevice.sharedArray, DataType.VLP, progress, -1) === progress) {
                // Emit the intermediate buffering steps between the last reported value and the
                // current one, so a consumer that gates on a specific percentage never misses a
                // threshold when the render loop is starved (e.g. during Task startup) and the
                // load progress jumps. Apps commonly start playback at ~33% ("prebufferDone") and
                // reveal UI at ~99%; delivering only a jump straight to 100% would skip the 33%
                // callback and the video would never start. Mirrors a real device's gradual
                // buffering progression. A regressed value means a new load began, so the
                // progression restarts from zero.
                let reported = progress < this.videoProgress ? 0 : Math.max(this.videoProgress, 0);
                while (reported + 200 < progress) {
                    reported += 200;
                    this._video.setState(MediaEvent.Loading, Math.trunc(reported / 10));
                }
                this._video.setState(MediaEvent.Loading, Math.trunc(progress / 10));
                this.videoProgress = progress;
            }
        }
        const eventType = Atomics.load(BrsDevice.sharedArray, DataType.VDO);
        if (eventType >= 0) {
            const eventIndex = Atomics.load(BrsDevice.sharedArray, DataType.VDX);
            // Consume the event exactly once: the CAS clears the slot so a same-type event
            // published right after this one is still seen (a snapshot compare would drop it
            // and leave the slot stuck). If the CAS fails, the main thread published a newer
            // event between the load and the exchange; it is picked up next tick.
            if (Atomics.compareExchange(BrsDevice.sharedArray, DataType.VDO, eventType, -1) === eventType) {
                this._video.setState(eventType, eventIndex);
                isDirty = true;
            }
        }
        const selected = Atomics.load(BrsDevice.sharedArray, DataType.VSE);
        if (selected !== this.videoIndex) {
            this.videoIndex = selected;
            if (selected >= 0) {
                this._video.setContentIndex(selected);
                Atomics.store(BrsDevice.sharedArray, DataType.VSE, -1);
                isDirty = true;
            }
        }
        const duration = Atomics.load(BrsDevice.sharedArray, DataType.VDR);
        if (duration !== this.videoDuration) {
            this.videoDuration = duration;
            this._video.setDuration(duration);
            isDirty = true;
        }
        const position = Atomics.load(BrsDevice.sharedArray, DataType.VPS);
        if (position !== this.videoPosition) {
            this.videoPosition = position;
            this._video.setPosition(position);
            isDirty = true;
        }

        const bufferFlag = Atomics.load(BrsDevice.sharedArray, DataType.BUF);
        if (bufferFlag === BufferType.MEDIA_TRACKS) {
            const strTracks = BrsDevice.readDataBuffer();
            let audioTracks: MediaTrack[] = [];
            let textTracks: MediaTrack[] = [];
            try {
                const tracks = JSON.parse(strTracks);
                audioTracks = tracks.audio ?? [];
                textTracks = tracks.text ?? [];
            } catch (e) {
                audioTracks = [];
                textTracks = [];
            }
            this._video.setAudioTracks(audioTracks);
            this._video.setSubtitleTracks(textTracks);
            isDirty = true;
        }

        const audioTrack = Atomics.load(BrsDevice.sharedArray, DataType.VAT);
        if (audioTrack > -1) {
            this._video.setCurrentAudioTrack(audioTrack);
            Atomics.store(BrsDevice.sharedArray, DataType.VAT, -1);
            isDirty = true;
        }

        const subtitleTrack = Atomics.load(BrsDevice.sharedArray, DataType.VTT);
        if (subtitleTrack > -1) {
            this._video.setCurrentSubtitleTrack(subtitleTrack);
            Atomics.store(BrsDevice.sharedArray, DataType.VTT, -1);
            isDirty = true;
        }
        return isDirty;
    }

    /**
     * Updates all SoundEffects based on data from render thread.
     * Checks sound effect states and triggers playback or cleanup.
     * @returns True if any sound effect state changed, false otherwise
     */
    processSFX() {
        let isDirty = false;
        for (let i = 0; i < this._sfx.length; i++) {
            const sfx = this._sfx[i];
            if (!sfx) {
                continue;
            }
            const sfxId = Atomics.load(BrsDevice.sharedArray, DataType.WAV + i);
            if (sfxId >= 0 && sfxId === sfx.getAudioId() && sfx.getState() !== "playing") {
                sfx.setState(MediaEvent.StartPlay);
                isDirty = true;
            } else if (sfx.getState() !== "stopped") {
                sfx.setState(MediaEvent.Finished);
                this._sfx[i] = undefined;
                isDirty = true;
            }
        }
        return isDirty;
    }

    /**
     * Checks if currently executing in a task thread.
     * @returns True if in a task thread (threadId > 0), false if in render thread
     */
    inTaskThread(): boolean {
        return this._threadId > 0;
    }

    /**
     * Gets the Task instance for the specified task ID.
     * @param threadId Thread ID to get the Task for
     * @returns Task instance if found, otherwise undefined
     */
    getThreadTask(threadId: number): Task | undefined {
        const thread = this._threads.get(threadId);
        return thread?.task;
    }

    /**
     * Gets the Task instance for the current thread.
     * @returns Task instance if in a task thread, otherwise undefined
     */
    getCurrentThreadTask(): Task | undefined {
        return this.getThreadTask(this._threadId);
    }

    /**
     * Gets thread information for the specified thread ID.
     * Populates thread name from scene or task subtype.
     * @param threadId Thread ID to get info for (0 for render thread)
     * @returns ThreadInfo object with id, type, and name
     */
    getThreadInfo(threadId: number): ThreadInfo {
        const thread = this._threads.get(threadId)!;
        if (threadId === 0 && this._threadId === 0) {
            thread.info.name = this.scene?.nodeSubtype;
        } else if (threadId > 0) {
            thread.info.name = thread.task?.name;
        }
        return thread.info;
    }

    /**
     * Gets thread information for the current thread.
     * @returns ThreadInfo object for the current thread
     */
    getCurrentThreadInfo(): ThreadInfo {
        return this.getThreadInfo(this._threadId);
    }

    /**
     * Gets thread information for the render thread.
     * @returns ThreadInfo object for the render thread (thread 0)
     */
    getRenderThreadInfo(): ThreadInfo {
        return this.getThreadInfo(0);
    }

    /**
     * Marks the SGRoot as dirty, indicating state changes.
     */
    makeDirty() {
        this._dirty = true;
    }

    /**
     * Clears the dirty flag on the SGRoot.
     */
    clearDirty() {
        this._dirty = false;
    }
}
export const sgRoot: SGRoot = new SGRoot();
