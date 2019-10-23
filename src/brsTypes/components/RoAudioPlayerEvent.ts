import { BrsValue, ValueKind, BrsString, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";

export class RoAudioPlayerEvent extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    readonly event = { SELECTED: 0, FULL: 1, PARTIAL: 2, PAUSED: 3, RESUMED: 4 };
    private flags: number;
    private index: number;

    constructor(flags: number, index: number) {
        super("roAudioPlayerEvent");
        Object.freeze(this.event);
        this.flags = flags;
        this.index = index;

        this.registerMethods([
            this.getIndex,
            this.isListItemSelected,
            this.isFullResult,
            this.isPartialResult,
            this.isPaused,
            this.isResumed,
            // this.isRequestFailed,
            // this.isRequestSucceeded,
            // this.isStatusMessage,
            // this.isTimedMetadata,
            // this.getMessage,
            // this.getInfo,
        ]);
    }

    toString(parent?: BrsType): string {
        return "<Component: roAudioPlayerEvent>"; //TODO: Check if Roku returns "Component" or "Event"
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

    /** Returns true if a stream has been selected to start playing. */
    private isListItemSelected = new Callable("isListItemSelected", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === this.event.SELECTED);
        },
    });

    /** Returns true if audio playback completed at end of content. */
    private isFullResult = new Callable("isFullResult", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === this.event.FULL);
        },
    });

    /** Returns true if audio playback was interrupted. */
    private isPartialResult = new Callable("isPartialResult", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === this.event.PARTIAL);
        },
    });

    /** Returns true if audio playback was paused. */
    private isPaused = new Callable("isPaused", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === this.event.PAUSED);
        },
    });

    /** Returns true if audio playback was resumed. */
    private isResumed = new Callable("isResumed", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.flags === this.event.RESUMED);
        },
    });
}
