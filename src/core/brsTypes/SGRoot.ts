import { ComponentDefinition } from "../scenegraph";
import { BufferType, DataType, MediaEvent, MediaTrack } from "../common";
import { RoSGNode } from "./components/RoSGNode";
import { Global } from "./nodes/Global";
import { Scene } from "./nodes/Scene";
import { Timer } from "./nodes/Timer";
import { Audio } from "./nodes/Audio";
import { SoundEffect } from "./nodes/SoundEffect";
import { Video } from "./nodes/Video";
import { Task } from "./nodes/Task";
import { BrsDevice } from "../device/BrsDevice";

/**
 * A singleton object that holds the Node that represents the m.global, the root Scene,
 * the currently focused node, the arrays of tasks and timers and sound effects,
 * and a map of node definitions. Optional Audio and Video instances are also included.
 * */

export class SGRoot {
    readonly mGlobal: Global;
    private _nodeDefMap: Map<string, ComponentDefinition>;
    private _scene?: Scene;
    private _focused?: RoSGNode;
    private readonly _sfx: (SoundEffect | undefined)[];
    private readonly _tasks: Task[];
    private readonly _timers: Timer[];
    private _audio?: Audio;
    private _video?: Video;

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
        this.mGlobal = new Global([]);
        this._nodeDefMap = new Map<string, ComponentDefinition>();
        this._sfx = [];
        this._tasks = [];
        this._timers = [];
    }

    /** Set the map of component definitions */
    setNodeDefMap(nodeDefMap: Map<string, ComponentDefinition>) {
        this._nodeDefMap = nodeDefMap;
    }

    /** Set the root Scene */
    setScene(scene: Scene) {
        this._scene = scene;
    }

    /** Set the currently focused node */
    setFocused(node?: RoSGNode) {
        this._focused = node;
    }

    /** Update all Application Tasks */
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

    /** Update all Application Timers */
    processTimers(): boolean {
        let fired = false;
        for (const timer of this._timers) {
            if (timer.active && timer.checkFire()) {
                fired = true;
            }
        }
        return fired;
    }

    /** Reset and prepare to track a new Audio instance */
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

    /** Update the Audio instance based on data from render thread */
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

    /** Reset and prepare to track a new Video instance */
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

    /** Update the Video instance based on data from render thread */
    processVideo(): boolean {
        if (!this._video) {
            return false;
        }
        let isDirty = false;
        const progress = Atomics.load(BrsDevice.sharedArray, DataType.VLP);
        if (this.videoProgress !== progress && progress >= 0 && progress <= 1000) {
            this._video.setState(MediaEvent.LOADING, Math.trunc(progress / 10));
            console.debug(`Video Progress: ${progress}`);
        }
        this.videoProgress = progress;
        const eventType = Atomics.load(BrsDevice.sharedArray, DataType.VDO);
        const eventIndex = Atomics.load(BrsDevice.sharedArray, DataType.VDX);
        if (eventType !== this.videoEvent) {
            this.videoEvent = eventType;
            if (eventType >= 0) {
                this._video.setState(eventType, eventIndex);
                console.debug(`Video State: ${this._video.getFieldValueJS("state")}  (${eventType}/${eventIndex})`);
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

    /** Update all SoundEffects based on data from render thread */
    processSFX() {
        let isDirty = false;
        for (let i = 0; i < this._sfx.length; i++) {
            const sfx = this._sfx[i];
            if (!sfx) {
                continue;
            }
            const sfxId = Atomics.load(BrsDevice.sharedArray, DataType.WAV + i);
            if (sfxId >= 0 && sfxId === sfx.getAudioId() && sfx.getState() !== "playing") {
                sfx.setState(MediaEvent.START_PLAY);
                isDirty = true;
            } else if (sfx.getState() !== "stopped") {
                sfx.setState(MediaEvent.FINISHED);
                this._sfx[i] = undefined;
                isDirty = true;
            }
        }
        return isDirty;
    }
}
export const sgRoot: SGRoot = new SGRoot();
