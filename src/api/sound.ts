/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SubscribeCallback } from "./util";
import { DataType, DefaultSounds, MediaEvent } from "../core/common";
import { Howl, Howler } from "howler";
import { unzipSync } from "fflate";

// Sound Objects
const soundsIdx: Map<string, number> = new Map();
const soundsDat: Howl[] = new Array();
const soundState: number[] = new Array();
const playList: string[] = new Array();
const wavStreams: Howl[] = new Array();
let playIndex = 0;
let playLoop = false;
let playNext = -1;
let sharedArray: Int32Array;
let maxStreams: number = 2;
let muted: boolean;
let notifyInterval = 500; // milliseconds

let homeWav: Howl;

// Initialize Sound Module
export function initSoundModule(array: Int32Array, streams: number, mute: boolean = false) {
    sharedArray = array;
    maxStreams = Math.min(streams, 3) || 2;
    muteSound(mute);
}

// Observers Handling
const observers = new Map();
export function subscribeSound(observerId: string, observerCallback: SubscribeCallback) {
    observers.set(observerId, observerCallback);
}
export function unsubscribeSound(observerId: string) {
    observers.delete(observerId);
}
function notifyAll(eventName: string, eventData?: any) {
    observers.forEach((callback, id) => {
        callback(eventName, eventData);
    });
}

// Sound Functions
export function handleSoundEvent(eventData: string) {
    const data = eventData.split(",");
    if (data[1] === "play" || data[1] === "start") {
        playSound();
    } else if (data[1] === "stop") {
        if (data[2]) {
            stopWav(data[2]);
        } else {
            stopSound();
        }
    } else if (data[1] === "notify" && data.length === 3) {
        notifyInterval = parseInt(data[2]);
    } else if (data[1] === "pause") {
        pauseSound();
    } else if (data[1] === "resume") {
        resumeSound();
    } else if (data[1] === "loop") {
        if (data[2]) {
            setLoop(data[2] === "true");
        } else {
            notifyAll("warning", `[sound] Missing loop parameter`);
        }
    } else if (data[1] === "next") {
        const newIndex = data[2];
        if (newIndex && !isNaN(parseInt(newIndex))) {
            setNext(parseInt(newIndex));
        } else {
            notifyAll("warning", `[sound] Invalid next index: ${eventData}`);
        }
    } else if (data[1] === "seek") {
        const position = data[2];
        if (position && !isNaN(parseInt(position))) {
            seekSound(parseInt(position));
        } else {
            notifyAll("warning", `[sound] Invalid seek position: ${eventData}`);
        }
    } else if (data[1] === "trigger") {
        if (data.length >= 5) {
            triggerWav(data[2], parseInt(data[3]), parseInt(data[4]));
        } else {
            notifyAll("warning", `[sound] Missing Trigger parameters: ${eventData}`);
        }
    }
}

export function muteSound(mute: boolean = false) {
    muted = mute;
    Howler.mute(mute);
}

export function isSoundMuted() {
    return muted;
}

export function soundPlaying() {
    return soundsDat.some((sound) => {
        return sound.playing();
    });
}

export function switchSoundState(play: boolean) {
    if (play) {
        soundState.forEach((id) => {
            soundsDat[id]?.play();
        });
    } else {
        soundState.length = 0;
        soundsDat.forEach((sound, index) => {
            if (sound.playing()) {
                sound.pause();
                soundState.push(index);
            }
        });
    }
}

export function audioCodecs() {
    const codecs = [
        "mp3",
        "mpeg",
        "opus",
        "ogg",
        "oga",
        "wav",
        "aac",
        "caf",
        "m4a",
        "m4b",
        "weba",
        "webm",
        "dolby",
        "flac",
    ];
    return codecs.filter((codec) => {
        return Howler.codecs(codec);
    });
}

export function addSoundPlaylist(newList: string[]) {
    if (playList.length > 0) {
        stopSound();
    }
    playList.length = 0;
    playList.push(...newList);
    playIndex = 0;
    playNext = -1;
}

