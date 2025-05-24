import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsComponent } from "../components/BrsComponent";
import { BrsType, toAssociativeArray } from "..";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { MediaEvent } from "../../common";

export class RoVideoPlayerEvent extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly flags: number;
    private readonly index: number;
    private readonly message: string;
    private readonly selected: number;

    constructor(flags: number, index: number, selected?: number) {
        super("roVideoPlayerEvent");
        this.flags = flags;
        this.index = index;
        this.selected = selected ?? 0;
        switch (this.flags) {
            case MediaEvent.LOADING:
                this.message = "startup progress";
                break;
            case MediaEvent.START_PLAY:
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
            ifroVideoPlayerEvent: [
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
                this.isFormatDetected,
                this.isSegmentDownloadStarted,
                this.isStreamStarted,
                this.isCaptionModeChanged,
                this.isStreamSegmentInfo,
                this.isDownloadSegmentInfo,
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
            if (this.flags === MediaEvent.START_STREAM) {
                const info = {
                    Url: "",
                    StreamBitrate: 0,
                    MeasuredBitrate: 0,
                    IsUnderrun: false,
                };
                return toAssociativeArray(info);
            } else if (this.flags === MediaEvent.POSITION) {
                return toAssociativeArray({ ClipIdx: this.selected, ClipPos: this.index * 1000 });
            } else if (this.flags === MediaEvent.FAILED) {
                return toAssociativeArray({ ClipIdx: this.selected, ignored: true });
            }
            return BrsInvalid.Instance;
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

    /** Checks whether video playback has completed at the end of the content list. */
    private readonly isFullResult = new Callable("isFullResult", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === MediaEvent.FULL);
        },
    });

    /** Checks whether the player has finished playing an item in the content list. */
    private readonly isRequestSucceeded = new Callable("isRequestSucceeded", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === MediaEvent.FINISHED);
        },
    });

    /** Returns true if video playback fails. */
    private readonly isRequestFailed = new Callable("isRequestFailed", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === MediaEvent.FAILED);
        },
    });

    /** Returns true if video playback was interrupted. */
    private readonly isPartialResult = new Callable("isPartialResult", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === MediaEvent.PARTIAL);
        },
    });

    /** Returns true if video playback was paused. */
    private readonly isPaused = new Callable("isPaused", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === MediaEvent.PAUSED);
        },
    });

    /** Returns true if video playback was resumed. */
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

    /** Checks whether an ID3 timecode has passed with an event that includes key-value pairs for timed metadata. */
    private readonly isTimedMetadata = new Callable("isTimedMetadata", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            // Not implemented just a placeholder
            return BrsBoolean.False;
        },
    });

    /** Checks whether the current position in the video stream has changed. */
    private readonly isPlaybackPosition = new Callable("isPlaybackPosition", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === MediaEvent.POSITION);
        },
    });

    /** Checks whether the format of all tracks in the media stream have been identified. */
    private readonly isFormatDetected = new Callable("isFormatDetected", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            // Not implemented just a placeholder
            return BrsBoolean.from(false);
        },
    });

    /** Checks whether the video stream has started downloading a segment. */
    private readonly isSegmentDownloadStarted = new Callable("isSegmentDownloadStarted", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            // Not implemented just a placeholder
            return BrsBoolean.from(false);
        },
    });

    /** Checks whether the video stream has started playing. */
    private readonly isStreamStarted = new Callable("isStreamStarted", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === MediaEvent.START_STREAM);
        },
    });

    /** Checks whether the caption mode has changed. */
    private readonly isCaptionModeChanged = new Callable("isCaptionModeChanged", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            // Not implemented just a placeholder
            return BrsBoolean.False;
        },
    });

    /** Checks whether playback has begun of a segment in an HLS, DASH, or smooth stream. */
    private readonly isStreamSegmentInfo = new Callable("isStreamSegmentInfo", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            // Not implemented just a placeholder
            return BrsBoolean.False;
        },
    });

    /** Checks whether a segment in an adaptive stream (HLS, Smooth, or DASH) has been downloaded. */
    private readonly isDownloadSegmentInfo = new Callable("isDownloadSegmentInfo", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            // Not implemented just a placeholder
            return BrsBoolean.False;
        },
    });
}
