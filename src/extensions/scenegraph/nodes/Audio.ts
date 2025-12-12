import {
    AAMember,
    BrsDevice,
    BrsString,
    BrsType,
    Double,
    Int32,
    isBrsBoolean,
    isBrsNumber,
    isBrsString,
    MediaEvent,
} from "brs-engine";
import { sgRoot } from "../SGRoot";
import { jsValueOf } from "../factory/serialization";
import { ContentNode } from "./ContentNode";
import { Node } from "./Node";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";

export class Audio extends Node {
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

    constructor(members: AAMember[] = [], readonly name: string = SGNodeType.Audio) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Node);
        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);

        // Prevent initialize Audio in task thread
        if (sgRoot.inTaskThread()) {
            return;
        }

        // Initialize with empty playlist and default settings
        postMessage({ audioPlaylist: new Array<string>() });
        postMessage("audio,loop,false");
        postMessage("audio,next,-1");
        postMessage("audio,mute,false");

        // Set itself as the root audio object
        sgRoot.setAudio(this);
    }

    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "control" && isBrsString(value)) {
            const validControl = ["start", "play", "pause", "resume", "stop"];
            const control = value.getValue().toLowerCase();
            if (validControl.includes(control)) {
                this.checkContentChanged();
                if (!sgRoot.inTaskThread()) postMessage(`audio,${control}`);
            } else {
                value = new BrsString("none");
            }
        } else if (fieldName === "seek" && isBrsNumber(value)) {
            this.checkContentChanged();
            const position = jsValueOf(value) as number;
            if (!sgRoot.inTaskThread()) postMessage(`audio,seek,${position * 1000}`);
        } else if (fieldName === "notificationInterval" && isBrsNumber(value)) {
            if (!sgRoot.inTaskThread()) postMessage(`audio,notify,${Math.round(jsValueOf(value) * 1000)}`);
        } else if (fieldName === "loop" && isBrsBoolean(value)) {
            if (!sgRoot.inTaskThread()) postMessage(`audio,loop,${value.toBoolean()}`);
        } else if (fieldName === "mute" && isBrsBoolean(value)) {
            if (!sgRoot.inTaskThread()) postMessage(`audio,mute,${value.toBoolean()}`);
        } else if (fieldName === "contentIsPlaylist".toLowerCase() && isBrsBoolean(value)) {
            const currentFlag = this.getValueJS("contentIsPlaylist") as boolean;
            const newFlag = value.toBoolean();
            const content = this.getValue("content");
            if (currentFlag !== newFlag && content instanceof ContentNode) {
                // If the contentIsPlaylist flag changed, we need to reset the content
                if (!sgRoot.inTaskThread()) postMessage({ audioPlaylist: this.formatContent(content) });
            }
        } else if (fieldName === "content" && value instanceof ContentNode) {
            if (!sgRoot.inTaskThread()) postMessage({ audioPlaylist: this.formatContent(value) });
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    setState(flags: number) {
        let state = "none";
        switch (flags) {
            case MediaEvent.Loading:
                state = "buffering";
                break;
            case MediaEvent.StartPlay:
            case MediaEvent.StartStream:
            case MediaEvent.Selected:
            case MediaEvent.Resumed:
                state = "playing";
                break;
            case MediaEvent.Paused:
                state = "paused";
                break;
            case MediaEvent.Full:
                state = "finished";
                break;
            case MediaEvent.Failed:
                state = "failed";
                break;
        }
        super.setValue("state", new BrsString(state));
    }

    setContentIndex(index: number) {
        super.setValue("contentIndex", new Int32(index));
    }

    setDuration(duration: number) {
        // Roku rounds the audio duration to integer even being stored in a Double
        super.setValue("duration", new Double(Math.round(duration / 1000)));
    }

    setPosition(position: number) {
        super.setValue("position", new Double(position / 1000));
    }

    private checkContentChanged() {
        const content = this.getValue("content");
        if (content instanceof ContentNode && content.changed) {
            if (!sgRoot.inTaskThread()) postMessage({ audioPlaylist: this.formatContent(content) });
            content.changed = false;
        }
    }

    private formatContent(node: ContentNode) {
        const content = new Array<string>();
        const isPlaylist = this.getValueJS("contentIsPlaylist") as boolean;
        if (isPlaylist) {
            const playList = node.getNodeChildren().filter((node) => node instanceof Node);
            for (const node of playList) {
                const url = node.getValueJS("url") as string;
                if (url?.length && url.startsWith("http")) {
                    content.push(BrsDevice.getCORSProxy(url));
                } else if (url?.length) {
                    content.push(url);
                }
            }
        } else {
            const url = node.getValueJS("url") as string;
            if (url?.length && url.startsWith("http")) {
                content.push(BrsDevice.getCORSProxy(url));
            } else if (url?.length) {
                content.push(url);
            }
        }
        return content;
    }
}
