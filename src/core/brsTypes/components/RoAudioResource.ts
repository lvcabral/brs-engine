import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean, Uninitialized } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, isStringComp } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RuntimeError, RuntimeErrorDetail } from "../../error/BrsError";
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

    constructor(name: BrsType) {
        super("roAudioResource");
        if (!isStringComp(name)) {
            const errorDetail =
                name instanceof Uninitialized
                    ? RuntimeErrorDetail.UninitializedVariable
                    : RuntimeErrorDetail.TypeMismatch;
            throw new RuntimeError(errorDetail, true);
        }
        this.maxStreams = BrsDevice.deviceInfo.maxSimulStreams;
        this.valid = true;
        const sfxName = name.getValue();
        const sfxIndex = BrsDevice.sfx.indexOf(sfxName.toLowerCase());
        if (sfxIndex > -1) {
            this.audioId = sfxIndex;
        } else {
            try {
                this.valid = BrsDevice.fileSystem.existsSync(sfxName);
                if (this.valid) {
                    this.audioId = BrsDevice.sfx.length;
                    postMessage(`sfx,new,${sfxName},${this.audioId}`);
                    BrsDevice.sfx.push(sfxName.toLowerCase());
                }
            } catch (err: any) {
                BrsDevice.stderr.write(`error,Error loading audio file: ${sfxName} - ${err.message}`);
                this.valid = false;
            }
        }
        this.audioName = sfxName;
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
            const stream = index.getValue();
            if (stream >= 0 && stream < this.maxStreams) {
                const sysIndex = DefaultSounds.indexOf(this.audioName.toLowerCase());
                const playVolume = sysIndex > -1 ? BrsDevice.deviceInfo.audioVolume : volume.getValue();
                Atomics.store(BrsDevice.sharedArray, DataType.WAV + stream, this.audioId ?? -1);
                postMessage(`sfx,trigger,${this.audioName},${playVolume},${stream}`);
                this.currentIndex = stream;
                this.playing = true;
            }
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
            if (this.audioId !== undefined) {
                const currentWav = Atomics.load(BrsDevice.sharedArray, DataType.WAV + this.currentIndex);
                this.playing = currentWav === this.audioId;
                return BrsBoolean.from(this.playing);
            }
            return BrsBoolean.False;
        },
    });

    /** Stops playing the audio resource. */
    private readonly stop = new Callable("stop", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            postMessage(`sfx,stop,${this.audioName}`);
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
