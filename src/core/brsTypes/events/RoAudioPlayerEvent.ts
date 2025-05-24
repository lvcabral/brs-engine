import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsComponent } from "../components/BrsComponent";
import { BrsType } from "..";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { MediaEvent } from "../../common";

export class RoAudioPlayerEvent extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly flags: number;
    private readonly index: number;
    private readonly message: string;

    constructor(flags: number, index: number) {
        super("roAudioPlayerEvent");
        this.flags = flags;
        this.index = index;
        switch (this.flags) {
            case MediaEvent.SELECTED:
                this.message = "start of play";
                break;
            case MediaEvent.FULL:
                this.message = "end of playlist";
                break;
            default:
                this.message = "";
                break;
        }
        this.registerMethods({
            ifroAudioPlayerEvent: [
                this.getIndex,
                this.getMessage,
                this.getInfo,
                this.getData,
                this.isListItemSelected,
                this.isFullResult,
                this.isPartialResult,
                this.isRequestSucceeded,
                this.isRequestFailed,
                this.isPaused,
                this.isResumed,
                this.isStatusMessage,
                this.isTimedMetadata,
            ],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roAudioPlayerEvent>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Returns an integer representing the index of the current audio stream. */
    private readonly getIndex = new Callable("getIndex", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.index);
        },
    });

    /** Returns info in some events (not implemented just a placeholder). */
    private readonly getInfo = new Callable("getInfo", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return BrsInvalid.Instance;
        },
    });

    /** Returns error code when isRequestFailed() is true. */
    private readonly getData = new Callable("getData", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(0); //TODO: Get error code from rendered thread
        },
    });

    /** Returns the current status message. */
    private readonly getMessage = new Callable("getMessage", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.message);
        },
    });

    /** Returns true if a stream has been selected to start playing. */
    private readonly isListItemSelected = new Callable("isListItemSelected", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === MediaEvent.SELECTED);
        },
    });

    /** Returns true if audio is loaded and will start to play. */
    private readonly isFullResult = new Callable("isFullResult", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === MediaEvent.FULL);
        },
    });

    /** Returns true if audio playback completed at end of content. */
    private readonly isRequestSucceeded = new Callable("isRequestSucceeded", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === MediaEvent.FINISHED);
        },
    });

    /** Returns true if audio playback fails. */
    private readonly isRequestFailed = new Callable("isRequestFailed", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === MediaEvent.FAILED);
        },
    });

    /** Returns true if audio playback was interrupted. */
    private readonly isPartialResult = new Callable("isPartialResult", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === MediaEvent.PARTIAL);
        },
    });

    /** Returns true if audio playback was paused. */
    private readonly isPaused = new Callable("isPaused", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === MediaEvent.PAUSED);
        },
    });

    /** Returns true if audio playback was resumed. */
    private readonly isResumed = new Callable("isResumed", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === MediaEvent.RESUMED);
        },
    });

    /** Returns true if there is a status message. */
    private readonly isStatusMessage = new Callable("isStatusMessage", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.message !== "");
        },
    });

    /** Not Implemented just a placeholder. */
    private readonly isTimedMetadata = new Callable("isTimedMetadata", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.False;
        },
    });
}
