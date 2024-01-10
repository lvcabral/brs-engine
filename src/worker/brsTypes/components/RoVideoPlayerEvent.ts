import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { MediaEvent } from "../../../api/enums";

export class RoVideoPlayerEvent extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private flags: number;
    private index: number;
    private message: string;

    constructor(flags: number, index: number) {
        super("roVideoPlayerEvent");
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
            ifVideoPlayerEvent: [
                this.getIndex,
                this.getMessage,
                this.getInfo,
                this.isListItemSelected,
                this.isFullResult,
                this.isPartialResult,
                this.isRequestSucceeded,
                this.isRequestFailed,
                this.isPaused,
                this.isResumed,
                this.isStatusMessage,
                this.isTimedMetadata,
                this.isPlaybackPosition,
                // this.isFormatDetected,
                // this.isSegmentDownloadStarted,
                // this.isStreamStarted,
                // this.isCaptionModeChanged,
                // this.isStreamSegmentInfo,
                // this.isDownloadSegmentInfo,
            ],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roVideoPlayerEvent>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Returns an integer representing the index of the current audio stream. */
    private getIndex = new Callable("getIndex", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.index);
        },
    });

    /** Returns info in some events (not implemented just a placeholder). */
    private getInfo = new Callable("getInfo", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return BrsInvalid.Instance;
        },
    });

    /** Returns the current status message. */
    private getMessage = new Callable("getMessage", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.message);
        },
    });

    /** Returns true if a stream has been selected to start playing. */
    private isListItemSelected = new Callable("isListItemSelected", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === MediaEvent.SELECTED);
        },
    });

    /** Returns true if video is loaded and will start to play. */
    private isFullResult = new Callable("isFullResult", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === MediaEvent.FULL);
        },
    });

    /** Returns true if video playback completed at end of content. */
    private isRequestSucceeded = new Callable("isRequestSucceeded", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === MediaEvent.FULL);
        },
    });

    /** Returns true if video playback fails. */
    private isRequestFailed = new Callable("isRequestFailed", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === MediaEvent.FAILED);
        },
    });

    /** Returns true if video playback was interrupted. */
    private isPartialResult = new Callable("isPartialResult", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === MediaEvent.PARTIAL);
        },
    });

    /** Returns true if video playback was paused. */
    private isPaused = new Callable("isPaused", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === MediaEvent.PAUSED);
        },
    });

    /** Returns true if video playback was resumed. */
    private isResumed = new Callable("isResumed", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === MediaEvent.RESUMED);
        },
    });

    /** Returns true if there is a status message. */
    private isStatusMessage = new Callable("isStatusMessage", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.message !== "");
        },
    });

    /** Checks whether the current position in the video stream has changed. */
    private isPlaybackPosition = new Callable("isPlaybackPosition", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.False;
        },
    });

    /** Not Implemented just a placeholder. */
    private isTimedMetadata = new Callable("isTimedMetadata", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.False;
        },
    });
}
