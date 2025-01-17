/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SubscribeCallback } from "./util";
import { DefaultSounds, MediaEvent, MediaEventType } from "../core/common";
import { Howl, Howler } from "howler";

// Sound Objects
const soundsIdx: Map<string, number> = new Map();
const soundsDat: Howl[] = new Array();
const soundState = new Array<number>();
const playList = new Array<string>();
const wavStreams: Howl[] = new Array();
const wavSlots = new Array<number>();
let playIndex = 0;
let playLoop = false;
let playNext = -1;
let maxStreams: number;
let muted: boolean;

// Initialize Sound Module
export function initSoundModule(streams: number, mute: boolean = false) {
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

export function addSoundPlaylist(newList: string[]) {
    if (playList.length > 0) {
        stopSound();
    }
    playList.length = 0;
    playList.push(...newList);
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
    wavStreams.length = maxStreams;
    wavSlots.length = maxStreams;
    soundsIdx.clear();
    soundsDat.length = 0;
    DefaultSounds.forEach((sound, index) => {
        soundsIdx.set(sound.toLowerCase(), index);
        soundsDat.push(new Howl({ src: [`./audio/${sound}.wav`] }));
    });
    playList.length = 0;
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
        } else if (audio.startsWith("http")) {
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
        const event: MediaEvent = {
            media: "audio",
            type: MediaEventType.SELECTED,
            index: playIndex,
        };
        notifyAll("post", event);
    } else {
        notifyAll("warning", `[sound] Can't find audio index: ${playIndex}`);
    }
}

function nextSound() {
    const currentIndex = playIndex;
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
        const event: MediaEvent = {
            media: "audio",
            type: MediaEventType.FULL,
            index: currentIndex,
        };
        notifyAll("post", event);
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
        const event: MediaEvent = {
            media: "audio",
            type: MediaEventType.PARTIAL,
            index: playIndex,
        };
        notifyAll("post", event);
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
            const event: MediaEvent = {
                media: "audio",
                type: MediaEventType.PAUSED,
                index: playIndex,
            };
            notifyAll("post", event);
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
            const event: MediaEvent = {
                media: "audio",
                type: MediaEventType.RESUMED,
                index: playIndex,
            };
            notifyAll("post", event);
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
    wav = wav.toLowerCase();
    const soundId = soundsIdx.get(wav);
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
                wavSlots[index] = -1;
                const event: MediaEvent = {
                    media: "wav",
                    type: MediaEventType.STOP_PLAY,
                    index: soundId,
                    name: wav,
                };
                notifyAll("post", event);
            });
            sound.play();
            wavSlots[index] = soundId;
            const event: MediaEvent = {
                media: "wav",
                type: MediaEventType.START_PLAY,
                index: soundId,
                name: wav,
            };
            notifyAll("post", event);
        }
    }
}

function stopWav(wav: string) {
    wav = wav.toLowerCase();
    const soundId = soundsIdx.get(wav);
    if (soundId) {
        const sound = soundsDat[soundId];
        for (let index = 0; index < maxStreams; index++) {
            const wavId = wavSlots[index];
            if (wavId === soundId) {
                const event: MediaEvent = {
                    media: "wav",
                    type: MediaEventType.STOP_PLAY,
                    index: soundId,
                    name: wav,
                };
                notifyAll("post", event);
                break;
            }
        }
        sound.stop();
    } else {
        notifyAll("warning", `[sound] Can't find wav sound: ${wav}`);
    }
}

function addWebSound(url: string) {
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
