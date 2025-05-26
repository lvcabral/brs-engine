import { Group } from "./Group";
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
    Poster,
    BrsBoolean,
    BusySpinner,
    Float,
    Label,
    Timer,
    ScrollingLabel,
    BrsInvalid,
    toAssociativeArray,
    RoAssociativeArray,
    RoArray,
} from "..";
import { AudioTrack, isAudioTrack, MediaErrorCode, MediaEvent } from "../../common";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { rotateTranslation } from "../../scenegraph/SGUtil";
import { BrsDevice } from "../../device/BrsDevice";
import { TrickPlayBar } from "./TrickPlayBar";

export class Video extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "content", type: "node" },
        { name: "playStartInfo", type: "assocarray" },
        { name: "licenseStatus", type: "assocarray" },
        { name: "contentIsPlaylist", type: "boolean", value: "false" },
        { name: "contentIndex", type: "integer", value: "-1", alwaysNotify: true },
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
        { name: "duration", type: "time", value: "0", alwaysNotify: true },
        { name: "loop", type: "boolean", value: "false" },
        { name: "position", type: "time", value: "0", alwaysNotify: true },
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
    private readonly titleText: ScrollingLabel;
    private readonly contentTitles: string[];
    private readonly clockText: Label;
    private readonly spinner: BusySpinner;
    private readonly pausedIcon: Poster;
    private readonly trickPlayBar: TrickPlayBar;
    private lastPressHandled: string;
    private enableUI: boolean;
    private enableTrickPlay: boolean;
    private showHeader: number;
    private showPaused: number;
    private showTrickPlay: number;
    private statusChanged: boolean;

    constructor(members: AAMember[] = [], readonly name: string = "Video") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);

        this.enableUI = true;
        this.enableTrickPlay = true;
        this.trickPlayBar = new TrickPlayBar();
        this.spinner = new BusySpinner();
        this.spinner.setPosterUri(`common:/images/${this.resolution}/spinner.png`);
        this.spinner.setFieldValue("spinInterval", new Float(1.0));
        this.spinner.setFieldValue("visible", BrsBoolean.False);
        this.spinner.set(new BrsString("control"), new BrsString("start"));
        this.appendChildToParent(this.spinner);
        if (this.resolution === "FHD") {
            this.titleText = this.addScrollingLabel("textColor", [102, 60], 1020, 0, "LargeSystemFont");
            this.clockText = this.addLabel("textColor", [1644, 60], 174, 36, 36, "top", "right");
            this.spinner.setTranslation([900, 480]);
            this.pausedIcon = this.addPoster("common:/images/FHD/video_pause.png", [902, 483]);
            this.trickPlayBar.setTranslation([102, 948]);
        } else {
            this.titleText = this.addScrollingLabel("textColor", [68, 40], 680, 0, "LargeSystemFont");
            this.clockText = this.addLabel("textColor", [1096, 40], 116, 24, 24, "top", "right");
            this.spinner.setTranslation([600, 320]);
            this.pausedIcon = this.addPoster("common:/images/HD/video_pause.png", [602, 322]);
            this.trickPlayBar.setTranslation([68, 632]);
        }
        this.contentTitles = [];
        this.clockText.setFieldValue("text", new BrsString(BrsDevice.getTime()));
        const clock = new Timer();
        clock.setCallback(() => {
            this.clockText.set(new BrsString("text"), new BrsString(BrsDevice.getTime()));
        });
        clock.set(new BrsString("repeat"), BrsBoolean.True);
        clock.set(new BrsString("control"), new BrsString("start"));
        this.appendChildToParent(clock);
        this.setFieldValue("trickPlayBar", this.trickPlayBar);
        this.appendChildToParent(this.trickPlayBar);
        this.showHeader = 0;
        this.showPaused = 0;
        this.showTrickPlay = 0;
        this.statusChanged = false;
        this.showUI(false);
        postMessage(`video,notify,500`);

        rootObjects.video = this;
        this.lastPressHandled = "";
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }

        const fieldName = index.getValue().toLowerCase();

        if (fieldName === "control" && isBrsString(value)) {
            const validControl = ["play", "pause", "resume", "stop", "replay", "prebuffer", "skipcontent"];
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
        } else if (fieldName === "audiotrack" && isBrsString(value)) {
            postMessage(`video,audio,${value.getValue()}`);
        } else if (fieldName === "content" && value instanceof ContentNode) {
            postMessage({ videoPlaylist: this.formatContent(value) });
            if (this.contentTitles.length > 0) {
                this.setContentIndex(0);
            } else {
                this.titleText.setFieldValue("text", new BrsString(""));
            }
            this.setFieldValue("currentAudioTrack", new BrsString(""));
            this.setFieldValue("availableAudioTracks", new RoArray([]));
        } else if (fieldName === "enableui" && isBrsBoolean(value)) {
            this.enableUI = value.toBoolean();
            this.statusChanged = this.enableUI;
            if (!this.enableUI) {
                this.spinner.setFieldValue("visible", BrsBoolean.False);
                this.showUI(false);
            }
        } else if (fieldName === "enabletrickplay" && isBrsBoolean(value)) {
            this.enableTrickPlay = value.toBoolean();
        }
        return super.set(index, value, alwaysNotify, kind);
    }

    setState(eventType: number, eventIndex: number) {
        const now = Date.now();
        this.statusChanged = true;
        let state = "none";
        switch (eventType) {
            case MediaEvent.LOADING:
                this.showUI(false);
                this.showHeader = now + 5000;
                this.spinner.setFieldValue("visible", BrsBoolean.from(this.enableUI));
                this.setBufferingStatus(eventIndex);
                return;
            case MediaEvent.START_STREAM:
            case MediaEvent.RESUMED:
                state = "playing";
                this.spinner.setFieldValue("visible", BrsBoolean.False);
                this.showUI(false);
                break;
            case MediaEvent.PAUSED:
                state = "paused";
                this.spinner.setFieldValue("visible", BrsBoolean.False);
                this.showHeader = now + 5000;
                this.showTrickPlay = now + 5000;
                this.showPaused = now + 2000;
                break;
            case MediaEvent.PARTIAL:
                state = "stopped";
                break;
            case MediaEvent.FINISHED:
            case MediaEvent.FULL:
                this.spinner.setFieldValue("visible", BrsBoolean.False);
                this.showUI(false);
                state = "finished";
                break;
            case MediaEvent.FAILED:
                this.setErrorFields(eventIndex);
                state = "error";
                postMessage(`video,error`);
                break;
            default:
        }
        if (this.getFieldValue("bufferingStatus") instanceof RoAssociativeArray) {
            this.set(new BrsString("bufferingStatus"), BrsInvalid.Instance);
        }
        super.set(new BrsString("state"), new BrsString(state));
    }

    setContentIndex(index: number) {
        if (index > -1 && index < this.contentTitles.length) {
            console.debug(`Video.setContentIndex: ${index}`, this.contentTitles[index]);
            this.titleText.set(new BrsString("text"), new BrsString(this.contentTitles[index]));
        }
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

    setAudioTracks(tracks: AudioTrack[]) {
        const result: BrsType[] = [];
        if (tracks.length) {
            tracks.forEach((track) => {
                if (isAudioTrack(track)) {
                    const item = {
                        Track: track.id.toString(),
                        Language: track.lang,
                        Name: track.name,
                        Format: track.codec,
                        HasAccessibilityDescription: false,
                        HasAccessibilityEAI: false,
                    };
                    result.push(toAssociativeArray(item));
                }
            });
        }
        this.set(new BrsString("availableAudioTracks"), new RoArray(result));
    }

    setBufferingStatus(percent: number) {
        super.set(new BrsString("state"), new BrsString("buffering"));
        const status = {
            percentage: percent,
            isUnderrun: false,
            prebufferDone: percent > 33,
            actualStart: 0,
        };
        this.set(new BrsString("bufferingStatus"), toAssociativeArray(status));
    }

    setErrorFields(errorCode: number) {
        let errorMsg = "";
        let errorInfo = {
            clipId: this.getFieldValueJS("contentIndex"),
            ignored: false,
            source: "buffer:reader",
            category: "",
            errCode: errorCode,
            dbgmsg: "",
            drmerrcode: 0,
        };
        switch (errorCode) {
            case MediaErrorCode.Http:
                errorMsg = "Network or HTTP error";
                errorInfo.category = "http";
                break;
            case MediaErrorCode.TimeOut:
                errorMsg = "Connection timed out";
                errorInfo.category = "http";
                break;
            case MediaErrorCode.Unknown:
                errorMsg = "Unknown/unspecified or generic error";
                errorInfo.category = "mediaplayer";
                break;
            case MediaErrorCode.EmptyList:
                errorMsg = "Empty list; no streams were specified to play";
                errorInfo.category = "mediaplayer";
                break;
            case MediaErrorCode.Unsupported:
                errorMsg = "Media error; the media format is unknown or unsupported";
                errorInfo.category = "mediaerror";
                break;
            case MediaErrorCode.DRM:
                errorMsg = "DRM error";
                errorInfo.category = "drm";
                break;
        }
        if (errorCode < 0 && errorMsg.length) {
            errorInfo.dbgmsg = errorMsg;
            const errorStr = `category:${errorInfo.category}:error:${errorCode}:ignored:0:source:buffer:reader:message:${errorMsg}`;
            super.set(new BrsString("errorCode"), new Int32(errorCode));
            super.set(new BrsString("errorMsg"), new BrsString(errorMsg));
            super.set(new BrsString("errorStr"), new BrsString(errorStr));
            super.set(new BrsString("errorInfo"), toAssociativeArray(errorInfo));
        }
    }

    showUI(show: boolean) {
        if (!show) {
            this.showHeader = 0;
            this.showPaused = 0;
            this.showTrickPlay = 0;
        }
        const now = Date.now();
        this.titleText.setFieldValue("visible", BrsBoolean.from(this.showHeader > now));
        this.clockText.setFieldValue("visible", BrsBoolean.from(this.showHeader > now));
        this.pausedIcon.setFieldValue("visible", BrsBoolean.from(this.showPaused > now));
        this.trickPlayBar.setFieldValue("visible", BrsBoolean.from(this.showTrickPlay > now));
    }

    handleKey(key: string, press: boolean): boolean {
        if (!press && this.lastPressHandled === key) {
            this.lastPressHandled = "";
            return true;
        }
        let handled = false;
        if (key === "play" && this.enableTrickPlay) {
            const state = this.getFieldValueJS("state") as string;
            if (state === "paused") {
                postMessage("video,resume");
                handled = true;
            } else if (state === "playing") {
                postMessage("video,pause");
                handled = true;
            }
        } else if (key === "OK" && this.enableTrickPlay) {
            const now = Date.now();
            if (this.showHeader < now) {
                this.showHeader = now + 5000;
            }
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
        if (this.statusChanged) {
            this.showUI(this.enableUI);
        }
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.updateParentRects(origin, angle);
    }

    private formatContent(node: ContentNode) {
        const corsProxy = BrsDevice.getCORSProxy();
        const content: Object[] = [];
        this.contentTitles.length = 0;
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
                    this.contentTitles.push(node.getFieldValueJS("title") ?? "");
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
                this.contentTitles.push(node.getFieldValueJS("title") ?? "");
                content.push(item);
            }
        }
        return content;
    }
}
