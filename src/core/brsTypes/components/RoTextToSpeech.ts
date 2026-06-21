import { BrsValue, ValueKind, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, BrsString, RoArray, RoMessagePort } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { IfSetMessagePort, IfGetMessagePort } from "../interfaces/IfMessagePort";

/**
 * Mock implementation of the roTextToSpeech component.
 * The engine does not provide real text-to-speech, so the methods only store
 * and return plausible static values to prevent apps that use it from crashing.
 * No roTextToSpeechEvent is ever posted to the message port.
 */
export class RoTextToSpeech extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly port?: RoMessagePort;
    private speechId = 0;
    private language = "en-US";
    private voice = "";
    private volume = 1000;
    private rate = 0;
    private pitch = 0;

    constructor() {
        super("roTextToSpeech");
        const setPortIface = new IfSetMessagePort(this);
        const getPortIface = new IfGetMessagePort(this);
        this.registerMethods({
            ifTextToSpeech: [
                this.say,
                this.silence,
                this.flush,
                this.isEnabled,
                this.getAvailableLanguages,
                this.setLanguage,
                this.getLanguage,
                this.getAvailableVoices,
                this.setVoice,
                this.getVoice,
                this.getVolume,
                this.setVolume,
                this.getRate,
                this.setRate,
                this.getPitch,
                this.setPitch,
            ],
            ifSetMessagePort: [setPortIface.setMessagePort],
            ifGetMessagePort: [getPortIface.getMessagePort],
        });
    }

    toString(_parent?: BrsType): string {
        return "<Component: roTextToSpeech>";
    }

    equalTo(_other: BrsType): BrsBoolean {
        return BrsBoolean.False;
    }

    dispose() {
        this.port?.removeReference();
    }

    // ifTextToSpeech -------------------------------------------------------------------

    /** Returns an ID for the spoken string (mock: never actually speaks). */
    private readonly say = new Callable("say", {
        signature: {
            args: [new StdlibArgument("text", ValueKind.String)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, _text: BrsString) => {
            return new Int32(++this.speechId);
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

    /** Checks whether text-to-speech is enabled (mock: always disabled). */
    private readonly isEnabled = new Callable("isEnabled", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.False;
        },
    });

    /** Returns the list of available languages (mock: empty). */
    private readonly getAvailableLanguages = new Callable("getAvailableLanguages", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return new RoArray([]);
        },
    });

    /** Sets the text-to-speech language (mock: stores value). */
    private readonly setLanguage = new Callable("setLanguage", {
        signature: {
            args: [new StdlibArgument("name", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, name: BrsString) => {
            this.language = name.value;
            return BrsInvalid.Instance;
        },
    });

    /** Returns the currently-selected language. */
    private readonly getLanguage = new Callable("getLanguage", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.language);
        },
    });

    /** Returns the list of available voices (mock: empty). */
    private readonly getAvailableVoices = new Callable("getAvailableVoices", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return new RoArray([]);
        },
    });

    /** Sets the text-to-speech voice (mock: stores value). */
    private readonly setVoice = new Callable("setVoice", {
        signature: {
            args: [new StdlibArgument("name", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, name: BrsString) => {
            this.voice = name.value;
            return BrsInvalid.Instance;
        },
    });

    /** Returns the currently-selected voice. */
    private readonly getVoice = new Callable("getVoice", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.voice);
        },
    });

    /** Returns the volume at which text is spoken (0-1000, default 1000). */
    private readonly getVolume = new Callable("getVolume", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.volume);
        },
    });

    /** Sets the volume at which text is spoken (mock: stores value). */
    private readonly setVolume = new Callable("setVolume", {
        signature: {
            args: [new StdlibArgument("volume", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, volume: Int32) => {
            this.volume = volume.getValue();
            return BrsInvalid.Instance;
        },
    });

    /** Returns the rate at which text is spoken (-40 to 200, default 0). */
    private readonly getRate = new Callable("getRate", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.rate);
        },
    });

    /** Sets the rate at which text is spoken (mock: stores value). */
    private readonly setRate = new Callable("setRate", {
        signature: {
            args: [new StdlibArgument("rate", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, rate: Int32) => {
            this.rate = rate.getValue();
            return BrsInvalid.Instance;
        },
    });

    /** Returns the pitch at which text is spoken (-60 to 60, default 0). */
    private readonly getPitch = new Callable("getPitch", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.pitch);
        },
    });

    /** Sets the pitch at which text is spoken (mock: stores value). */
    private readonly setPitch = new Callable("setPitch", {
        signature: {
            args: [new StdlibArgument("pitch", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, pitch: Int32) => {
            this.pitch = pitch.getValue();
            return BrsInvalid.Instance;
        },
    });
}
