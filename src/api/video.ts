/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SubscribeCallback, formatLocale, saveDataBuffer } from "./util";
import { BufferType, DataType, MediaEvent, MediaErrorCode, platform, MediaTrack, DeviceInfo } from "../core/common";
import Hls from "hls.js";

// Video Objects
export let player: HTMLVideoElement;
let hls: Hls | undefined;
let packageVideos = new Map();
let currentFrame = 0;
let playerState: string = "stop";
let videosState = false;
let playList = new Array();
let playIndex = 0;
let playLoop = false;
let playNext = -1;
let sharedArray: Int32Array;
let notifyTime = false;
let bufferOnly = false;
let canPlay = false;
let loadProgress = 0;
let videoDuration = 0;
let startPosition = 0;
let videoMuted = false;
let uiMuted = false;
let previousBuffered = 0;
let previousTime = Date.now();
let deviceLocale = "";
let audioLocale = "";
const audioTracks: MediaTrack[] = [];

// Initialize Video Module
if (typeof document !== "undefined") {
    player = document.getElementById("player") as HTMLVideoElement;
}
export function initVideoModule(array: Int32Array, mute: boolean = false, deviceData: DeviceInfo) {
    if (player) {
        player.addEventListener("canplay", (e: Event) => {
            loadProgress = 1000;
            Atomics.store(sharedArray, DataType.VLP, loadProgress);
            canPlay = true;
            if (playerState !== "play" && !bufferOnly) {
                playVideo();
            }
        });
        player.addEventListener("playing", (e: Event) => {
            if (playerState !== "pause") {
                setAudioTrack(playList[playIndex]?.audioTrack ?? -1);
                Atomics.store(sharedArray, DataType.VDX, currentFrame);
                Atomics.store(sharedArray, DataType.VDO, MediaEvent.START_STREAM);
            }
            notifyAll("play");
        });
        player.addEventListener("timeupdate", (e: Event) => {
            if (notifyTime) {
                Atomics.store(sharedArray, DataType.VPS, Math.round(player.currentTime));
            }
        });
        player.addEventListener("error", (e: Event) => {
            canPlay = false;
            let errorCode = MediaErrorCode.Http;
            if (player.error?.code === MediaError.MEDIA_ERR_DECODE) {
                errorCode = MediaErrorCode.Unsupported;
            }
            Atomics.store(sharedArray, DataType.VDX, errorCode);
            Atomics.store(sharedArray, DataType.VDO, MediaEvent.FAILED);
            notifyAll("warning", `[video] Player Media Error ${player.error?.code}; ${player.error?.message}`);
        });
        player.addEventListener("ended", nextVideo);
        player.addEventListener("loadstart", startProgress);
        player.addEventListener("durationchange", setDuration);
        player.addEventListener("loadedmetadata", startProgress);
        player.addEventListener("loadeddata", startProgress);
        player.addEventListener("progress", calculateBandwidth);
        player.muted = true;
        player.defaultMuted = true;
        uiMuted = mute;
    }
    deviceLocale = deviceData.locale.toLowerCase().slice(0, 2);
    audioLocale = deviceData.audioLanguage.toLowerCase().slice(0, 2);
    sharedArray = array;
    resetVideo();
}
function calculateBandwidth(e: Event) {
    if (hls === undefined && player && player.buffered.length > 0) {
        let totalBuffered = 0;
        for (let i = 0; i < player.buffered.length; i++) {
            totalBuffered += player.buffered.end(i) - player.buffered.start(i);
        }
        totalBuffered = player.videoWidth * player.videoHeight * 4 * totalBuffered;
        const bufferedSinceLast = totalBuffered - previousBuffered;
        let downloadedBits = bufferedSinceLast * 8;
        const currentTime = Date.now();
        const timeElapsed = (currentTime - previousTime) / 1000; // Convert to seconds
        const bandwidth = downloadedBits / timeElapsed / 1024;
        previousBuffered = totalBuffered;
        previousTime = currentTime;
        notifyAll("bandwidth", Math.round(bandwidth));
    }
}
// Observers Handling
const observers = new Map();
export function subscribeVideo(observerId: string, observerCallback: SubscribeCallback) {
    observers.set(observerId, observerCallback);
}
export function unsubscribeVideo(observerId: string) {
    observers.delete(observerId);
}
function notifyAll(eventName: string, eventData?: any) {
    if (["play", "pause", "stop"].includes(eventName)) {
        playerState = eventName;
    }
    observers.forEach((callback, id) => {
        callback(eventName, eventData);
    });
}

