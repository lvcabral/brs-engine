import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean, Uninitialized } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { DefaultSounds } from "../../common";

export class RoAudioResource extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly audioName: string;
    private readonly maxStreams: number;
    private readonly valid: boolean;
    private playing: boolean;

    constructor(interpreter: Interpreter, name: BrsString) {
        super("roAudioResource");
        this.maxStreams = Math.min(interpreter.deviceInfo.get("maxSimulStreams"), 3) || 2;
        this.valid = DefaultSounds.includes(name.value.toLowerCase());
        if (!this.valid) {
            try {
                const fsys = interpreter.fileSystem;
                this.valid = fsys.existsSync(name.value);
            } catch (err: any) {
                interpreter.stderr.write(
                    `error,Error loading audio file: ${name.value} - ${err.message}`
                );
            }
        }
        this.audioName = name.value;
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
            if (index.getValue() >= 0 && index.getValue() < this.maxStreams) {
                postMessage(
                    `audio,trigger,${this.audioName},${volume.toString()},${index.toString()}`
                );
                this.playing = true;
            }
            return Uninitialized.Instance;
        },
    });

    /** Returns true if this audio resource is currently playing */
    private readonly isPlaying = new Callable("isPlaying", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter) => {
            this.playing = interpreter.wavStatus.has(this.audioName);
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
            return Uninitialized.Instance;
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

export function createAudioResource(interpreter: Interpreter, name: BrsString) {
    const audio = new RoAudioResource(interpreter, name);
    return audio.isValid() ? audio : BrsInvalid.Instance;
}
