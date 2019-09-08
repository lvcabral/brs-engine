import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoAssociativeArray } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";

export class RoAudioResource extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private audioName: string;
    private playing: boolean;

    constructor(name: BrsString) {
        super("roAudioResource");
        this.audioName = name.value;
        this.playing = false;
        this.registerMethods([
            this.trigger,
            this.isPlaying,
            this.stop,
            //this.maxSimulStreams,
        ]);
    }

    toString(parent?: BrsType): string {
        return "<Component: roAudioResource>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
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
            // TODO: Play sound
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
            return BrsInvalid.Instance;
        },
    });
}