// Video Module Public Functions
export function handleVideoEvent(eventData: string) {
    const data = eventData.split(",");
    if (data[1] === "play") {
        playVideo();
    } else if (data[1] === "load") {
        loadVideo(true);
    } else if (data[1] === "rect" && data.length === 6) {
        notifyAll("rect", {
            x: parseInt(data[2]),
            y: parseInt(data[3]),
            w: parseInt(data[4]),
            h: parseInt(data[5]),
        });
    } else if (data[1] === "notify" && data.length === 3) {
        notifyTime = parseInt(data[2]) >= 1;
    } else if (data[1] === "stop") {
        stopVideo();
    } else if (data[1] === "pause") {
        pauseVideo();
    } else if (data[1] === "resume") {
        resumeVideo();
    } else if (data[1] === "mute") {
        if (data[2] && player) {
            videoMuted = data[2] === "true";
            player.muted = uiMuted || videoMuted;
        }
    } else if (data[1] === "loop") {
        if (data[2]) {
            setVideoLoop(data[2] === "true");
        }
    } else if (data[1] === "next") {
        const newIndex = data[2];
        if (newIndex && !isNaN(parseInt(newIndex))) {
            setNextVideo(parseInt(newIndex));
        } else {
            Atomics.store(sharedArray, DataType.VDX, MediaErrorCode.EmptyList);
            Atomics.store(sharedArray, DataType.VDO, MediaEvent.FAILED);
            notifyAll("warning", `[video] Invalid next index: ${eventData}`);
        }
    } else if (data[1] === "seek") {
        const position = data[2];
        if (position && !isNaN(parseInt(position))) {
            seekVideo(Math.round(parseInt(position) / 1000));
        } else {
            notifyAll("warning", `[video] Invalid seek position: ${eventData}`);
        }
    } else if (data[1] === "audio") {
        setAudioTrack(audioTracks.findIndex((t) => t.id === data[2]));
    } else if (data[1] === "error") {
        stopVideo(true);
    }
}

export function muteVideo(mute: boolean = false) {
    if (player) {
        uiMuted = mute;
        player.muted = mute || videoMuted;
    }
}

export function isVideoMuted() {
    return uiMuted ?? false;
}

export function switchVideoState(play: boolean) {
    if (play && videosState) {
        player.play();
        videosState = false;
    } else {
        videosState = false;
        if (playerState === "play") {
            videosState = true;
            player.pause();
        }
    }
}

export function videoFormats() {
    const codecs: string[] = [];
    const containers: string[] = [];
    if (platform.inBrowser) {
        // Mime and Codecs browser test page
        // https://cconcolato.github.io/media-mime-support/
        const formats = new Map([
            ["av1", `video/mp4; codecs="av01.0.05M.08"`],
            ["mpeg4 avc", `video/mp4; codecs="avc1.42E01E"`],
            ["hevc", `video/mp4; codecs="hev1.2.4.L120.B0"`],
            ["vp8", `video/webm; codecs="vp8, vorbis"`],
            ["vp9", `video/mp4; codecs="vp09.00.50.08"`],
            ["mpeg1", "video/mpeg"],
            ["mpeg2", "video/mpeg2"],
        ]);
        formats.forEach((mime: string, codec: string) => {
            if (player.canPlayType(mime) !== "") {
                codecs.push(codec);
            }
        });
        // All Browsers Support mp4, m4v and mov, only Chromium supports mkv natively
        // https://stackoverflow.com/questions/57060193/browser-support-for-mov-video
        containers.push.apply(containers, ["mp4", "m4v", "mov"]);
        if (player.canPlayType("application/vnd.apple.mpegurl") || Hls.isSupported()) {
            containers.push("hls");
        }
        if (player.canPlayType("video/mp2t") !== "") {
            containers.push("ts");
        }
        if (platform.inChromium) {
            containers.push("mkv");
        }
    }
    return new Map([
        ["codecs", codecs],
        ["containers", containers],
    ]);
}

