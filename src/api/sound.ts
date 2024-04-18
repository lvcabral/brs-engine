/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SubscribeCallback } from "./util";
import { DataType, MediaEvent } from "../worker/common";
import { Howl, Howler } from "howler";

// Sound Objects
let soundsIdx: Map<string, number> = new Map();
let soundsDat: Howl[] = new Array();
let soundState: number[] = new Array();
let playList = new Array();
let playIndex = 0;
let playLoop = false;
let playNext = -1;
let sharedArray: Int32Array;
let wavStreams: Howl[];
let maxStreams: number;
let muted: boolean;

// Initialize Sound Module
export function initSoundModule(array: Int32Array, streams: number, mute: boolean = false) {
    sharedArray = array;
    maxStreams = Math.min(streams, 3) || 2;
    resetSounds();
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
    if (data[1] === "play") {
        playSound();
    } else if (data[1] === "stop") {
        if (data[2]) {
            stopWav(data[2]);
        } else {
            stopSound();
        }
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

export function addSoundPlaylist(newList: any[]) {
    if (playList.length > 0) {
        stopSound();
    }
    playList = newList;
    playIndex = 0;
    playNext = -1;
}

export function addSound(path: string, format: string, data: any) {
    soundsIdx.set(path.toLowerCase(), soundsDat.length);
    soundsDat.push(
        new Howl({
            src: [URL.createObjectURL(data)],
            format: format,
            preload: format === "wav",
            onloaderror: function (id, message) {
                notifyAll("warning", `[sound] Error loading wav ${path}: ${message}`);
            },
            onplayerror: function (id, message) {
                notifyAll("warning", `[sound] Error playing wav ${path}: ${message}`);
            },
        })
    );
}

export function resetSounds() {
    if (soundsDat.length > 0) {
        soundsDat.forEach((sound) => {
            sound.unload();
        });
    }
    soundsIdx = new Map();
    soundsDat = new Array();
    wavStreams = new Array(maxStreams);
    soundsIdx.set("select", 0);
    soundsDat.push(new Howl({ src: ["./audio/select.wav"] }));
    soundsIdx.set("navsingle", 1);
    soundsDat.push(new Howl({ src: ["./audio/navsingle.wav"] }));
    soundsIdx.set("navmulti", 2);
    soundsDat.push(new Howl({ src: ["./audio/navmulti.wav"] }));
    soundsIdx.set("deadend", 3);
    soundsDat.push(new Howl({ src: ["./audio/deadend.wav"] }));
    playList = new Array();
    playIndex = 0;
    playLoop = false;
    playNext = -1;
}

function playSound() {
    const audio = playList[playIndex];
    if (audio) {
        let sound: Howl;
        let idx = soundsIdx.get(audio.toLowerCase());
        if (idx) {
            sound = soundsDat[idx];
        } else if (audio.slice(0, 4).toLowerCase() === "http") {
            sound = addWebSound(audio);
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
        Atomics.store(sharedArray, DataType.IDX, playIndex);
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

function triggerWav(wav: string, volume: number, index: number) {
    const soundId = soundsIdx.get(wav.toLowerCase());
    if (soundId) {
        const sound = soundsDat[soundId];
        if (volume && !isNaN(volume)) {
            sound.volume(volume / 100);
        }
        if (index >= 0 && index < maxStreams) {
            if (wavStreams[index]?.playing()) {
                wavStreams[index].stop();
            }
            wavStreams[index] = sound;
            sound.on("end", function () {
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

function addWebSound(url: string) {
    // TODO: Fix the WAV index if a roAudioResource is created after this call
    soundsIdx.set(url.toLowerCase(), soundsDat.length);
    let sound = new Howl({
        src: [url],
        preload: true,
        onloaderror: function (id, message) {
            notifyAll("warning", `[sound] Error loading sound ${url}: ${message}`);
        },
        onplayerror: function (id, message) {
            notifyAll("warning", `[sound] Error playing sound ${url}: ${message}`);
        },
    });
    soundsDat.push(sound);
    return sound;
}
