import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { shared } from "../..";
import URL from "url-parse";

export class RoAudioResource extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    readonly type = { KEY: 0, MOD: 1, SND: 2, IDX: 3, WAV: 4 };
    private buffer: Int32Array;
    private audioName: string;
    private audioId?: number;
    private currentIndex: number;
    private playing: boolean;
    private maxStreams: number;
    private valid: boolean;

    constructor(interpreter: Interpreter, name: BrsString) {
        super("roAudioResource");
        Object.freeze(this.type);
        this.maxStreams = interpreter.deviceInfo.get("maxSimulStreams");
        this.valid = true;
        this.buffer = shared.get("buffer") || new Int32Array([]);
        const systemwav = ["select", "navsingle", "navmulti", "deadend"];
        const sysIndex = systemwav.findIndex((wav) => wav === name.value.toLowerCase());
        if (sysIndex > -1) {
            this.audioId = sysIndex;
        } else {
            const url = new URL(name.value);
            const volume = interpreter.fileSystem.get(url.protocol);
            if (volume) {
                try {
                    const id = parseInt(volume.readFileSync(url.pathname));
                    if (id && id >= 0) {
                        this.audioId = id + systemwav.length;
                    }
                } catch (err: any) {
                    postMessage(
                        `warning,Error loading audio file: ${url.pathname} - ${err.message}`
                    );
                    this.valid = false;
                }
            } else {
                postMessage(`warning,Invalid volume:${name}`);
                this.valid = false;
            }
        }
        this.audioName = name.value;
        this.currentIndex = 0;
        this.playing = false;
        this.registerMethods({
            ifAudioResource: [this.trigger, this.isPlaying, this.stop, this.maxSimulStreams],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roAudioResource>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    isValid() {
        return this.valid;
    }

    /** Triggers the start of the audio resource sound playback. */
    private trigger = new Callable("trigger", {
        signature: {
            args: [
                new StdlibArgument("volume", ValueKind.Int32),
                new StdlibArgument("index", ValueKind.Int32, new Int32(0)),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, volume: Int32, index: Int32) => {
            // TODO: Check behavior when index > maxSimulStreams
            postMessage(`trigger,${this.audioName},${volume.toString()},${index.toString()}`);
            this.currentIndex = index.getValue();
            this.playing = true;
            return BrsInvalid.Instance;
        },
    });

    /** Returns true if this audio resource is currently playing */
    private isPlaying = new Callable("isPlaying", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            if (this.audioId) {
                const currentWav = Atomics.load(this.buffer, this.type.WAV + this.currentIndex);
                this.playing = currentWav === this.audioId;
            }
            return BrsBoolean.from(this.playing);
        },
    });

    /** Stops playing the audio resource. */
    private stop = new Callable("stop", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            postMessage(`stop,${this.audioName}`);
            this.playing = false;
            return BrsInvalid.Instance;
        },
    });

    /** Returns the maximum number of simultaneous wav playback. */
    private maxSimulStreams = new Callable("maxSimulStreams", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.maxStreams);
        },
    });
}

export function createAudioResource(interpreter: Interpreter, name: BrsString) {
    const audio = new RoAudioResource(interpreter, name);
    return audio.isValid() ? audio : BrsInvalid.Instance;
}