export function addVideo(path: string, data: Blob) {
    packageVideos.set(path.toLowerCase(), data);
}

export function addVideoPlaylist(newList: any[]) {
    if (playList.length > 0) {
        stopVideo();
    }
    playList = newList;
    playIndex = 0;
    playNext = -1;
    startPosition = 0;
}

export function resetVideo() {
    stopVideo();
    if (player.src.startsWith("blob:")) {
        revokeVideoURL(player.src);
    }
    playList = new Array();
    packageVideos = new Map();
    playIndex = 0;
    playLoop = false;
    playNext = -1;
    startPosition = 0;
    playerState = "stop";
    videosState = false;
}

// Video Module Private Functions
function startProgress(e: Event) {
    if (e.type === "loadeddata") {
        const currAudioTrack = loadAudioTracks();
        const tracks = { audio: audioTracks };
        saveDataBuffer(sharedArray, JSON.stringify(tracks), BufferType.MEDIA_TRACKS);
        Atomics.store(sharedArray, DataType.VAT, currAudioTrack);
    } else if (e.type === "loadedmetadata") {
        if (startPosition > 0) {
            player.currentTime = startPosition;
            startPosition = 0;
        }
    }
    loadProgress += 200;
    Atomics.store(sharedArray, DataType.VLP, loadProgress);
}

function setDuration(e: Event) {
    if (!isNaN(player.duration)) {
        videoDuration = Math.round(player.duration);
        Atomics.store(sharedArray, DataType.VDR, videoDuration);
    }
    if (playerState !== "play") {
        startProgress(e);
    }
}

function loadAudioTracks() {
    audioTracks.length = 0;
    if (!hls) {
        return -1;
    }
    let preferredTrackId = -1;
    let deviceTrackId = -1;
    let englishTrackId = -1;
    hls.audioTracks.forEach((track, index) => {
        const audioTrack: MediaTrack = {
            id: `${index + 1}`,
            name: track.name,
            lang: track.lang ?? "",
            codec: track.audioCodec,
        };
        audioTracks.push(audioTrack);
        // Format the language code
        const lang = formatLocale(audioTrack.lang);
        // Save the track ids for preferred locale, device locale and english
        if (preferredTrackId === -1 && lang === audioLocale) {
            preferredTrackId = track.id;
        } else if (deviceTrackId === -1 && lang === deviceLocale) {
            deviceTrackId = track.id;
        } else if (englishTrackId === -1 && lang === "en") {
            englishTrackId = track.id;
        }
    });
    let activeTrack = 0;
    if (audioTracks.length > 0) {
        // Set the active track prioritizing preferred locale, device locale and english
        if (preferredTrackId > -1) {
            activeTrack = preferredTrackId;
        } else if (deviceTrackId > -1) {
            activeTrack = deviceTrackId;
        } else if (englishTrackId > -1) {
            activeTrack = englishTrackId;
        }
        hls.audioTrack = activeTrack;
        playList[playIndex].audioTrack = activeTrack;
    }
    return activeTrack;
}

