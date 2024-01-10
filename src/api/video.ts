/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SubscribeCallback } from "./util";
import { DataType, MediaEvent } from "./enums";

// Video Objects
export let player: HTMLVideoElement;
let playerState: string = "stop";
let videosState = false;
let playList = new Array();
let playIndex = 0;
let playLoop = false;
let playNext = -1;
let sharedArray: Int32Array;

// Initialize Video Module
export function initVideoModule(array: Int32Array, mute: boolean = false) {
    player = document.getElementById("player") as HTMLVideoElement;
    if (player) {
        player.addEventListener("canplay", (event) => {
            player.play();
            notifyAll("play");
        });
        player.addEventListener("playing", (event) => {
            notifyAll("play");
        });
        player.addEventListener("error", (event) => {
            notifyAll("error", `Error ${player.error?.code}; details: ${player.error?.message}`);
        });
        player.addEventListener("ended", nextVideo);
        player.muted = mute;
    }
    sharedArray = array;
    resetVideo();
    muteVideo(mute);
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
    playerState = eventName;
    observers.forEach((callback, id) => {
        callback(eventName, eventData);
    });
}

// Sound Functions
export function handleVideoEvent(eventData: string) {
    console.log("video event: ", eventData);
    const data = eventData.split(",");
    if (data[1] === "play") {
        playVideo();
    } else if (data[1] === "stop") {
        stopVideo();
    } else if (data[1] === "pause") {
        pauseVideo();
    } else if (data[1] === "resume") {
        resumeVideo();
    } else if (data[1] === "loop") {
        if (data[2]) {
            setVideoLoop(data[2] === "true");
        } else {
            notifyAll("warning", `[video] Missing loop parameter`);
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

export function muteVideo(mute: boolean) {
    player.muted = mute;
}

export function isVideoMuted() {
    return player.muted;
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

export function videoCodecs() {
    const codecs = ["mp4", "hls"];
    return codecs;
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
    playList = new Array();
    playIndex = 0;
    playLoop = false;
    playNext = -1;
    playerState = "stop";
    videosState = false;
}

function playVideo() {
    const video = playList[playIndex];
    if (video && player) {
        player.src = video;
        player.load();
        Atomics.store(sharedArray, DataType.VDX, playIndex);
        Atomics.store(sharedArray, DataType.VDO, MediaEvent.SELECTED);
    } else {
        notifyAll("warning", `[video] Can't find video index: ${playIndex}`);
    }
}

function nextVideo() {
    if (playNext >= 0 && playNext < playList.length) {
        playIndex = playNext;
    } else {
        playIndex++;
    }
    playNext = -1;
    if (playIndex < playList.length) {
        playVideo();
    } else if (playLoop) {
        playIndex = 0;
        playVideo();
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
        console.log("seek to", position);
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
