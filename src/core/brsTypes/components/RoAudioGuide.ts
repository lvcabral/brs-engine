import { BrsValue, ValueKind, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, BrsString } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";

/**
 * Mock implementation of the roAudioGuide component (screen reader speech).
 * The engine does not provide real text-to-speech, so the methods only return
 * plausible static values to prevent apps that use it from crashing.
 */
export class RoAudioGuide extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private speechId = 0;

    constructor() {
        super("roAudioGuide");
        this.registerMethods({
            ifAudioGuide: [this.say, this.flush, this.silence],
        });
    }

    toString(_parent?: BrsType): string {
        return "<Component: roAudioGuide>";
    }

    equalTo(_other: BrsType): BrsBoolean {
        return BrsBoolean.False;
    }

    // ifAudioGuide ---------------------------------------------------------------------

    /** Returns an ID for the spoken string (mock: never actually speaks). */
    private readonly say = new Callable("say", {
        signature: {
            args: [
                new StdlibArgument("text", ValueKind.String),
                new StdlibArgument("flushSpeech", ValueKind.Boolean),
                new StdlibArgument("dontRepeat", ValueKind.Boolean),
            ],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, _text: BrsString, _flushSpeech: BrsBoolean, _dontRepeat: BrsBoolean) => {
            return new Int32(++this.speechId);
        },
    });

    /** Interrupts and stops any current spoken string (mock: no-op). */
    private readonly flush = new Callable("flush", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            return BrsInvalid.Instance;
        },
    });

    /** Suppresses background sound for the given duration (mock: returns the duration). */
    private readonly silence = new Callable("silence", {
        signature: {
            args: [new StdlibArgument("duration", ValueKind.Int32)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, duration: Int32) => {
            return new Int32(duration.getValue());
        },
    });
}