let animationFrameId: number;
let lastUpdate: number = 0;

export function addSound(path: string, format: string, data: any) {
    registerSound(path, format === "wav", format, URL.createObjectURL(data));
}

function registerSound(path: string, preload: boolean, format?: string, url?: string) {
    soundsIdx.set(path.toLowerCase(), soundsDat.length);
    let sound = new Howl({
        src: [url ?? path],
        format: format,
        preload: preload,
        onloaderror: function (id, message) {
            Atomics.store(sharedArray, DataType.SND, MediaEvent.FAILED);
            notifyAll("warning", `[sound] Error loading sound ${id} ${path}: ${message}`);
        },
        onplayerror: function (id, message) {
            Atomics.store(sharedArray, DataType.SND, MediaEvent.FAILED);
            notifyAll("warning", `[sound] Error playing sound ${id} ${path}: ${message}`);
        },
    });
    sound.on("play", function () {
        const updateProgress = () => {
            if (!sound.playing()) {
                return;
            }
            if (Date.now() - lastUpdate > notifyInterval) {
                if (!isNaN(sound.duration()) && sound.duration() !== Infinity) {
                    Atomics.store(sharedArray, DataType.SDR, Math.trunc(sound.duration() * 1000));
                }
                Atomics.store(sharedArray, DataType.SPS, Math.trunc(sound.seek() * 1000));
                lastUpdate = Date.now();
            }
            animationFrameId = requestAnimationFrame(updateProgress);
        };

        updateProgress();
    });

    sound.on("pause", function () {
        cancelAnimationFrame(animationFrameId);
    });
    soundsDat.push(sound);
    return sound;
}


export function resetSounds(assets: ArrayBufferLike) {
    if (soundsDat.length > 0) {
        soundsDat.forEach((sound) => {
            sound.unload();
        });
    }
    wavStreams.length = maxStreams;
    soundsIdx.clear();
    soundsDat.length = 0;
    try {
        const commonFs = unzipSync(new Uint8Array(assets));
        DefaultSounds.forEach((sound, index) => {
            soundsIdx.set(sound.toLowerCase(), index);
            const audioData = new Blob([commonFs[`audio/${sound}.wav`]]);
            soundsDat.push(new Howl({ src: [URL.createObjectURL(audioData)], format: "wav" }));
        });
        if (homeWav === undefined) {
            const audioData = new Blob([commonFs["audio/select.wav"]]);
            homeWav = new Howl({ src: [URL.createObjectURL(audioData)], format: "wav" });
            homeWav.on("play", function () {
                notifyAll("home");
            });
        }
    } catch (e: any) {
        notifyAll("error", `[sound] Error unzipping audio files: ${e.message}`);
    }
    playList.length = 0;
    playIndex = 0;
    playLoop = false;
    playNext = -1;
}

export function playHomeSound() {
    if (homeWav) {
        homeWav.play();
    }
}

function playSound() {
    const audio = playList[playIndex];
    if (audio) {
        let sound: Howl;
        let idx = soundsIdx.get(audio.toLowerCase());
        if (idx) {
            sound = soundsDat[idx];
        } else if (audio.startsWith("http")) {
            sound = registerSound(audio, true);
        } else {
            notifyAll("warning", `[sound] Can't find audio to play: ${audio}`);
            return;
        }
        sound.seek(0);
        sound.once("end", nextSound);
        if (sound.state() === "unloaded") {
            sound.once("load", function () {
                sound.play();
            });
            sound.load();
        } else {
            sound.play();
        }
        Atomics.store(sharedArray, DataType.SDX, playIndex);
        Atomics.store(sharedArray, DataType.SND, MediaEvent.SELECTED);
    } else {
        notifyAll("warning", `[sound] Can't find audio index: ${playIndex}`);
    }
}

