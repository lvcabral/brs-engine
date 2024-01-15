import { BrsValue, ValueKind, BrsInvalid, BrsBoolean, BrsString } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoMessagePort, RoAssociativeArray, RoArray, BrsNumber } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { DataType } from "../../../api/enums";

export class RoVideoPlayer extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private port?: RoMessagePort;
    private contentList: RoAssociativeArray[];
    private notificationPeriod: number;
    private duration: number;

    constructor() {
        super("roVideoPlayer");
        this.contentList = new Array();
        this.notificationPeriod = 0;
        this.duration = 0;
        postMessage(new Array<string>());
        postMessage("video,loop,false");
        postMessage("video,next,-1");
        this.registerMethods({
            ifVideoPlayer: [
                this.setContentList,
                this.addContent,
                this.clearContent,
                this.preBuffer,
                this.play,
                this.stop,
                this.pause,
                this.resume,
                this.setLoop,
                this.setNext,
                // this.setEnableAudio,
                this.seek,
                this.setPositionNotificationPeriod,
                // this.setCGMS,
                this.setDestinationRect,
                // this.SetMaxVideoDecodeResolution,
                this.getPlaybackDuration,
                // this.getAudioTracks,
                // this.changeAudioTrack,
                // this.setTimedMetadataForKeys,
                // this.getCaptionRenderer,
                // this.setMacrovisionLevel,
            ],
            ifSetMessagePort: [this.setMessagePort, this.setPort],
            ifGetMessagePort: [this.getMessagePort],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roVideoPlayer>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    getContent() {
        const contents = [] as Object[];
        this.contentList.forEach((aa, index, array) => {
            const item = { url: "", streamFormat: "" };
            let url = aa.get(new BrsString("url"));
            if (url instanceof BrsString) {
                item.url = url.value;
            } else {
                const stream = aa.get(new BrsString("stream"));
                if (stream instanceof RoAssociativeArray) {
                    url = stream.get(new BrsString("url"));
                    if (url instanceof BrsString) {
                        item.url = url.value;
                    }
                }
            }
            let streamFormat = aa.get(new BrsString("streamFormat"));
            if (streamFormat instanceof BrsString) {
                item.streamFormat = streamFormat.value.toLowerCase();
            }
            contents.push(item);
        });
        return contents;
    }
    /** Sets the content list to be played by the Video Player */
    private setContentList = new Callable("setContentList", {
        signature: {
            args: [new StdlibArgument("contentList", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, contentList: RoArray) => {
            this.port?.resetVideo();
            this.contentList = contentList.getElements() as RoAssociativeArray[];
            postMessage({ videoPlaylist: this.getContent() });
            return BrsInvalid.Instance;
        },
    });

    /** Adds a new ContentMetaData item to the content list for the Video Player. */
    private addContent = new Callable("addContent", {
        signature: {
            args: [new StdlibArgument("contentItem", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, contentItem: RoAssociativeArray) => {
            this.contentList.push(contentItem);
            postMessage({ videoPlaylist: this.getContent() });
            return BrsInvalid.Instance;
        },
    });

    /** Clears the content list */
    private clearContent = new Callable("clearContent", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.port?.resetVideo();
            this.contentList = new Array();
            postMessage({ videoPlaylist: new Array<string>() });
            return BrsInvalid.Instance;
        },
    });

    /** Begins downloading and buffering of a video that may be selected by a user. */
    private preBuffer = new Callable("preBuffer", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            this.port?.resetVideo();
            this.contentList = new Array();
            postMessage("video,load");
            return BrsBoolean.True;
        },
    });

    /** Puts the Video Player into play mode starting at the current item in the Content List. */
    private play = new Callable("play", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            this.port?.resetVideo();
            postMessage("video,play");
            return BrsBoolean.True;
        },
    });

    /** Stops the Video Player from playing or pausing and cleanup */
    private stop = new Callable("stop", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            this.port?.resetVideo();
            postMessage("video,stop");
            return BrsBoolean.True;
        },
    });

    /** Puts the Video Player into pause mode. */
    private pause = new Callable("pause", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            postMessage("video,pause");
            return BrsBoolean.True;
        },
    });

    /** Puts the Video Player into play mode starting from the pause point. */
    private resume = new Callable("resume", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            postMessage("video,resume");
            return BrsBoolean.True;
        },
    });

    /** Enables/disables the automatic replaying of the Content List */
    private setLoop = new Callable("setLoop", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            postMessage(`video,loop,${enable.toString()}`);
            return BrsInvalid.Instance;
        },
    });

    /** Set what the next item to be played within the Content List should be */
    private setNext = new Callable("setNext", {
        signature: {
            args: [new StdlibArgument("item", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, item: Int32) => {
            postMessage(`video,next,${item.toString()}`);
            return BrsInvalid.Instance;
        },
    });

    /** Set the start point of playback for the current item to offsetMs milliseconds. */
    private seek = new Callable("seek", {
        signature: {
            args: [new StdlibArgument("offsetMs", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, offsetMs: Int32) => {
            this.port?.resetVideo();
            postMessage(`video,seek,${offsetMs.toString()}`);
            return BrsInvalid.Instance;
        },
    });

    /** Sets the interval to receive playback position events from the roVideoPlayer. */
    private setPositionNotificationPeriod = new Callable("setPositionNotificationPeriod", {
        signature: {
            args: [new StdlibArgument("period", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, period: Int32) => {
            this.notificationPeriod = period.getValue();
            if (this.port) {
                this.port.setNotification(this.notificationPeriod);
            }
            postMessage(`video,notify,${this.notificationPeriod}`);
            return BrsInvalid.Instance;
        },
    });

    /** Sets the target display window for the video. */
    private setDestinationRect = new Callable(
        "setDestinationRect",
        {
            signature: {
                args: [new StdlibArgument("rect", ValueKind.Dynamic)],
                returns: ValueKind.Void,
            },
            impl: (_: Interpreter, rect: RoAssociativeArray) => {
                const x = rect.get(new BrsString("x")) as BrsNumber;
                const y = rect.get(new BrsString("y")) as BrsNumber;
                const w = rect.get(new BrsString("w")) as BrsNumber;
                const h = rect.get(new BrsString("h")) as BrsNumber;
                postMessage(
                    `video,rect,${x.getValue()},${y.getValue()},${w.getValue()},${h.getValue()}`
                );
                return BrsInvalid.Instance;
            },
        },
        {
            signature: {
                args: [
                    new StdlibArgument("x", ValueKind.Int32),
                    new StdlibArgument("y", ValueKind.Int32),
                    new StdlibArgument("w", ValueKind.Int32),
                    new StdlibArgument("h", ValueKind.Int32),
                ],
                returns: ValueKind.Void,
            },
            impl: (_: Interpreter, x: BrsNumber, y: BrsNumber, w: BrsNumber, h: BrsNumber) => {
                postMessage(
                    `video,rect,${x.getValue()},${y.getValue()},${w.getValue()},${h.getValue()}`
                );
                return BrsInvalid.Instance;
            },
        }
    );

    /** Returns the duration of the video, in seconds. */
    private getPlaybackDuration = new Callable("getPlaybackDuration", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (interpreter: Interpreter) => {
            const duration = Atomics.load(interpreter.sharedArray, DataType.VDR);
            return duration > 0 ? new Int32(duration) : new Int32(0);
        },
    });
    
    // ifGetMessagePort ----------------------------------------------------------------------------------

    /** Returns the message port (if any) currently associated with the object */
    private getMessagePort = new Callable("getMessagePort", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.port ?? BrsInvalid.Instance;
        },
    });

    // ifSetMessagePort ----------------------------------------------------------------------------------

    /** Sets the roMessagePort to be used for all events from the video player */
    private setMessagePort = new Callable("setMessagePort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, port: RoMessagePort) => {
            port.enableVideo(true);
            this.port = port;
            return BrsInvalid.Instance;
        },
    });

    /** Sets the roMessagePort to be used for all events from the video player */
    private setPort = new Callable("setPort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, port: RoMessagePort) => {
            port.enableVideo(true);
            this.port = port;
            return BrsInvalid.Instance;
        },
    });
}
