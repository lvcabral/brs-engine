import { Group } from "./Group";
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
    Double,
    Poster,
    Label,
    Float,
    BrsBoolean,
} from "..";
import { MediaEvent } from "../../common";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { convertHexColor, rotateTranslation } from "../../scenegraph/SGUtil";
import { BrsDevice } from "../../device/BrsDevice";
import { TrickPlayBar } from "./TrickPlayBar";

export class Video extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "content", type: "node" },
        { name: "playStartInfo", type: "assocarray" },
        { name: "licenseStatus", type: "assocarray" },
        { name: "contentIsPlaylist", type: "boolean", value: "false" },
        { name: "contentIndex", type: "integer", value: "-1" },
        { name: "nextContentIndex", type: "integer", value: "-1" },
        { name: "control", type: "string", value: "none" },
        { name: "asyncStopSemantics", type: "boolean", value: "false" },
        { name: "state", type: "string", value: "none" },
        { name: "errorCode", type: "integer", value: "0" },
        { name: "errorMsg", type: "string", value: "" },
        { name: "errorStr", type: "string", value: "" },
        { name: "errorInfo", type: "assocarray" },
        { name: "decoderStats", type: "assocarray" },
        { name: "enableDecoderStats", type: "boolean", value: "false" },
        { name: "playbackActionButtons", type: "array" },
        { name: "playbackActionButtonSelected", type: "integer", value: "0", alwaysNotify: true },
        { name: "playbackActionButtonFocused", type: "integer", value: "0", alwaysNotify: true },
        { name: "playbackActionButtonFocusedTextFont", type: "font", value: "font:SmallBoldSystemFont" },
        { name: "playbackActionButtonUnfocusedTextFont", type: "font", value: "font:SmallSystemFont" },
        { name: "playbackActionButtonFocusedTextColor", type: "color", value: "0x121212FF" },
        { name: "playbackActionButtonUnfocusedTextColor", type: "color", value: "0xEFEFEFFF" },
        { name: "playbackActionButtonFocusIndicatorBlendColor", type: "color" },
        { name: "subtitleSelectionPreferences", type: "assocarray" },
        { name: "audioSelectionPreferences", type: "assocarray" },
        { name: "duration", type: "time", value: "0" },
        { name: "loop", type: "boolean", value: "false" },
        { name: "position", type: "time", value: "0" },
        { name: "positionInfo", type: "assocarray" },
        { name: "clipId", type: "integer", value: "0" },
        { name: "notificationInterval", type: "time", value: "0.5" },
        { name: "seek", type: "time" },
        { name: "seekMode", type: "string", value: "default" },
        { name: "autoPlayAfterSeek", type: "boolean", value: "true" },
        { name: "timedMetaData", type: "assocarray" },
        { name: "timedMetaData2", type: "assocarray" },
        { name: "timedMetaDataSelectionKeys", type: "array" },
        { name: "streamInfo", type: "assocarray" },
        { name: "completedStreamInfo", type: "assocarray" },
        { name: "timeToStartStreaming", type: "time", value: "0" },
        { name: "bufferingStatus", type: "assocarray" },
        { name: "videoFormat", type: "string", value: "" },
        { name: "pauseBufferStart", type: "time", value: "0" },
        { name: "pauseBufferEnd", type: "time", value: "0" },
        { name: "pauseBufferPosition", type: "time", value: "0" },
        { name: "pauseBufferOverflow", type: "boolean", value: "false" },
        { name: "pauseBufferEpochOffset", type: "double" },
        { name: "streamingSegment", type: "assocarray" },
        { name: "downloadedSegment", type: "assocarray" },
        { name: "enableLiveAvailabilityWindow", type: "boolean", value: "false" },
        { name: "enableThumbnailTilesDuringLive", type: "boolean", value: "false" },
        { name: "thumbnailTiles", type: "assocarray" },
        { name: "trickPlayBackgroundOverlay", type: "uri", value: "" },
        { name: "enableUI", type: "boolean", value: "true" },
        { name: "enableTrickPlay", type: "boolean", value: "true" },
        { name: "bifDisplay", type: "node" },
        { name: "trickPlayBar", type: "node" },
        { name: "bufferingBar", type: "node" },
        { name: "bufferingTextColor", type: "color" },
        { name: "retrievingBar", type: "node" },
        { name: "retrievingTextColor", type: "color" },
        { name: "pivotNode", type: "node" },
        { name: "globalCaptionMode", type: "string", value: "Off" },
        { name: "suppressCaptions", type: "boolean", value: "false" },
        { name: "subtitleTrack", type: "string", value: "" },
        { name: "currentSubtitleTrack", type: "string", value: "" },
        { name: "availableSubtitleTracks", type: "array" },
        { name: "captionStyle", type: "assocarray" },
        { name: "mute", type: "boolean", value: "false" },
        { name: "audioTrack", type: "string", value: "" },
        { name: "currentAudioTrack", type: "string", value: "" },
        { name: "availableAudioTracks", type: "array" },
        { name: "seamlessAudioTrackSelection", type: "boolean", value: "false" },
        { name: "audioFormat", type: "string", value: "" },
        { name: "supplementaryAudioVolume", type: "integer", value: "50" },
        { name: "cdnSwitch", type: "array" },
        { name: "MaxVideoDecodeResolution", type: "vector2d", value: "[0, 0]" },
        { name: "cgms", type: "integer", value: "0" },
        { name: "enableScreenSaverWhilePlaying", type: "boolean", value: "false" },
        { name: "disableScreenSaver", type: "boolean", value: "false" },
        { name: "contentBlocked", type: "boolean", value: "false" },
    ];
    private readonly pausedIcon: Poster;
    private readonly trickPlayBar: TrickPlayBar;
    private lastPressHandled: string;

    constructor(members: AAMember[] = [], readonly name: string = "Video") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);

        this.trickPlayBar = new TrickPlayBar();
        if (this.resolution === "FHD") {
            this.pausedIcon = this.addPoster("common:/images/FHD/video_pause.png", [902, 483]);
            this.trickPlayBar.setTranslation([102, 948]);
        } else {
            this.pausedIcon = this.addPoster("common:/images/HD/video_pause.png", [602, 322]);
            this.trickPlayBar.setTranslation([68, 632]);
        }
        this.pausedIcon.setFieldValue("visible", BrsBoolean.False);
        this.trickPlayBar.setFieldValue("visible", BrsBoolean.False);
        this.appendChildToParent(this.trickPlayBar);
        postMessage(`video,notify,500`);

        rootObjects.video = this;
        this.lastPressHandled = "";
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
            "vicdeoformat",
            "timetostartstreaming",
            "currentsubtitletrack",
            "availablesubtitletracks",
            "currentaudiotrack",
            "availableaudiotracks",
            "audioformat",
        ];

        if (fieldName === "control" && isBrsString(value)) {
            const validControl = ["play", "pause", "resume", "stop", "replay", "skipcontent"];
            const control = value.getValue().toLowerCase();
            if (validControl.includes(control)) {
                postMessage(`video,${control}`);
            } else {
                value = new BrsString("none");
            }
        } else if (fieldName === "seek" && isBrsNumber(value)) {
            const position = jsValueOf(value) as number;
            postMessage(`video,seek,${position * 1000}`);
        } else if (fieldName === "notificationinterval" && isBrsNumber(value)) {
            postMessage(`video,notify,${Math.round(jsValueOf(value) * 1000)}`);
        } else if (fieldName === "loop" && isBrsBoolean(value)) {
            postMessage(`video,loop,${value.toBoolean()}`);
        } else if (fieldName === "mute" && isBrsBoolean(value)) {
            postMessage(`video,mute,${value.toBoolean()}`);
        } else if (fieldName === "content" && value instanceof ContentNode) {
            postMessage({ videoPlaylist: this.formatContent(value) });
        } else if (readonlyFields.includes(fieldName)) {
            return BrsInvalid.Instance;
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
                this.pausedIcon.setFieldValue("visible", BrsBoolean.False);
                //this.trickPlayBar.setFieldValue("visible", BrsBoolean.False);
                break;
            case MediaEvent.PAUSED:
                state = "paused";
                this.pausedIcon.setFieldValue("visible", BrsBoolean.True);
                this.trickPlayBar.setFieldValue("visible", BrsBoolean.True);
                break;
            case MediaEvent.PARTIAL:
                state = "stopped";
                break;
            case MediaEvent.FULL:
                state = "finished";
                break;
            case MediaEvent.FAILED:
                state = "error";
                break;
        }
        super.set(new BrsString("state"), new BrsString(state));
    }

    setContentIndex(index: number) {
        super.set(new BrsString("contentIndex"), new Int32(index));
    }

    setDuration(duration: number) {
        super.set(new BrsString("duration"), new Double(duration));
    }

    setPosition(position: number) {
        const duration = this.getFieldValueJS("duration") ?? 0;
        if (position >= 0 && duration > 0) {
            this.trickPlayBar.setPosition(position, duration);
        }
        super.set(new BrsString("position"), new Double(position));
    }

    handleKey(key: string, press: boolean): boolean {
        if (!press && this.lastPressHandled === key) {
            this.lastPressHandled = "";
            return true;
        }
        let handled = false;
        if (key === "play") {
            const state = this.getFieldValueJS("state") as string;
            if (state === "paused") {
                postMessage("video,resume");
                handled = true;
            } else if (state === "playing") {
                postMessage("video,pause");
                handled = true;
            }
        } else if (key === "OK") {
            // Show Video Metadata
        }
        this.lastPressHandled = handled ? key : "";
        return handled;
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = angle !== 0 ? rotateTranslation(nodeTrans, angle) : nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const rect = {
            x: drawTrans[0],
            y: drawTrans[1],
            width: size.width || this.sceneRect.width,
            height: size.height || this.sceneRect.height,
        };
        const rotation = angle + this.getRotation();
        opacity = opacity * this.getOpacity();
        if (this.isDirty) {
            postMessage(`video,rect,${rect.x},${rect.y},${rect.width},${rect.height}`);
            this.isDirty = false;
        }
        draw2D?.doDrawClearedRect(rect);
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.updateParentRects(origin, angle);
    }

    private formatContent(node: ContentNode) {
        const corsProxy = BrsDevice.getCORSProxy();
        const content: Object[] = [];
        const isPlaylist = this.getFieldValueJS("contentIsPlaylist") as boolean;
        if (isPlaylist) {
            const playList = node.getNodeChildren();
            playList.forEach((node) => {
                const url = node.getFieldValueJS("url") as string;
                if (url?.length) {
                    const item = { url: url, streamFormat: node.getFieldValueJS("streamFormat"), audioTrack: -1 };
                    if (url.startsWith("http")) {
                        item.url = corsProxy + url;
                    }
                    content.push(item);
                }
            });
        } else {
            const url = node.getFieldValueJS("url") as string;
            if (url?.length) {
                const item = { url: url, streamFormat: node.getFieldValueJS("streamFormat"), audioTrack: -1 };
                if (url.startsWith("http")) {
                    item.url = corsProxy + url;
                }
                content.push(item);
            }
        }
        return content;
    }
}
