/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SubscribeCallback, context, saveDataBuffer } from "./util";
import { BufferType, DataType, MediaEvent } from "../worker/enums";
import Hls from "hls.js";

// Video Objects
export let player: HTMLVideoElement;
let hls: Hls;
let packageVideos = new Map();
let audioTracks = new Array();
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

// Initialize Video Module
if (typeof document !== "undefined") {
    player = document.getElementById("player") as HTMLVideoElement;
}
export function initVideoModule(array: Int32Array, mute: boolean = false) {
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
            notifyAll("error", `Error ${player.error?.code}; details: ${player.error?.message}`);
        });
        player.addEventListener("ended", nextVideo);
        player.addEventListener("loadstart", startProgress);
        player.addEventListener("durationchange", setDuration);
        player.addEventListener("loadedmetadata", startProgress);
        player.addEventListener("loadeddata", startProgress);
        player.muted = true;
        player.defaultMuted = true;
        uiMuted = mute;
    }
    sharedArray = array;
    resetVideo();
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
        const index = parseInt(data[2]);
        if (index > 0) {
            setAudioTrack(index - 1);
        }
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
    if (context.inBrowser) {
        // Mime and Codecs browser test page
        // https://cconcolato.github.io/media-mime-support/
        const formats = new Map([
            ["av1", `video/mp4; codecs="av01.0.05M.08"`],
            ["mpeg4 avc", `video/mp4; codecs="avc1.42E01E"`],
            ["hevc", `video/mp4; codecs="hev1.2.4.L120.B0"`],
            ["vp8", `video/webm; codecs="vp8, vorbis"`],
            ["vp9", `video/mp4; codecs="vp09.00.50.08"`],
            ["mpeg1", "vdeo/mpeg"],
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
        if (context.inChromium) {
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
    hls?.destroy();
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
        loadAudioTracks();
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
    audioTracks = new Array();
    if (hls) {
        hls.audioTracks.forEach((track, index) => {
            audioTracks.push([index + 1, track.lang, track.name]);
        });
        if (playList[playIndex]?.audioTrack === -1) {
            playList[playIndex].audioTrack = hls.audioTrack;
        }
    }
    saveDataBuffer(sharedArray, JSON.stringify(audioTracks));
    Atomics.store(sharedArray, DataType.BUF, BufferType.AUDIO_TRACKS);
}

function setAudioTrack(index: number) {
    if (index > -1 && index < audioTracks.length) {
        if (hls && hls.audioTrack !== index) {
            hls.audioTrack = index;
            playList[playIndex].audioTrack = index;
        }
    }
}

function clearVideoTracking() {
    loadProgress = 0;
    currentFrame = 0;
    audioTracks = new Array();
}

function loadVideo(buffer = false) {
    canPlay = false;
    const video = playList[playIndex];
    if (video && player) {
        let videoSrc = getVideoUrl(video);
        clearVideoTracking();
        bufferOnly = buffer;
        if (["mp4", "mkv"].includes(video.streamFormat)) {
            hls?.destroy();
            player.setAttribute("type", "video/mp4");
        } else if (video.streamFormat === "hls") {
            if (Hls.isSupported()) {
                createHlsInstance();
                hls.loadSource(videoSrc);
                hls.attachMedia(player);
                return;
            } else if (player.canPlayType("application/vnd.apple.mpegurl")) {
                // Fallback to native HLS support
                player.setAttribute("type", "application/vnd.apple.mpegurl");
            } else {
                notifyAll("warning", "[video] HLS is not supported");
                return;
            }
        } else {
            player.removeAttribute("type");
        }
        if (videoSrc.length) {
            player.src = videoSrc;
            player.load();
        }
    } else {
        notifyAll("warning", `[video] Can't find video index: ${playIndex}`);
    }
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
    if (playNext < 0) {
        playNext = playIndex + 1;
    }
    if (playNext < playList.length) {
        playIndex = playNext;
    } else if (playLoop) {
        if (playList.length === 1) {
            seekVideo(0);
            resumeVideo(false);
            return;
        }
        playIndex = 0;
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

function stopVideo() {
    if (player && playerState !== "stop") {
        player.pause();
        player.removeAttribute("src"); // empty source
        player.load();
        notifyAll("stop");
        Atomics.store(sharedArray, DataType.VDX, playIndex);
        Atomics.store(sharedArray, DataType.VDO, MediaEvent.PARTIAL);
        clearVideoTracking();
        startPosition = 0;
        canPlay = false;
    }
}

function pauseVideo() {
    const video = playList[playIndex];
    if (video && player) {
        player.pause();
        notifyAll("pause");
        Atomics.store(sharedArray, DataType.VDO, MediaEvent.PAUSED);
    } else if (video) {
        notifyAll("warning", `[video] Can't find video to pause: ${playIndex} - ${video}`);
    }
}

function resumeVideo(notify = true) {
    const video = playList[playIndex];
    if (video && player?.paused) {
        player.play();
        player.muted = uiMuted || videoMuted;
        if (notify) {
            Atomics.store(sharedArray, DataType.VDO, MediaEvent.RESUMED);
        }
    } else if (video) {
        notifyAll("warning", `[video] Can't find video to resume: ${playIndex} - ${video}`);
    }
}

function seekVideo(position: number) {
    const video = playList[playIndex];
    if (video && player) {
        if (playerState === "stop") {
            // Replicate Roku behavior and start a few seconds before the seek position
            startPosition = position < 3 ? 0 : position - 2;
        } else if (playNext === -1 || playNext === playIndex) {
            if (position > videoDuration || position < 0) {
                // Replicate Roku behavior: go to a few seconds before the end of video
                position = videoDuration - 2;
            }
            player.currentTime = position;
        } else {
            startPosition = position;
            nextVideo();
        }
    } else if (video) {
        notifyAll("warning", `[video] Can't find audio to seek: ${playIndex} - ${video}`);
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
    hls?.destroy();
    hls = new Hls();
    hls.on(Hls.Events.ERROR, function (event, data) {
        if (data.fatal) {
            switch (data.type) {
                case Hls.ErrorTypes.MEDIA_ERROR:
                    notifyAll(
                        "warning",
                        "[video] fatal media error encountered, will try to recover"
                    );
                    hls.recoverMediaError();
                    break;
                case Hls.ErrorTypes.NETWORK_ERROR:
                    // All retries and media options have been exhausted.
                    notifyAll("error", `[video] fatal network error encountered ${data.details}`);
                    break;
                default:
                    // cannot recover
                    hls.destroy();
                    break;
            }
        }
    });
    hls.on(Hls.Events.FRAG_CHANGED, function (event, data) {
        if (typeof data.frag.sn === "number") {
            currentFrame = data.frag.sn;
        }
    });
}
