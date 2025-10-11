import { RoSGNode } from "../components/RoSGNode";
import { FieldKind, FieldModel } from "./Field";
import {
    AAMember,
    BrsType,
    isBrsString,
    isBrsNumber,
    jsValueOf,
    ContentNode,
    isBrsBoolean,
    BrsString,
    Int32,
    rootObjects,
    Double,
} from "..";
import { BrsDevice } from "../../device/BrsDevice";
import { MediaEvent } from "../../common";

export class Audio extends RoSGNode {
    readonly defaultFields: FieldModel[] = [
        { name: "content", type: "node" },
        { name: "contentIsPlaylist", type: "boolean", value: "false" },
        { name: "nextContentIndex", type: "integer", value: "-1" },
        { name: "loop", type: "boolean", value: "false" },
        { name: "bufferingStatus", type: "assocarray" },
        { name: "control", type: "string", value: "none", alwaysNotify: true },
        { name: "notificationInterval", type: "time", value: "0.5" },
        { name: "seek", type: "time" },
        { name: "contentIndex", type: "integer", value: "-1", alwaysNotify: true },
        { name: "state", type: "string", value: "none", alwaysNotify: true },
        { name: "position", type: "time", value: "0", alwaysNotify: true },
        { name: "duration", type: "time", value: "0", alwaysNotify: true },
        { name: "errorCode", type: "integer", value: "0" },
        { name: "errorMsg", type: "string", value: "" },
        { name: "audioFormat", type: "string", value: "" },
        { name: "autoplayAfterSeek", type: "boolean", value: "true" },
        { name: "mute", type: "boolean", value: "false" },
        { name: "streamInfo", type: "assocarray" },
        { name: "timeToStartStreaming", type: "time", value: "0" },
    ];

    constructor(members: AAMember[] = [], readonly name: string = "Audio") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);

        postMessage({ audioPlaylist: new Array<string>() });
        postMessage("audio,loop,false");
        postMessage("audio,next,-1");
        postMessage("audio,mute,false");

        rootObjects.audio = this;
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }

        const fieldName = index.getValue().toLowerCase();

        if (fieldName === "control" && isBrsString(value)) {
            const validControl = ["start", "play", "pause", "resume", "stop"];
            const control = value.getValue().toLowerCase();
            if (validControl.includes(control)) {
                postMessage(`audio,${control}`);
            } else {
                value = new BrsString("none");
            }
        } else if (fieldName === "seek" && isBrsNumber(value)) {
            const position = jsValueOf(value) as number;
            postMessage(`audio,seek,${position * 1000}`);
        } else if (fieldName === "notificationInterval" && isBrsNumber(value)) {
            postMessage(`audio,notify,${Math.round(jsValueOf(value) * 1000)}`);
        } else if (fieldName === "loop" && isBrsBoolean(value)) {
            postMessage(`audio,loop,${value.toBoolean()}`);
        } else if (fieldName === "mute" && isBrsBoolean(value)) {
            postMessage(`audio,mute,${value.toBoolean()}`);
        } else if (fieldName === "content" && value instanceof ContentNode) {
            postMessage({ audioPlaylist: this.formatContent(value) });
        }
        return super.set(index, value, alwaysNotify, kind);
    }

    setState(flags: number) {
        let state = "none";
        switch (flags) {
            case MediaEvent.LOADING:
                state = "buffering";
                break;
            case MediaEvent.START_PLAY:
            case MediaEvent.START_STREAM:
            case MediaEvent.SELECTED:
            case MediaEvent.RESUMED:
                state = "playing";
                break;
            case MediaEvent.PAUSED:
                state = "paused";
                break;
            case MediaEvent.FULL:
                state = "finished";
                break;
            case MediaEvent.FAILED:
                state = "failed";
                break;
        }
        super.set(new BrsString("state"), new BrsString(state));
    }

    setContentIndex(index: number) {
        super.set(new BrsString("contentIndex"), new Int32(index));
    }

    setDuration(duration: number) {
        // Roku rounds the audio duration to integer even being stored in a Double
        super.set(new BrsString("duration"), new Double(Math.round(duration / 1000)));
    }

    setPosition(position: number) {
        super.set(new BrsString("position"), new Double(position / 1000));
    }

    private formatContent(node: ContentNode) {
        const corsProxy = BrsDevice.getCORSProxy();
        const content = new Array<string>();
        const isPlaylist = this.getFieldValueJS("contentIsPlaylist") as boolean;
        if (isPlaylist) {
            const playList = node.getNodeChildren();
            for (const node of playList) {
                const url = node.getFieldValueJS("url") as string;
                if (url?.length && url.startsWith("http")) {
                    content.push(corsProxy + url);
                } else if (url?.length) {
                    content.push(url);
                }
            }
        } else {
            const url = node.getFieldValueJS("url") as string;
            if (url?.length && url.startsWith("http")) {
                content.push(corsProxy + url);
            } else if (url?.length) {
                content.push(url);
            }
        }
        return content;
    }
}
