import { Group } from "./Group";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import {
    AAMember,
    Interpreter,
    BrsBoolean,
    BrsDevice,
    BrsInvalid,
    BrsString,
    BrsType,
    Double,
    FlexObject,
    Float,
    Int32,
    IfDraw2D,
    isBrsBoolean,
    isNumberComp,
    isBrsString,
    RoArray,
    RoAssociativeArray,
    CaptionOptions,
    CaptionStyleOption,
    getNow,
    MediaErrorCode,
    MediaEvent,
    MediaTrack,
    parseCaptionMode,
} from "brs-engine";
import { fromAssociativeArray, toAssociativeArray, jsValueOf } from "../factory/Serializer";
import { sgRoot } from "../SGRoot";
import { BusySpinner } from "./BusySpinner";
import { ContentNode } from "./ContentNode";
import { Label } from "./Label";
import { Node } from "./Node";
import { Poster } from "./Poster";
import { ScrollingLabel } from "./ScrollingLabel";
import { Timer } from "./Timer";
import { rotateTranslation } from "../SGUtil";
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
    private readonly audioTracks: MediaTrack[] = [];
    private readonly subtitleTracks: MediaTrack[] = [];
    private readonly clockText: Label;
    private readonly spinner: BusySpinner;
    private readonly pausedIcon: Poster;
    private readonly trickPlayBar: TrickPlayBar;
    private readonly backgroundOverlay: Poster;
    private lastPressHandled: string;
    private enableUI: boolean;
    private enableTrickPlay: boolean;
    private showHeader: number;
    private showPaused: number;
    private showTrickPlay: number;
    private trickPlayPos: number;
    private seekMode: "off" | "skip" | "rw" | "ff";
    private seekLevel: number;
    private seekTimeout: number;
    private statusChanged: boolean;
    private seeking: boolean;

    constructor(members: AAMember[] = [], readonly name: string = SGNodeType.Video) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);
        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);

        this.enableUI = true;
        this.enableTrickPlay = true;
        const overlayUri = "common:/images/video_trickplay_overlay.png";
        this.backgroundOverlay = this.addPoster(overlayUri, [0, 0], this.sceneRect.width, this.sceneRect.height);
        this.backgroundOverlay.setValueSilent("visible", BrsBoolean.False);
        this.linkField(this.backgroundOverlay, "uri", "trickPlayBackgroundOverlay");
        this.trickPlayBar = new TrickPlayBar();
        this.trickPlayBar.setValue("visible", BrsBoolean.False);
        this.spinner = new BusySpinner();
        this.spinner.setValueSilent("spinInterval", new Float(1));
        this.spinner.setValueSilent("visible", BrsBoolean.False);
        this.spinner.setValue("control", new BrsString("start"));
        this.appendChildToParent(this.spinner);
        if (this.resolution === "FHD") {
            this.titleText = this.addScrollingLabel("", [102, 60], 1020, 0, "LargeSystemFont");
            this.clockText = this.addLabel("", [1644, 60], 174, 36, 36, "top", "right");
            this.spinner.setTranslation([900, 480]);
            this.pausedIcon = this.addPoster("common:/images/FHD/video_pause.png", [902, 483], 117, 117);
            this.trickPlayBar.setTranslation([102, 948]);
        } else {
            this.titleText = this.addScrollingLabel("", [68, 40], 680, 0, "LargeSystemFont");
            this.clockText = this.addLabel("", [1096, 40], 116, 24, 24, "top", "right");
            this.spinner.setTranslation([600, 320]);
            this.pausedIcon = this.addPoster("common:/images/HD/video_pause.png", [602, 322], 78, 78);
            this.trickPlayBar.setTranslation([68, 632]);
        }
        this.contentTitles = [];
        this.clockText.setValueSilent("text", new BrsString(BrsDevice.getTime()));
        this.setValueSilent("trickPlayBar", this.trickPlayBar);
        this.appendChildToParent(this.trickPlayBar);
        this.showHeader = 0;
        this.showPaused = 0;
        this.showTrickPlay = 0;
        this.seekMode = "off";
        this.seekLevel = 0;
        this.seekTimeout = 0;
        this.trickPlayPos = -1;
        this.seeking = false;
        this.statusChanged = false;
        this.lastPressHandled = "";

        // Prevent initializing Video in Task Thread
        if (sgRoot.inTaskThread()) {
            return;
        }
        // Initialize Clock Timer
        const clock = new Timer();
        clock.setCallback(() => {
            this.clockText.setValue("text", new BrsString(BrsDevice.getTime()));
        });
        clock.setValueSilent("repeat", BrsBoolean.True);
        clock.setValue("control", new BrsString("start"));
        this.appendChildToParent(clock);

        // Reset UI state
        this.showUI(false);

        // Reset Video state on Rendering Thread
        postMessage("video,loop,false");
        postMessage("video,next,-1");
        postMessage("video,mute,false");
        postMessage(`video,notify,500`);
        postMessage({ supportCaptions: true });
        postMessage({ captionMode: BrsDevice.deviceInfo.captionMode });
        postMessage({ captionStyle: new Array<CaptionStyleOption>() });

        // Set itself as the root video object
        sgRoot.setVideo(this);
    }

    get(index: BrsType) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.getValue().toLowerCase();

        if (fieldName === "globalCaptionMode".toLowerCase()) {
            return new BrsString(BrsDevice.deviceInfo.captionMode);
        }

        return super.get(index);
    }

    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        const fieldName = index.toLowerCase();

        if (fieldName === "control" && isBrsString(value)) {
            const validControl = ["play", "pause", "resume", "stop", "replay", "prebuffer", "skipcontent"];
            const control = value.getValue().toLowerCase();
            if (validControl.includes(control)) {
                this.checkContentChanged();
                if (!sgRoot.inTaskThread()) postMessage(`video,${control}`);
            } else if (control !== "none") {
                BrsDevice.stderr.write(`warning,${getNow()} [sg.video.cntrl.bad] control field set to invalid value`);
                return;
            }
        } else if (fieldName === "seek" && isNumberComp(value)) {
            this.checkContentChanged();
            const position = jsValueOf(value) as number;
            if (!sgRoot.inTaskThread()) postMessage(`video,seek,${position * 1000}`);
        } else if (fieldName === "notificationinterval" && isNumberComp(value)) {
            if (!sgRoot.inTaskThread()) postMessage(`video,notify,${Math.round(jsValueOf(value) * 1000)}`);
        } else if (fieldName === "loop" && isBrsBoolean(value)) {
            if (!sgRoot.inTaskThread()) postMessage(`video,loop,${value.toBoolean()}`);
        } else if (fieldName === "mute" && isBrsBoolean(value)) {
            if (!sgRoot.inTaskThread()) postMessage(`video,mute,${value.toBoolean()}`);
        } else if (fieldName === "audiotrack" && isBrsString(value)) {
            if (!sgRoot.inTaskThread()) postMessage(`video,audio,${value.getValue()}`);
        } else if (fieldName === "subtitletrack" && isBrsString(value)) {
            if (!sgRoot.inTaskThread()) postMessage(`video,subtitle,${value.getValue()}`);
        } else if (fieldName === "contentisplaylist" && isBrsBoolean(value)) {
            const currentFlag = this.getValueJS("contentIsPlaylist");
            const newFlag = value.toBoolean();
            super.setValue(index, value, alwaysNotify, kind);
            const content = this.getValue("content");
            if (currentFlag !== newFlag && content instanceof ContentNode) {
                // If the contentIsPlaylist flag changed, we need to reset the content
                this.resetContent(content);
            }
            return;
        } else if (fieldName === "content" && value instanceof ContentNode) {
            this.resetContent(value);
        } else if (fieldName === "enableui" && isBrsBoolean(value)) {
            this.enableUI = value.toBoolean();
            this.statusChanged = this.enableUI;
            if (!this.enableUI) {
                this.spinner.setValueSilent("visible", BrsBoolean.False);
                this.showUI(false);
            }
        } else if (fieldName === "enabletrickplay" && isBrsBoolean(value)) {
            this.enableTrickPlay = value.toBoolean();
        } else if (fieldName === "globalcaptionmode" && isBrsString(value)) {
            const mode = parseCaptionMode(value.getValue());
            if (mode) {
                BrsDevice.deviceInfo.captionMode = mode;
                if (!sgRoot.inTaskThread()) postMessage({ captionMode: mode });
            } else {
                BrsDevice.stderr.write(
                    `warning,${getNow()} [sg.video.mode.set.bad] globalCaptionMode set to bad value '${mode}'`
                );
                return;
            }
        } else if (fieldName === "captionstyle" && value instanceof RoAssociativeArray) {
            this.setCaptionStyle(fromAssociativeArray(value));
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    setState(eventType: number, eventIndex: number) {
        const now = Date.now();
        this.statusChanged = true;
        let state = "none";
        switch (eventType) {
            case MediaEvent.Loading:
                this.showUI(false);
                this.resetSeeking();
                this.showHeader = now + 5000;
                this.spinner.setValueSilent("visible", BrsBoolean.from(this.enableUI));
                this.setBufferingStatus(eventIndex);
                return;
            case MediaEvent.StartStream:
            case MediaEvent.Resumed:
                state = "playing";
                this.resetSeeking();
                this.spinner.setValueSilent("visible", BrsBoolean.False);
                if (eventType === MediaEvent.Resumed) this.showUI(false);
                break;
            case MediaEvent.Paused:
                state = "paused";
                this.spinner.setValueSilent("visible", BrsBoolean.False);
                if (this.trickPlayPos === -1) {
                    this.showHeader = now + 5000;
                    this.showTrickPlay = now + 5000;
                    this.showPaused = now + 2000;
                }
                break;
            case MediaEvent.Partial:
                state = "stopped";
                break;
            case MediaEvent.Finished:
            case MediaEvent.Full:
                this.spinner.setValueSilent("visible", BrsBoolean.False);
                this.showUI(false);
                state = "finished";
                break;
            case MediaEvent.Failed:
                this.setErrorFields(eventIndex);
                state = "error";
                if (!sgRoot.inTaskThread()) postMessage(`video,error`);
                break;
            default:
        }
        if (this.getValue("bufferingStatus") instanceof RoAssociativeArray) {
            this.setValue("bufferingStatus", BrsInvalid.Instance);
        }
        super.setValue("state", new BrsString(state));
    }

    private resetContent(content: ContentNode) {
        if (sgRoot.inTaskThread()) return;
        postMessage({ videoPlaylist: this.formatContent(content) });
        if (this.contentTitles.length > 0) {
            this.setContentIndex(0);
        } else {
            this.titleText.setValueSilent("text", new BrsString(""));
        }
        this.resetSeeking();
        this.setValueSilent("currentAudioTrack", new BrsString(""));
        this.setValueSilent("availableAudioTracks", new RoArray([]));
        this.setValueSilent("currentSubtitleTrack", new BrsString(""));
        this.setValueSilent("availableSubtitleTracks", new RoArray([]));
        content.changed = false;
    }

    setContentIndex(index: number) {
        if (index > -1 && index < this.contentTitles.length) {
            this.titleText.setValue("text", new BrsString(this.contentTitles[index]));
        }
        super.setValue("contentIndex", new Int32(index));
    }

    setDuration(duration: number) {
        super.setValue("duration", new Double(duration));
    }

    setPosition(position: number) {
        const duration = this.getValueJS("duration") ?? 0;
        if (position >= 0 && duration > 0) {
            this.trickPlayBar.setPosition(position, duration);
            if (this.seeking) {
                this.spinner.setValueSilent("visible", BrsBoolean.False);
                this.setState(MediaEvent.Resumed, 0);
                this.seeking = false;
            }
        }
        super.setValue("position", new Double(position));
    }

    setCurrentAudioTrack(trackIdx: number) {
        if (trackIdx >= 0 && trackIdx < this.audioTracks.length) {
            const track = this.audioTracks[trackIdx];
            this.setValue("currentAudioTrack", new BrsString(track.id));
        }
    }

    setAudioTracks(tracks: MediaTrack[]) {
        const result: BrsType[] = [];
        this.audioTracks.length = 0;
        if (tracks.length) {
            for (const track of tracks) {
                this.audioTracks.push(track);
                const item = {
                    Track: track.id,
                    Language: track.lang,
                    Name: track.name,
                    Format: track.codec,
                    HasAccessibilityDescription: false,
                    HasAccessibilityEAI: false,
                };
                result.push(toAssociativeArray(item));
            }
        }
        this.setValue("availableAudioTracks", new RoArray(result));
    }

    setCurrentSubtitleTrack(trackIdx: number) {
        if (trackIdx >= 0 && trackIdx < this.subtitleTracks.length) {
            const track = this.subtitleTracks[trackIdx];
            this.setValue("currentSubtitleTrack", new BrsString(track.id));
        }
    }

    setSubtitleTracks(tracks: MediaTrack[]) {
        const result: BrsType[] = [];
        this.subtitleTracks.length = 0;
        if (tracks.length) {
            for (const track of tracks) {
                this.subtitleTracks.push(track);
                const item = {
                    TrackName: track.id,
                    Language: track.lang,
                    Description: track.name,
                    HasAccessibilityDescription: false,
                    HasAccessibilityCaption: false,
                    HasAccessibilitySign: false,
                };
                result.push(toAssociativeArray(item));
            }
        }
        this.setValue("availableSubtitleTracks", new RoArray(result));
    }

    setCaptionStyle(styles: FlexObject) {
        const validStyles: CaptionStyleOption[] = [];
        for (const key in styles) {
            const id = key.toLowerCase();
            if (id.includes("/") && CaptionOptions.has(id)) {
                const value = styles[key];
                if (typeof value === "string" && CaptionOptions.get(id)?.includes(value.toLowerCase())) {
                    validStyles.push({ id, style: value.toLowerCase() });
                } else {
                    BrsDevice.stderr.write(
                        `warning,${getNow()} [sg.video.cap.val.err] caption style '${value}' is not a valid '${key}'. Using default.`
                    );
                }
            } else {
                BrsDevice.stderr.write(`warning,${getNow()} [sg.video.cap.attr.err] caption style '${key}' is invalid`);
            }
        }
        if (validStyles.length > 0) {
            if (!sgRoot.inTaskThread()) postMessage({ captionStyle: validStyles });
        } else {
            BrsDevice.stderr.write(
                `warning,${getNow()} [sg.video.cap.empty] caption style is empty or invalid. Using default.`
            );
        }
    }

    setBufferingStatus(percent: number) {
        super.setValue("state", new BrsString("buffering"));
        const status = {
            percentage: percent,
            isUnderrun: false,
            prebufferDone: percent > 33,
            actualStart: 0,
        };
        this.setValue("bufferingStatus", toAssociativeArray(status));
    }

    setErrorFields(errorCode: number) {
        let errorMsg = "";
        let errorInfo = {
            clipId: this.getValueJS("contentIndex"),
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
            super.setValue("errorCode", new Int32(errorCode));
            super.setValue("errorMsg", new BrsString(errorMsg));
            super.setValue("errorStr", new BrsString(errorStr));
            super.setValue("errorInfo", toAssociativeArray(errorInfo));
        }
    }

    showUI(show: boolean) {
        if (sgRoot.inTaskThread()) return;
        if (!show) {
            this.showHeader = 0;
            this.showPaused = 0;
            this.showTrickPlay = 0;
        }
        const now = Date.now();
        this.backgroundOverlay.setValueSilent("visible", BrsBoolean.from(this.showHeader > now));
        this.titleText.setValue("visible", BrsBoolean.from(this.showHeader > now));
        this.clockText.setValueSilent("visible", BrsBoolean.from(this.showHeader > now));
        this.pausedIcon.setValueSilent("visible", BrsBoolean.from(this.showPaused > now));
        this.trickPlayBar.setValue("visible", BrsBoolean.from(this.showTrickPlay > now));
    }

    handleKey(key: string, press: boolean): boolean {
        if (sgRoot.inTaskThread()) return false;
        if (!press && this.lastPressHandled === key) {
            this.lastPressHandled = "";
            return true;
        }
        let handled = false;
        if (key === "play" && this.enableTrickPlay) {
            const state = this.getValueJS("state") as string;
            if (state === "paused") {
                if (this.trickPlayPos >= 0) {
                    postMessage(`video,seek,${this.trickPlayPos * 1000}`);
                    this.trickPlayPos = -1;
                    this.spinner.setValueSilent("visible", BrsBoolean.from(this.enableUI));
                    this.seeking = true;
                    this.showUI(false);
                } else {
                    postMessage("video,resume");
                }
                handled = true;
            } else if (state === "playing") {
                postMessage("video,pause");
                handled = true;
            }
        } else if (key === "OK" && this.enableTrickPlay) {
            const now = Date.now();
            if (this.showHeader < now) {
                this.showHeader = now + 5000;
                handled = true;
            }
            if (this.trickPlayPos >= 0) {
                postMessage(`video,seek,${this.trickPlayPos * 1000}`);
                this.trickPlayPos = -1;
                this.spinner.setValueSilent("visible", BrsBoolean.from(this.enableUI));
                this.showUI(false);
                this.seeking = true;
                handled = true;
            }
        } else if (key === "replay" && this.enableTrickPlay) {
            const state = this.getValueJS("state") as string;
            if (state === "playing") {
                const position = this.getValueJS("position") as number;
                if (position > 0) {
                    const now = Date.now();
                    postMessage(`video,seek,${Math.max(0, position - 20) * 1000}`);
                    this.showHeader = now + 1000;
                    this.showTrickPlay = now + 1000;
                    this.trickPlayBar.setStateIcon("replay", 500);
                    handled = true;
                }
            }
        } else if ((key === "left" || key === "right") && this.enableTrickPlay) {
            handled = this.handleLeftRight(key);
        } else if ((key === "rewind" || key === "fastforward") && this.enableTrickPlay) {
            handled = this.handleRewFastForward(key);
        }
        this.lastPressHandled = handled ? key : "";
        return handled;
    }

    private handleLeftRight(key: string) {
        const duration = this.getValueJS("duration") as number;
        if (duration <= 0) {
            return false;
        }
        const state = this.getValueJS("state") as string;
        if (state !== "paused") {
            postMessage("video,pause");
        }
        if (this.trickPlayPos < 0) {
            this.seekMode = "skip";
            this.seekLevel = 1;
            this.seekTimeout = 0;
            this.trickPlayPos = this.getValueJS("position") as number;
        } else if (this.seekMode !== "skip") {
            this.seekMode = "skip";
            this.seekLevel = 1;
            this.seekTimeout = 0;
            this.trickPlayBar.setStateIcon("", 0);
            return true;
        }
        this.updateSeekStep(key === "right", duration);
        this.trickPlayBar.setStateIcon(`skip-${key}`, 500);
        return true;
    }

    private handleRewFastForward(key: string) {
        const duration = this.getValueJS("duration") as number;
        if (duration <= 0) {
            return false;
        }
        const state = this.getValueJS("state") as string;
        if (state !== "paused") {
            postMessage("video,pause");
        }
        const mode = key === "rewind" ? "rw" : "ff";
        if (this.trickPlayPos < 0) {
            this.seekMode = mode;
            this.seekLevel = 1;
            this.trickPlayPos = this.getValueJS("position") as number;
        } else if (this.seekMode === "skip") {
            this.seekMode = mode;
            this.seekLevel = 1;
        } else if (this.seekMode !== mode) {
            this.seekMode = "skip";
            this.seekLevel = 1;
            this.seekTimeout = 0;
            this.trickPlayBar.setStateIcon("", 0);
            return true;
        } else {
            this.seekLevel = Math.min(3, this.seekLevel + 1);
        }
        this.updateSeekStep(mode === "ff", duration, Math.trunc(1000 / this.seekLevel));
        this.trickPlayBar.setStateIcon(`${this.seekMode}-x${this.seekLevel}`);
        return true;
    }

    private updateSeekStep(forward: boolean, duration: number, timeout = 0) {
        const now = Date.now();
        const baseStep = Math.min(10, Math.max(1, Math.trunc(duration / 30)));
        const step = baseStep * Math.max(1, this.seekLevel * 3 - 3);
        this.showHeader = now + 30000;
        this.showTrickPlay = now + 30000;
        const newPos = forward ? this.trickPlayPos + step : this.trickPlayPos - step;
        this.trickPlayPos = Math.max(0, Math.min(newPos, duration));
        this.trickPlayBar.setPosition(this.trickPlayPos, duration);
        if (timeout > 0) {
            this.seekTimeout = now + timeout;
        }
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible() || sgRoot.inTaskThread()) {
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = angle === 0 ? nodeTrans.slice() : rotateTranslation(nodeTrans, angle);
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
            if (this.seekTimeout > 0 && this.seekTimeout < Date.now() && ["rw", "ff"].includes(this.seekMode)) {
                const duration = this.getValueJS("duration") as number;
                this.updateSeekStep(this.seekMode === "ff", duration, Math.trunc(1000 / this.seekLevel));
            }
            this.showUI(this.enableUI);
        }
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.updateParentRects(origin, angle);
    }

    private resetSeeking() {
        this.seekMode = "off";
        this.trickPlayPos = -1;
        this.seeking = false;
        this.seekLevel = 0;
        this.seekTimeout = 0;
        this.trickPlayBar.setStateIcon("", 0);
    }

    private checkContentChanged() {
        const content = this.getValue("content");
        if (content instanceof ContentNode && content.changed) {
            this.resetContent(content);
        }
    }

    private formatContent(node: ContentNode) {
        const content: Object[] = [];
        this.contentTitles.length = 0;
        const isPlaylist = this.getValueJS("contentIsPlaylist") as boolean;
        if (isPlaylist) {
            const playList = node.getNodeChildren().filter((node) => node instanceof Node);
            for (const node of playList) {
                const url = node.getValueJS("url") as string;
                if (url?.length) {
                    const item = { url: url, streamFormat: node.getValueJS("streamFormat"), audioTrack: -1 };
                    if (url.startsWith("http")) {
                        item.url = BrsDevice.getCORSProxy(url);
                    }
                    this.contentTitles.push(node.getValueJS("title") ?? "");
                    content.push(item);
                }
            }
        } else {
            const url = node.getValueJS("url") as string;
            if (url?.length) {
                const item = { url: url, streamFormat: node.getValueJS("streamFormat"), audioTrack: -1 };
                if (url.startsWith("http")) {
                    item.url = BrsDevice.getCORSProxy(url);
                }
                this.contentTitles.push(node.getValueJS("title") ?? "");
                content.push(item);
            }
        }
        return content;
    }
}