function nextSound() {
    if (playNext >= 0 && playNext < playList.length) {
        playIndex = playNext;
    } else {
        playIndex++;
    }
    playNext = -1;
    if (playIndex < playList.length) {
        playSound();
    } else if (playLoop) {
        playIndex = 0;
        playSound();
    } else {
        playIndex = 0;
        Atomics.store(sharedArray, DataType.SND, MediaEvent.FULL);
    }
}

function stopSound() {
    const audio = playList[playIndex];
    if (audio && soundsIdx.has(audio.toLowerCase())) {
        let idx = soundsIdx.get(audio.toLowerCase());
        if (idx) {
            if (soundsDat[idx].state() !== "loading") {
                soundsDat[idx].stop();
            } else {
                soundsDat[idx].unload();
            }
        }
        Atomics.store(sharedArray, DataType.SND, MediaEvent.PARTIAL);
    } else if (audio) {
        notifyAll("warning", `[sound] Can't find audio to stop: ${playIndex} - ${audio}`);
    }
}

function pauseSound(notify = true) {
    const audio = playList[playIndex];
    if (audio && soundsIdx.has(audio.toLowerCase())) {
        let idx = soundsIdx.get(audio.toLowerCase());
        if (idx) {
            soundsDat[idx].pause();
        }
        if (notify) {
            Atomics.store(sharedArray, DataType.SND, MediaEvent.PAUSED);
        }
    } else if (audio) {
        notifyAll("warning", `[sound] Can't find audio to pause: ${playIndex} - ${audio}`);
    }
}

function resumeSound(notify = true) {
    const audio = playList[playIndex];
    if (audio && soundsIdx.has(audio.toLowerCase())) {
        let idx = soundsIdx.get(audio.toLowerCase());
        if (idx) {
            soundsDat[idx].play();
        }
        if (notify) {
            Atomics.store(sharedArray, DataType.SND, MediaEvent.RESUMED);
        }
    } else if (audio) {
        notifyAll("warning", `[sound] Can't find audio to resume: ${playIndex} - ${audio}`);
    }
}

function seekSound(position: number) {
    const audio = playList[playIndex];
    if (audio && soundsIdx.has(audio.toLowerCase())) {
        let idx = soundsIdx.get(audio.toLowerCase());
        if (idx) {
            soundsDat[idx].seek(position);
        }
    } else if (audio) {
        notifyAll("warning", `[sound] Can't find audio to seek: ${playIndex} - ${audio}`);
    }
}

function setLoop(enable: boolean) {
    playLoop = enable;
}

function setNext(index: number) {
    playNext = index;
    if (playNext >= playList.length) {
        playNext = -1;
        notifyAll("warning", `[sound] Next index out of range: ${index}`);
    }
}

// WAV Sound Functions
function triggerWav(wav: string, volume: number, index: number) {
    const soundId = soundsIdx.get(wav.toLowerCase());
    if (soundId !== undefined) {
        const sound = soundsDat[soundId];
        if (volume && !isNaN(volume)) {
            sound.volume(volume / 100);
        }
        if (index >= 0 && index < maxStreams) {
            if (wavStreams[index]?.playing()) {
                wavStreams[index].stop();
            }
            wavStreams[index] = sound;
            sound.once("end", function () {
                Atomics.store(sharedArray, DataType.WAV + index, -1);
            });
            sound.play();
            Atomics.store(sharedArray, DataType.WAV + index, soundId);
        }
    }
}

function stopWav(wav: string) {
    const soundId = soundsIdx.get(wav.toLowerCase());
    if (soundId) {
        const sound = soundsDat[soundId];
        for (let index = 0; index < maxStreams; index++) {
            const wavId = Atomics.load(sharedArray, DataType.WAV + index);
            if (wavId === soundId) {
                Atomics.store(sharedArray, DataType.WAV + index, -1);
                break;
            }
        }
        sound.stop();
    } else {
        notifyAll("warning", `[sound] Can't find wav sound: ${wav}`);
    }
}

