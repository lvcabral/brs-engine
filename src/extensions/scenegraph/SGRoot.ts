/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { BrsDevice, BufferType, DataType, genHexAddress, Interpreter, MediaEvent, MediaTrack } from "brs-engine";
import { ComponentDefinition } from "./parser/ComponentDefinition";
import { SGNodeType } from "./nodes";
import { RoSGNode } from "./components/RoSGNode";
import { RemoteNode } from "./nodes/RemoteNode";
import { Global } from "./nodes/Global";
import { Scene } from "./nodes/Scene";
import { Timer } from "./nodes/Timer";
import { AnimationBase } from "./nodes/AnimationBase";
import { Audio } from "./nodes/Audio";
import { SoundEffect } from "./nodes/SoundEffect";
import { Video } from "./nodes/Video";
import { Task } from "./nodes/Task";
import { ThreadInfo } from "./SGTypes";

/**
 * A singleton object that holds the Node that represents the m.global, the root Scene,
 * the currently focused node, the arrays of tasks and timers and sound effects,
 * and a map of node definitions. Optional Audio and Video instances are also included.
 * */

export class SGRoot {
    private _interpreter: Interpreter | undefined;
    private _mGlobal: Global | RemoteNode | undefined;
    private _nodeDefMap: Map<string, ComponentDefinition>;
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

    get interpreter(): Interpreter | undefined {
        return this._interpreter;
    }

    get mGlobal(): Global | RemoteNode {
        this._mGlobal ??= new Global([]);
        return this._mGlobal;
    }

    get nodeDefMap(): Map<string, ComponentDefinition> {
        return this._nodeDefMap;
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

    private audioFlags: number = -1;
    private audioIndex: number = -1;
    private audioDuration: number = -1;
    private audioPosition: number = -1;
    private videoEvent: number = -1;
    private videoIndex: number = -1;
    private videoProgress: number = -1;
    private videoDuration: number = -1;
    private videoPosition: number = -1;

    constructor() {
        this._nodeDefMap = new Map<string, ComponentDefinition>();
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
        const autoSub = interpreter.manifest.get("uri_resolution_autosub") ?? "";
        if (autoSub.split(",").length === 4) {
            const subs = autoSub.split(",");
            this._autoSub.search = subs[0];
            if (this._resolution === "SD") {
                this._autoSub.replace = subs[1];
            } else if (this._resolution === "HD") {
                this._autoSub.replace = subs[2];
            } else {
                this._autoSub.replace = subs[3];
            }
        }
    }

    /**
     * Sets the map of component definitions.
     * @param nodeDefMap Map of component names to their definitions
     */
    setNodeDefMap(nodeDefMap: Map<string, ComponentDefinition>) {
        this._nodeDefMap = nodeDefMap;
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
     * Sets the currently focused node.
     * @param node Node to set as focused, or undefined to clear focus
     */
    setFocused(node?: RoSGNode) {
        this._focused = node;
    }

    /**
     * Adds a new task thread to the SGRoot.
     * @param task Task instance to add
     * @param threadId Optional thread ID (auto-assigned if not provided)
     * @param makeCurrent Whether to make this the current thread (defaults to false)
     */
    addTask(task: Task, threadId?: number, makeCurrent: boolean = false) {
        task.threadId = threadId ?? this._threads.size;
        this.setThread(task.threadId, makeCurrent, task.getAddress(), task);
    }

    /**
     * Sets thread data and optionally makes it the current thread.
     * @param threadId Thread ID (0 for render thread, >0 for task threads)
     * @param makeCurrent Whether to make this the current thread (defaults to false)
     * @param address Optional hex address for the thread (auto-generated if not provided)
     * @param task Optional Task instance associated with the thread
     */
    setThread(threadId: number, makeCurrent: boolean = false, address?: string, task?: Task) {
        const threadInfo: ThreadInfo = { id: address ?? genHexAddress(), type: threadId > 0 ? "Task" : "Render" };
        this._threads.set(threadId, { info: threadInfo, task });
        if (makeCurrent) {
            this._threadId = threadId;
            BrsDevice.threadId = threadId;
            this._mGlobal = this.threadId === 0 ? new Global([]) : new RemoteNode(SGNodeType.Node, "global");
        }
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
        for (const thread of this._threads.values()) {
            const task = thread.task;
            updates = task?.updateTask() || updates;
            if (task?.active) {
                task.checkTaskRun();
            }
        }
        return updates;
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
        this.videoEvent = -1;
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
        if (this.videoProgress !== progress && progress >= 0 && progress <= 1000) {
            this._video.setState(MediaEvent.Loading, Math.trunc(progress / 10));
        }
        this.videoProgress = progress;
        const eventType = Atomics.load(BrsDevice.sharedArray, DataType.VDO);
        const eventIndex = Atomics.load(BrsDevice.sharedArray, DataType.VDX);
        if (eventType !== this.videoEvent) {
            this.videoEvent = eventType;
            if (eventType >= 0) {
                this._video.setState(eventType, eventIndex);
                Atomics.store(BrsDevice.sharedArray, DataType.VDO, -1);
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
