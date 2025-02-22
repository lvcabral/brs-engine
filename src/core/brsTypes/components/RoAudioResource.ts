import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { DataType, DefaultSounds } from "../../common";
import { BrsDevice } from "../../device/BrsDevice";

export class RoAudioResource extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly audioName: string;
    private readonly audioId?: number;
    private readonly maxStreams: number;
    private readonly valid: boolean;
    private currentIndex: number;
    private playing: boolean;

    constructor(name: BrsString) {
        super("roAudioResource");
        this.maxStreams = BrsDevice.deviceInfo.maxSimulStreams;
        this.valid = true;
        const sysIndex = DefaultSounds.findIndex((wav) => wav === name.value.toLowerCase());
        if (sysIndex > -1) {
            this.audioId = sysIndex;
        } else {
            // TODO: Check if this audioId is still valid
            try {
                const fsys = BrsDevice.fileSystem;
                this.valid = fsys !== undefined;
                if (fsys) {
                    const id = parseInt(fsys.readFileSync(name.value, "utf8"));
                    if (id && id >= 0) {
                        this.audioId = id + DefaultSounds.length;
                    }
                }
            } catch (err: any) {
                BrsDevice.stderr.write(
                    `error,Error loading audio file: ${name.value} - ${err.message}`
                );
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
    private readonly trigger = new Callable("trigger", {
        signature: {
            args: [
                new StdlibArgument("volume", ValueKind.Int32),
                new StdlibArgument("index", ValueKind.Int32, new Int32(0)),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, volume: Int32, index: Int32) => {
            // TODO: Check behavior when index > maxSimulStreams
            postMessage(`audio,trigger,${this.audioName},${volume.toString()},${index.toString()}`);
            this.currentIndex = index.getValue();
            this.playing = true;
            return BrsInvalid.Instance;
        },
    });

    /** Returns true if this audio resource is currently playing */
    private readonly isPlaying = new Callable("isPlaying", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            if (this.audioId) {
                const currentWav = Atomics.load(
                    BrsDevice.sharedArray,
                    DataType.WAV + this.currentIndex
                );
                this.playing = currentWav === this.audioId;
            }
            return BrsBoolean.from(this.playing);
        },
    });

    /** Stops playing the audio resource. */
    private readonly stop = new Callable("stop", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            postMessage(`audio,stop,${this.audioName}`);
            this.playing = false;
            return BrsInvalid.Instance;
        },
    });

    /** Returns the maximum number of simultaneous wav playback. */
    private readonly maxSimulStreams = new Callable("maxSimulStreams", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.maxStreams);
        },
    });
}

export function createAudioResource(name: BrsString) {
    const audio = new RoAudioResource(name);
    return audio.isValid() ? audio : BrsInvalid.Instance;
}
