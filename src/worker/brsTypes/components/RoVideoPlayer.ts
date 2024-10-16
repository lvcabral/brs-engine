import { BrsValue, ValueKind, BrsInvalid, BrsBoolean, BrsString } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoMessagePort, RoAssociativeArray, RoArray, BrsNumber, AAMember } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { DataType } from "../../common";

export class RoVideoPlayer extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private port?: RoMessagePort;
    private contentList: RoAssociativeArray[];
    private notificationPeriod: number;

    constructor() {
        super("roVideoPlayer");
        this.contentList = new Array();
        this.notificationPeriod = 0;
        postMessage(new Array<string>());
        postMessage("video,loop,false");
        postMessage("video,next,-1");
        postMessage("video,mute,false");
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
                this.setEnableAudio,
                this.seek,
                this.setPositionNotificationPeriod,
                this.setCGMS,
                this.setDestinationRect,
                this.setMaxVideoDecodeResolution,
                this.getPlaybackDuration,
                this.getAudioTracks,
                this.changeAudioTrack,
                this.setTimedMetadataForKeys,
                this.getCaptionRenderer,
                this.setMacrovisionLevel,
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
        const contents: Object[] = [];
        this.contentList.forEach((aa, index, array) => {
            const item = { url: "", streamFormat: "", audioTrack: -1 };
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

    dispose() {
        this.port?.removeReference();
    }

    /** Sets the content list to be played by the Video Player */
    private readonly setContentList = new Callable("setContentList", {
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
    private readonly addContent = new Callable("addContent", {
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
    private readonly clearContent = new Callable("clearContent", {
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
    private readonly preBuffer = new Callable("preBuffer", {
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
    private readonly play = new Callable("play", {
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
    private readonly stop = new Callable("stop", {
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
    private readonly pause = new Callable("pause", {
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
    private readonly resume = new Callable("resume", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            postMessage("video,resume");
            return BrsBoolean.True;
        },
    });

    /** Enables/disables the automatic replaying of the Content List. */
    private readonly setLoop = new Callable("setLoop", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            postMessage(`video,loop,${enable.toString()}`);
            return BrsInvalid.Instance;
        },
    });

    /** Set what the next item to be played within the Content List should be. */
    private readonly setNext = new Callable("setNext", {
        signature: {
            args: [new StdlibArgument("item", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, item: Int32) => {
            postMessage(`video,next,${item.toString()}`);
            return BrsInvalid.Instance;
        },
    });

    /** Mutes the audio during video playback. */
    private readonly setEnableAudio = new Callable("setEnableAudio", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            postMessage(`video,mute,${!enable.toBoolean()}`);
            return BrsInvalid.Instance;
        },
    });

    /** Set the start point of playback for the current item to offsetMs milliseconds. */
    private readonly seek = new Callable("seek", {
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
    private readonly setPositionNotificationPeriod = new Callable("setPositionNotificationPeriod", {
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

    /** Sets CGMS (Copy Guard Management System) on analog outputs to the desired level. */
    private readonly setCGMS = new Callable("setCGMS", {
        signature: {
            args: [new StdlibArgument("level", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, level: Int32) => {
            // Not supported, created for compatibility
            return BrsInvalid.Instance;
        },
    });

    /** Sets the target display window for the video. */
    private readonly setDestinationRect = new Callable(
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

    /** Sets the max resolution required by your video. */
    private readonly setMaxVideoDecodeResolution = new Callable("setMaxVideoDecodeResolution", {
        signature: {
            args: [
                new StdlibArgument("width", ValueKind.Int32),
                new StdlibArgument("height", ValueKind.Int32),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, width: BrsNumber, height: BrsNumber) => {
            // Not supported yet, created for compatibility
            return BrsInvalid.Instance;
        },
    });

    /** Returns the duration of the video, in seconds. */
    private readonly getPlaybackDuration = new Callable("getPlaybackDuration", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (interpreter: Interpreter) => {
            const duration = Atomics.load(interpreter.sharedArray, DataType.VDR);
            return duration > 0 ? new Int32(duration) : new Int32(0);
        },
    });

    /** Returns the audio tracks contained in the current stream. */
    private readonly getAudioTracks = new Callable("getAudioTracks", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            const result: BrsType[] = [];
            if (this.port) {
                const tracks = this.port.getAudioTracks();
                if (tracks?.length) {
                    tracks.forEach((track, index) => {
                        if (track instanceof Array && track.length === 3) {
                            let item = new Array<AAMember>();
                            item.push({
                                name: new BrsString("Track"),
                                value: new BrsString(`${track[0]}`),
                            });
                            item.push({
                                name: new BrsString("Language"),
                                value: new BrsString(track[1]),
                            });
                            item.push({
                                name: new BrsString("Name"),
                                value: new BrsString(track[2]),
                            });
                            result.push(new RoAssociativeArray(item));
                        }
                    });
                }
            }
            return new RoArray(result);
        },
    });

    /** Changes the currently playing audio track. */
    private readonly changeAudioTrack = new Callable("changeAudioTrack", {
        signature: {
            args: [new StdlibArgument("trackId", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, trackId: BrsString) => {
            postMessage(`video,audio,${trackId.value}`);
            return BrsInvalid.Instance;
        },
    });

    private readonly setTimedMetadataForKeys = new Callable("setTimedMetadataForKeys", {
        signature: {
            args: [new StdlibArgument("keys", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, keys: RoAssociativeArray) => {
            // Not supported yet, created for compatibility
            return BrsInvalid.Instance;
        },
    });

    private readonly getCaptionRenderer = new Callable("getCaptionRenderer", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            // Not supported yet, created for compatibility
            return BrsInvalid.Instance;
        },
    });

    /** This function is deprecated. Macrovision is not supported anymore. */
    private readonly setMacrovisionLevel = new Callable("setMacrovisionLevel", {
        signature: {
            args: [new StdlibArgument("level", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, level: Int32) => {
            return BrsInvalid.Instance;
        },
    });

    // ifGetMessagePort ----------------------------------------------------------------------------------

    /** Returns the message port (if any) currently associated with the object */
    private readonly getMessagePort = new Callable("getMessagePort", {
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
    private readonly setMessagePort = new Callable("setMessagePort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, port: RoMessagePort) => {
            port.enableVideo(true);
            port.addReference();
            this.port?.removeReference();
            this.port = port;
            return BrsInvalid.Instance;
        },
    });

    /** Sets the roMessagePort to be used for all events from the video player */
    private readonly setPort = new Callable("setPort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, port: RoMessagePort) => {
            port.enableVideo(true);
            port.addReference();
            this.port?.removeReference();
            this.port = port;
            return BrsInvalid.Instance;
        },
    });
}
