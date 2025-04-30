import { BrsValue, ValueKind, BrsInvalid, BrsBoolean, BrsString } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoMessagePort, RoAssociativeArray, RoArray, RoAudioPlayerEvent, BrsEvent } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { DataType } from "../../common";
import { BrsHttpAgent, IfHttpAgent } from "../interfaces/IfHttpAgent";
import { IfSetMessagePort, IfGetMessagePort } from "../interfaces/IfMessagePort";
import { BrsDevice } from "../../device/BrsDevice";

export class RoAudioPlayer extends BrsComponent implements BrsValue, BrsHttpAgent {
    readonly kind = ValueKind.Object;
    readonly customHeaders: Map<string, string>;
    private port?: RoMessagePort;
    private contentList: RoAssociativeArray[];
    private audioFlags: number;
    cookiesEnabled: boolean;

    constructor() {
        super("roAudioPlayer");
        this.contentList = new Array();
        this.audioFlags = -1;
        this.cookiesEnabled = false;
        this.customHeaders = new Map<string, string>();
        postMessage(new Array<string>());
        postMessage("audio,loop,false");
        postMessage("audio,next,-1");
        const ifHttpAgent = new IfHttpAgent(this);
        const setPortIface = new IfSetMessagePort(this, this.getNewEvents.bind(this));
        const getPortIface = new IfGetMessagePort(this);
        this.registerMethods({
            ifAudioPlayer: [
                this.setContentList,
                this.addContent,
                this.clearContent,
                this.play,
                this.stop,
                this.pause,
                this.resume,
                this.setLoop,
                this.setNext,
                this.seek,
                this.setTimedMetadataForKeys,
            ],
            ifHttpAgent: [
                ifHttpAgent.addHeader,
                ifHttpAgent.setHeaders,
                ifHttpAgent.initClientCertificates,
                ifHttpAgent.setCertificatesFile,
                ifHttpAgent.setCertificatesDepth,
                ifHttpAgent.enableCookies,
                ifHttpAgent.getCookies,
                ifHttpAgent.addCookies,
                ifHttpAgent.clearCookies,
            ],
            ifSetMessagePort: [setPortIface.setMessagePort, setPortIface.setPort],
            ifGetMessagePort: [getPortIface.getMessagePort, getPortIface.getPort],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roAudioPlayer>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    dispose() {
        this.contentList.forEach((element) => {
            this.removeReference();
        });
        this.port?.removeReference();
    }

    // Audio Player Event ----------------------------------------------------------------------------

    private getNewEvents() {
        const events: BrsEvent[] = [];
        const flags = Atomics.load(BrsDevice.sharedArray, DataType.SND);
        if (flags !== this.audioFlags) {
            this.audioFlags = flags;
            if (this.audioFlags >= 0) {
                events.push(new RoAudioPlayerEvent(this.audioFlags, Atomics.load(BrsDevice.sharedArray, DataType.IDX)));
            }
        }
        return events;
    }

    // ifAudioPlayer ---------------------------------------------------------------------------------

    /** Sets the content list to be played by the Audio Player */
    private readonly setContentList = new Callable("setContentList", {
        signature: {
            args: [new StdlibArgument("contentList", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, contentList: RoArray) => {
            const corsProxy = BrsDevice.deviceInfo.corsProxy ?? "";
            const contents = new Array<string>();
            this.contentList = contentList.getElements() as RoAssociativeArray[];
            this.contentList.forEach((value) => {
                value.addReference();
                let url = value.get(new BrsString("url"));
                if (url instanceof BrsString) {
                    if (url.value.startsWith("http")) {
                        contents.push(corsProxy + url.value);
                    } else {
                        contents.push(url.value);
                    }
                }
            });
            postMessage(contents);
            return BrsInvalid.Instance;
        },
    });

    /** Adds a new ContentMetaData item to the content list for the Audio Player. */
    private readonly addContent = new Callable("addContent", {
        signature: {
            args: [new StdlibArgument("contentItem", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, contentItem: RoAssociativeArray) => {
            const corsProxy = BrsDevice.deviceInfo.corsProxy ?? "";
            contentItem.addReference();
            this.contentList.push(contentItem);
            const contents = new Array<string>();
            this.contentList.forEach((value) => {
                let url = value.get(new BrsString("url"));
                if (url instanceof BrsString) {
                    if (url.value.startsWith("http")) {
                        contents.push(corsProxy + url.value);
                    } else {
                        contents.push(url.value);
                    }
                }
            });
            postMessage(contents);
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
            this.contentList = new Array();
            postMessage(new Array<string>());
            return BrsInvalid.Instance;
        },
    });

    /** Puts the Audio Player into play mode starting at the current item in the Content List. */
    private readonly play = new Callable("play", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            postMessage("audio,play");
            return BrsBoolean.True;
        },
    });

    /** Stops the Audio Player from playing or pausing and cleanup */
    private readonly stop = new Callable("stop", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            postMessage("audio,stop");
            return BrsBoolean.True;
        },
    });

    /** Puts the Audio Player into pause mode. */
    private readonly pause = new Callable("pause", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            postMessage("audio,pause");
            return BrsBoolean.True;
        },
    });

    /** Puts the Audio Player into play mode starting from the pause point. */
    private readonly resume = new Callable("resume", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            postMessage("audio,resume");
            return BrsBoolean.True;
        },
    });

    /** Enables/disables the automatic replaying of the Content List */
    private readonly setLoop = new Callable("setLoop", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            postMessage(`audio,loop,${enable.toString()}`);
            return BrsInvalid.Instance;
        },
    });

    /** Set what the next item to be played within the Content List should be */
    private readonly setNext = new Callable("setNext", {
        signature: {
            args: [new StdlibArgument("item", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, item: Int32) => {
            postMessage(`audio,next,${item.toString()}`);
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
            postMessage(`audio,seek,${offsetMs.toString()}`);
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
}
