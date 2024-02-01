/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SubscribeCallback, context } from "./util";
import { DataType, MediaEvent } from "../worker/enums";

// Video Objects
export let player: HTMLVideoElement;
let packageVideos = new Map();
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
let videoMuted = false;

// Initialize Video Module
if (typeof document !== "undefined") {
    player = document.getElementById("player") as HTMLVideoElement;
}
export function initVideoModule(array: Int32Array, mute: boolean = false) {
    if (player) {
        player.addEventListener("canplay", (event) => {
            loadProgress = 1000;
            Atomics.store(sharedArray, DataType.VLP, loadProgress);
            canPlay = true;
            if (playerState !== "play" && !bufferOnly) {
                playVideo();
            }
        });
        player.addEventListener("playing", (event) => {
            notifyAll("play");
        });
        player.addEventListener("timeupdate", () => {
            if (notifyTime) {
                Atomics.store(sharedArray, DataType.VPS, Math.round(player.currentTime));
            }
        });
        player.addEventListener("error", (event) => {
            canPlay = false;
            notifyAll("error", `Error ${player.error?.code}; details: ${player.error?.message}`);
        });
        player.addEventListener("ended", nextVideo);
        player.addEventListener("loadstart", startProgress);
        player.addEventListener("durationchange", setDuration);
        player.addEventListener("loadedmetadata", startProgress);
        player.addEventListener("loadeddata", startProgress);
        player.defaultMuted = mute;
    }
    sharedArray = array;
    resetVideo();
}

function startProgress() {
    loadProgress += 200;
    Atomics.store(sharedArray, DataType.VLP, loadProgress);
}

function setDuration() {
    if (!isNaN(player.duration)) {
        videoDuration = Math.round(player.duration);
        Atomics.store(sharedArray, DataType.VDR, videoDuration);
    }
    if (playerState !== "play") {
        startProgress();
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

// Sound Functions
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
            player.muted = player.defaultMuted || videoMuted;
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
    }
}

export function muteVideo(mute: boolean = false) {
    if (player) {
        player.defaultMuted = mute;
        player.muted = mute || videoMuted;
    }
}

export function isVideoMuted() {
    return player?.defaultMuted ?? false;
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
        // All Browsers Support mp4 and mov, only Chromium supports mkv natively
        // https://stackoverflow.com/questions/57060193/browser-support-for-mov-video
        containers.push.apply(containers, ["mp4", "m4v", "mov"]);
        if (player.canPlayType(`application/x-mpegURL; codecs="avc1"`) !== "") {
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
    playerState = "stop";
    videosState = false;
    loadProgress = 0;
}

function loadVideo(buffer = false) {
    canPlay = false;
    const video = playList[playIndex];
    if (video && player) {
        if (player.src.startsWith("blob:")) {
            revokeVideoURL(player.src);
        }
        if (video.url.startsWith("http")) {
            player.src = video.url;
        } else if (video.url.startsWith("pkg:/")) {
            player.src = createVideoURL(packageVideos.get(video.url.toLowerCase()));
        } else {
            notifyAll("warning", `[video] Invalid video url: ${video.url}`);
            return;
        }
        if (["mp4", "mkv"].includes(video.streamFormat)) {
            player.setAttribute("type", "video/mp4");
        } else if (video.streamFormat === "hls") {
            player.setAttribute("type", "application/x-mpegURL");
        } else {
            player.removeAttribute("type");
        }
        loadProgress = 0;
        bufferOnly = buffer;
        player.load();
    } else {
        notifyAll("warning", `[video] Can't find video index: ${playIndex}`);
    }
}

function playVideo() {
    if (canPlay) {
        player.play();
        Atomics.store(sharedArray, DataType.VDX, playIndex);
        Atomics.store(sharedArray, DataType.VDO, MediaEvent.SELECTED);
    } else {
        loadVideo();
    }
}

function nextVideo() {
    if (playNext >= 0 && playNext < playList.length) {
        playIndex = playNext;
    } else {
        playIndex++;
    }
    playNext = -1;
    canPlay = false;
    playerState = "stop";
    if (playIndex < playList.length) {
        loadVideo();
    } else if (playLoop) {
        playIndex = 0;
        loadVideo();
    } else {
        playIndex = 0;
        notifyAll("stop");
        Atomics.store(sharedArray, DataType.VDO, MediaEvent.FULL);
    }
}

function stopVideo() {
    if (player) {
        player.pause();
        player.removeAttribute("src"); // empty source
        player.load();
        notifyAll("stop");
        Atomics.store(sharedArray, DataType.VDO, MediaEvent.PARTIAL);
        loadProgress = 0;
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
        if (position > videoDuration) {
            position = videoDuration;
        } else if (position < 0) {
            position = 0;
        }
        player.currentTime = position;
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

// Convert Blob to URL to play as video
function createVideoURL(blob: Blob) {
    return URL.createObjectURL(blob);
}

function revokeVideoURL(url: string) {
    URL.revokeObjectURL(url);
}