function setAudioTrack(index: number) {
    if (hls && audioTracks.length && index > -1 && index < audioTracks.length) {
        hls.audioTrack = index;
        playList[playIndex].audioTrack = index;
        Atomics.store(sharedArray, DataType.VAT, hls.audioTrack);
    }
}

function clearVideoTracking() {
    Atomics.store(sharedArray, DataType.VLP, -1);
    loadProgress = 0;
    currentFrame = 0;
    audioTracks.length = 0;
}

function loadVideo(buffer = false) {
    canPlay = false;
    const video = playList[playIndex];
    if (video && player) {
        let videoSrc = getVideoUrl(video);
        clearVideoTracking();
        bufferOnly = buffer;
        if (["mp4", "mkv"].includes(video.streamFormat)) {
            destroyHls();
            player.setAttribute("type", "video/mp4");
        } else if (video.streamFormat === "hls") {
            if (!loadHls(videoSrc)) {
                return;
            }
        } else {
            player.removeAttribute("type");
        }
        if (videoSrc.length) {
            player.src = videoSrc;
            player.load();
        }
    } else if (player) {
        Atomics.store(sharedArray, DataType.VDX, MediaErrorCode.EmptyList);
        Atomics.store(sharedArray, DataType.VDO, MediaEvent.FAILED);
        notifyAll("warning", `[video] Can't find video index: ${playIndex}`);
    } else {
        notifyAll("error", `[video] Can't find a video player!`);
    }
}

function loadHls(videoSrc: string): boolean {
    let native = false;
    if (Hls.isSupported()) {
        createHlsInstance();
        hls?.loadSource(videoSrc);
        hls?.attachMedia(player);
    } else if (player.canPlayType("application/vnd.apple.mpegurl")) {
        // Fallback to native HLS support
        player.setAttribute("type", "application/vnd.apple.mpegurl");
        native = true;
    } else {
        Atomics.store(sharedArray, DataType.VDX, MediaErrorCode.Unsupported);
        Atomics.store(sharedArray, DataType.VDO, MediaEvent.FAILED);
        notifyAll("warning", "[video] HLS is not supported");
    }
    return native;
}

function getVideoUrl(video: any): string {
    if (player.src.startsWith("blob:")) {
        revokeVideoURL(player.src);
    }
    if (video.url.startsWith("http")) {
        return video.url;
    } else if (video.url.startsWith("pkg:/")) {
        return createVideoURL(packageVideos.get(video.url.toLowerCase()));
    }
    notifyAll("warning", `[video] Invalid video url: ${video.url}`);
    return "";
}

function playVideo() {
    if (canPlay) {
        previousBuffered = 0;
        previousTime = Date.now();
        const promise = player.play();
        if (promise !== undefined) {
            promise
                .then(function () {
                    player.muted = uiMuted || videoMuted;
                })
                .catch(function (error) {
                    notifyAll(
                        "warning",
                        `[video] Browser prevented the auto-play, press pause and play to start the video.`
                    );
                });
        }
    } else {
        loadVideo();
    }
}

function nextVideo() {
    Atomics.store(sharedArray, DataType.VDX, playIndex);
    Atomics.store(sharedArray, DataType.VDO, MediaEvent.FINISHED);
    if (playNext < 0) {
        playNext = playIndex + 1;
    }
    if (playNext < playList.length) {
        playIndex = playNext;
    } else if (playLoop) {
        playIndex = 0;
        if (playList.length === 1) {
            player.currentTime = startPosition;
            resumeVideo(false);
            return;
        }
    } else {
        Atomics.store(sharedArray, DataType.VDX, playIndex);
        Atomics.store(sharedArray, DataType.VDO, MediaEvent.FULL);
        playIndex = 0;
        playNext = -1;
        canPlay = false;
        startPosition = 0;
        clearVideoTracking();
        notifyAll("stop");
        return;
    }
    playNext = -1;
    playerState = "stop";
    canPlay = false;
    Atomics.store(sharedArray, DataType.VSE, playIndex);
    loadVideo();
}

