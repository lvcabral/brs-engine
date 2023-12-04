import { BrsValue, ValueKind, BrsInvalid, BrsBoolean, BrsString } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoMessagePort, RoAssociativeArray, RoArray } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";

export class RoAudioPlayer extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private port?: RoMessagePort;
    private contentList: RoAssociativeArray[];

    constructor() {
        super("roAudioPlayer");
        this.contentList = new Array();
        postMessage(new Array<string>());
        postMessage("loop,false");
        postMessage("next,-1");
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
                //this.setTimedMetadataForKeys,
            ],
            ifSetMessagePort: [this.setMessagePort, this.setPort],
            ifGetMessagePort: [this.getMessagePort],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roAudioPlayer>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Sets the content list to be played by the Audio Player */
    private setContentList = new Callable("setContentList", {
        signature: {
            args: [new StdlibArgument("contentList", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, contentList: RoArray) => {
            const contents = new Array<string>();
            this.contentList = contentList.getElements() as RoAssociativeArray[];
            this.contentList.forEach((value, index, array) => {
                let url = value.get(new BrsString("url"));
                if (url instanceof BrsString) {
                    contents.push(url.value);
                }
            });
            postMessage(contents);
            return BrsInvalid.Instance;
        },
    });

    /** Adds a new ContentMetaData item to the content list for the Audio Player. */
    private addContent = new Callable("addContent", {
        signature: {
            args: [new StdlibArgument("contentItem", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, contentItem: RoAssociativeArray) => {
            this.contentList.push(contentItem);
            const contents = new Array<string>();
            this.contentList.forEach((value, index, array) => {
                let url = value.get(new BrsString("url"));
                if (url instanceof BrsString) {
                    contents.push(url.value);
                }
            });
            postMessage(contents);
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
            this.contentList = new Array();
            postMessage(new Array<string>());
            return BrsInvalid.Instance;
        },
    });

    /** Puts the Audio Player into play mode starting at the current item in the Content List. */
    private play = new Callable("play", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            postMessage("play");
            return BrsBoolean.True;
        },
    });

    /** Stops the Audio Player from playing or pausing and cleanup */
    private stop = new Callable("stop", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            postMessage("stop");
            return BrsBoolean.True;
        },
    });

    /** Puts the Audio Player into pause mode. */
    private pause = new Callable("pause", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            postMessage("pause");
            return BrsBoolean.True;
        },
    });

    /** Puts the Audio Player into play mode starting from the pause point. */
    private resume = new Callable("resume", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            postMessage("resume");
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
            postMessage(`loop,${enable.toString()}`);
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
            postMessage(`next,${item.toString()}`);
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
            postMessage(`seek,${offsetMs.toString()}`);
            return BrsInvalid.Instance;
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

    /** Sets the roMessagePort to be used for all events from the audio player */
    private setMessagePort = new Callable("setMessagePort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, port: RoMessagePort) => {
            port.enableAudio(true);
            this.port = port;
            return BrsInvalid.Instance;
        },
    });

    /** Sets the roMessagePort to be used for all events from the audio player */
    private setPort = new Callable("setPort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, port: RoMessagePort) => {
            port.enableAudio(true);
            this.port = port;
            return BrsInvalid.Instance;
        },
    });
}
