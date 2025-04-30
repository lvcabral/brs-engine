import { RoSGNode } from "../components/RoSGNode";
import { FieldKind, FieldModel } from "./Field";
import {
    AAMember,
    BrsType,
    BrsInvalid,
    isBrsString,
    isBrsNumber,
    jsValueOf,
    ContentNode,
    isBrsBoolean,
    BrsString,
    Int32,
    rootObjects,
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
        { name: "control", type: "string", value: "none" },
        { name: "notificationInterval", type: "float", value: "0.5" },
        { name: "seek", type: "float" },
        { name: "contentIndex", type: "integer", value: "-1" },
        { name: "state", type: "string", value: "none" },
        { name: "position", type: "integer", value: "0" },
        { name: "duration", type: "integer", value: "0" },
        { name: "errorCode", type: "integer", value: "0" },
        { name: "errorMsg", type: "string", value: "" },
        { name: "audioFormat", type: "string", value: "" },
        { name: "autoplayAfterSeek", type: "boolean", value: "true" },
        { name: "mute", type: "boolean", value: "false" },
        { name: "streamInfo", type: "assocarray" },
        { name: "timeToStartStreaming", type: "integer", value: "0" },
    ];

    constructor(members: AAMember[] = [], readonly name: string = "Audio") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);

        if (!rootObjects.audio) {
            rootObjects.audio = this;
        }
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }

        const fieldName = index.getValue().toLowerCase();
        const readonlyFields = [
            "bufferingstatus",
            "contentindex",
            "state",
            "position",
            "duration",
            "errorCode",
            "errormsg",
            "audioformat",
            "timetostartstreaming",
        ];

        if (fieldName === "control" && isBrsString(value)) {
            let control = value.getValue().toLowerCase();
            if (control === "start" || control === "play") {
                postMessage("audio,play");
                super.set(new BrsString("position"), new Int32(0));
            } else if (control === "pause") {
                postMessage("audio,pause");
            } else if (control === "resume") {
                postMessage("audio,resume");
            } else if (control === "stop") {
                postMessage("audio,stop");
            } else {
                control = "none";
            }
        } else if (fieldName === "seek" && isBrsNumber(value)) {
            const position = jsValueOf(value) as number;
            postMessage(`audio,seek,${position * 1000}`);
        } else if (fieldName === "loop" && isBrsBoolean(value)) {
            postMessage(`audio,loop,${value.toBoolean()}`);
        } else if (fieldName === "content" && value instanceof ContentNode) {
            const corsProxy = BrsDevice.deviceInfo.corsProxy ?? "";
            const content = new Array<string>();
            const isPlaylist = this.getFieldValueJS("contentIsPlaylist") as boolean;
            if (isPlaylist) {
                const playList = value.getNodeChildren();
                playList.forEach((node) => {
                    const url = node.getFieldValueJS("url") as string;
                    if (url?.length && url.startsWith("http")) {
                        content.push(corsProxy + url);
                    } else if (url?.length) {
                        content.push(url);
                    }
                });
            } else {
                const url = value.getFieldValueJS("url") as string;
                if (url?.length && url.startsWith("http")) {
                    content.push(corsProxy + url);
                } else if (url?.length) {
                    content.push(url);
                }
            }
            postMessage(content);
        } else if (readonlyFields.includes(fieldName)) {
            return BrsInvalid.Instance;
        }
        return super.set(index, value, alwaysNotify, kind);
    }

    setAudioState(flags: number) {
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
}