function stopVideo(error?: boolean) {
    if (player && (playerState !== "stop" || error)) {
        player.pause();
        if (hls) {
            destroyHls();
        } else {
            player.removeAttribute("src"); // empty source
            player.load();
        }
        notifyAll("stop");
        Atomics.store(sharedArray, DataType.VDX, playIndex);
        Atomics.store(sharedArray, DataType.VDO, error ? MediaEvent.FINISHED : MediaEvent.PARTIAL);
        clearVideoTracking();
        startPosition = 0;
        canPlay = false;
    }
}

function pauseVideo() {
    if (player) {
        player.pause();
        notifyAll("pause");
        Atomics.store(sharedArray, DataType.VDO, MediaEvent.PAUSED);
    }
}

function resumeVideo(notify = true) {
    if (player?.paused) {
        player.play();
        player.muted = uiMuted || videoMuted;
        if (notify) {
            Atomics.store(sharedArray, DataType.VDO, MediaEvent.RESUMED);
        }
    }
}

function seekVideo(position: number) {
    if (!player) {
        return;
    }
    if (playerState === "stop") {
        // Seek before play set the start of the video to a specific position
        // Replicate Roku behavior and start a few seconds before the seek position
        startPosition = position < 3 ? 0 : position - 2;
    } else if (playNext === -1 || playNext === playIndex) {
        if (position > videoDuration || position < 0) {
            // Replicate Roku behavior: go to a few seconds before the end of video
            position = videoDuration - 2;
        }
        player.currentTime = position;
        if (playerState === "pause") {
            resumeVideo();
        }
    } else {
        startPosition = position;
        nextVideo();
    }
}

function setVideoLoop(enable: boolean) {
    playLoop = enable;
}

function setNextVideo(index: number) {
    playNext = index;
    if (playNext >= playList.length) {
        playNext = -1;
        notifyAll("warning", `[video] Next index out of range: ${index}`);
    }
}

function createVideoURL(blob: Blob) {
    return URL.createObjectURL(blob);
}

function revokeVideoURL(url: string) {
    URL.revokeObjectURL(url);
}

function createHlsInstance() {
    hls?.detachMedia();
    hls?.destroy();
    hls = new Hls();
    hls.on(Hls.Events.ERROR, function (event, data) {
        if (data.fatal) {
            switch (data.type) {
                case Hls.ErrorTypes.MEDIA_ERROR:
                    hls?.recoverMediaError();
                    break;
                case Hls.ErrorTypes.NETWORK_ERROR:
                    // All retries and media options have been exhausted.
                    Atomics.store(sharedArray, DataType.VDX, MediaErrorCode.Http);
                    Atomics.store(sharedArray, DataType.VDO, MediaEvent.FAILED);
                    notifyAll("warning", `[video] fatal network error encountered: ${data.details}`);
                    break;
                default:
                    // cannot recover
                    Atomics.store(sharedArray, DataType.VDX, MediaErrorCode.Unknown);
                    Atomics.store(sharedArray, DataType.VDO, MediaEvent.FAILED);
                    notifyAll("warning", "[video] fatal media error encountered, cannot recover");
                    break;
            }
        }
    });

    hls.on(Hls.Events.MANIFEST_LOADED, function (event, data) {
        if (data.networkDetails) {
            notifyAll("http.connect", data.networkDetails);
        }
    });

    hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
        const bandwidth = hls?.bandwidthEstimate || NaN;
        if (!isNaN(bandwidth)) {
            notifyAll("bandwidth", Math.round(bandwidth / 1000));
        }
    });

    hls.on(Hls.Events.FRAG_CHANGED, function (event, data) {
        if (typeof data.frag.sn === "number") {
            currentFrame = data.frag.sn;
        }
    });
}

function destroyHls() {
    hls?.detachMedia();
    hls?.destroy();
    hls = undefined;
}
