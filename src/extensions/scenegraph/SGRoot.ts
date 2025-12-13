import { BrsDevice, BufferType, DataType, genHexAddress, MediaEvent, MediaTrack, ThreadInfo } from "brs-engine";
import { ComponentDefinition } from "./parser/ComponentDefinition";
import { RoSGNode } from "./components/RoSGNode";
import { Global } from "./nodes/Global";
import { Scene } from "./nodes/Scene";
import { Timer } from "./nodes/Timer";
import { Audio } from "./nodes/Audio";
import { SoundEffect } from "./nodes/SoundEffect";
import { Video } from "./nodes/Video";
import { Task } from "./nodes/Task";

/**
 * A singleton object that holds the Node that represents the m.global, the root Scene,
 * the currently focused node, the arrays of tasks and timers and sound effects,
 * and a map of node definitions. Optional Audio and Video instances are also included.
 * */

export class SGRoot {
    private _mGlobal: Global | undefined;
    private _nodeDefMap: Map<string, ComponentDefinition>;
    private _scene?: Scene;
    private _focused?: RoSGNode;
    private _taskId: number;
    private readonly _threads: Map<number, ThreadInfo>;
    private readonly _tasks: Task[];
    private readonly _timers: Timer[];
    private readonly _sfx: (SoundEffect | undefined)[];
    private _audio?: Audio;
    private _video?: Video;

    get mGlobal(): Global {
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

    get tasks(): Task[] {
        return this._tasks;
    }

    get timers(): Timer[] {
        return this._timers;
    }
    get audio(): Audio | undefined {
        return this._audio;
    }

    get video(): Video | undefined {
        return this._video;
    }

    get taskId(): number {
        return this._taskId;
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
        this._tasks = [];
        this._timers = [];
        this._threads = new Map<number, ThreadInfo>();
        this._taskId = 0; // Render thread by default
        this._threads.set(this._taskId, { id: genHexAddress(), type: "Render" });
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
    }

    /**
     * Sets the currently focused node.
     * @param node Node to set as focused, or undefined to clear focus
     */
    setFocused(node?: RoSGNode) {
        this._focused = node;
    }

    /**
     * Sets thread data and optionally makes it the current thread.
     * @param taskId Thread ID (0 for render thread, >0 for task threads)
     * @param makeCurrent Whether to make this the current thread (defaults to false)
     * @param address Optional hex address for the thread (auto-generated if not provided)
     */
    setThread(taskId: number, makeCurrent: boolean = false, address?: string) {
        this._threads.set(taskId, { id: address ?? genHexAddress(), type: taskId > 0 ? "Task" : "Render" });
        if (makeCurrent) {
            this._taskId = taskId;
        }
    }

    /**
     * Updates all application tasks.
     * Processes task state and checks for active tasks.
     * @returns True if any tasks were updated, false otherwise
     */
    processTasks(): boolean {
        let updates = false;
        for (const task of this._tasks) {
            updates = task.updateTask();
            if (task.active) {
                task.checkTask();
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
     * @returns True if in a task thread (taskId > 0), false if in render thread
     */
    inTaskThread(): boolean {
        return this.taskId > 0;
    }

    /**
     * Gets thread information for the specified task ID.
     * Populates thread name from scene or task subtype.
     * @param taskId Thread ID to get info for (0 for render thread)
     * @returns ThreadInfo object with id, type, and name
     */
    getThreadInfo(taskId: number): ThreadInfo {
        const thread = this._threads.get(taskId)!;
        if (taskId === 0 && this._taskId === 0) {
            thread.name = this.scene?.nodeSubtype;
        } else if (taskId > 0) {
            const task = this.tasks.find((t) => t.id === taskId);
            thread.name = task?.name;
        }
        return thread;
    }

    /**
     * Gets thread information for the current thread.
     * @returns ThreadInfo object for the current thread
     */
    getCurrentThread(): ThreadInfo {
        return this.getThreadInfo(this._taskId);
    }

    /**
     * Gets thread information for the render thread.
     * @returns ThreadInfo object for the render thread (thread 0)
     */
    getRenderThread(): ThreadInfo {
        return this.getThreadInfo(0);
    }
}
export const sgRoot: SGRoot = new SGRoot();
