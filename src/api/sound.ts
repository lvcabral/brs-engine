/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { dataType, audioEvent } from "./util";
import { Howl, Howler } from "howler";

// Sound Objects
let soundsIdx: Map<string, number> = new Map();
let soundsDat: Howl[] = new Array();
let playList = new Array();
let playIndex = 0;
let playLoop = false;
let playNext = -1;
let sharedArray: Int32Array;
let wavStreams: Howl[];
let maxStreams: number;

// Initialize Sound Module
export function initSoundModule(array: Int32Array, streams: number, mute: boolean = false) {
    sharedArray = array;
    maxStreams = streams;
    resetSounds();
    Howler.mute(mute);
}

// Sound Functions
export function playSound() {
    const audio = playList[playIndex];
    if (audio) {
        let sound: Howl;
        let idx = soundsIdx.get(audio.toLowerCase());
        if (idx) {
            sound = soundsDat[idx];
        } else if (audio.slice(0, 4).toLowerCase() === "http") {
            sound = addWebSound(audio);
        } else {
            console.warn(`[playSound] Can't find audio data: ${audio}`);
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
        Atomics.store(sharedArray, dataType.IDX, playIndex);
        Atomics.store(sharedArray, dataType.SND, audioEvent.SELECTED);
    } else {
        console.warn(`Can't find audio index: ${playIndex}`);
    }
}

export function nextSound() {
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
        Atomics.store(sharedArray, dataType.SND, audioEvent.FULL);
    }
}

export function stopSound() {
    const audio = playList[playIndex];
    if (audio && soundsIdx.has(audio.toLowerCase())) {
        let idx = soundsIdx.get(audio.toLowerCase());
        if (idx) {
            soundsDat[idx].stop();
        }
        Atomics.store(sharedArray, dataType.SND, audioEvent.PARTIAL);
    } else if (audio) {
        console.warn(`[stopSound] Can't find audio data: ${playIndex} - ${audio}`);
    }
}

export function pauseSound() {
    const audio = playList[playIndex];
    if (audio && soundsIdx.has(audio.toLowerCase())) {
        let idx = soundsIdx.get(audio.toLowerCase());
        if (idx) {
            soundsDat[idx].pause();
        }
        Atomics.store(sharedArray, dataType.SND, audioEvent.PAUSED);
    } else if (audio) {
        console.warn(`[message:pause] Can't find audio data: ${playIndex} - ${audio}`);
    }
}

export function resumeSound() {
    const audio = playList[playIndex];
    if (audio && soundsIdx.has(audio.toLowerCase())) {
        let idx = soundsIdx.get(audio.toLowerCase());
        if (idx) {
            soundsDat[idx].play();
        }
        Atomics.store(sharedArray, dataType.SND, audioEvent.RESUMED);
    } else if (audio) {
        console.warn(`[message:resume] Can't find audio data: ${playIndex} - ${audio}`);
    }
}

export function seekSound(position: number) {
    const audio = playList[playIndex];
    if (audio && soundsIdx.has(audio.toLowerCase())) {
        let idx = soundsIdx.get(audio.toLowerCase());
        if (idx) {
            soundsDat[idx].seek(position);
        }
    } else if (audio) {
        console.warn(`[message:seek] Can't find audio data: ${playIndex} - ${audio}`);
    }
}

export function setLoop(enable: boolean) {
    playLoop = enable;
}

export function setNext(index: number) {
    playNext = index;
    if (playNext >= playList.length) {
        playNext = -1;
        console.warn(`Next index out of range: ${index}`);
    }
}

export function triggerWav(wav: string, volume: number, index: number) {
    const soundId = soundsIdx.get(wav.toLowerCase());
    if (soundId) {
        const sound = soundsDat[soundId];
        if (volume && !isNaN(volume)) {
            sound.volume(volume / 100);
        }
        if (index >= 0 && index < maxStreams) {
            if (wavStreams[index] && wavStreams[index].playing()) {
                wavStreams[index].stop();
            }
            wavStreams[index] = sound;
            sound.on("end", function () {
                Atomics.store(sharedArray, dataType.WAV + index, -1);
            });
            sound.play();
            Atomics.store(sharedArray, dataType.WAV + index, soundId);
        }
    }
}

export function playWav(soundId: number) {
    if (soundsDat[soundId]) {
        soundsDat[soundId].play();
    }
}

export function stopWav(wav: string) {
    const soundId = soundsIdx.get(wav.toLowerCase());
    if (soundId) {
        const sound = soundsDat[soundId];
        for (let index = 0; index < maxStreams; index++) {
            const wavId = Atomics.load(sharedArray, dataType.WAV + index);
            if (wavId === soundId) {
                Atomics.store(sharedArray, dataType.WAV + index, -1);
                break;
            }
        }
        sound.stop();
    } else {
        console.warn(`Can't find wav sound: ${wav}`);
    }
}

export function addPlaylist(newList: any[]) {
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
            src: [window.URL.createObjectURL(data)],
            format: format,
            preload: format === "wav",
            onloaderror: function (id, message) {
                console.warn(`Error loading ${path}: ${message}`);
            },
            onplayerror: function (id, message) {
                console.warn(`Error playing ${path}: ${message}`);
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

function addWebSound(url: string) {
    // TODO: Fix the WAV index if a roAudioResource is created after this call
    soundsIdx.set(url.toLowerCase(), soundsDat.length);
    let sound = new Howl({
        src: [url],
        preload: true,
        onloaderror: function (id, message) {
            console.warn(`Error loading ${url}: ${message}`);
        },
        onplayerror: function (id, message) {
            console.warn(`Error playing ${url}: ${message}`);
        },
    });
    soundsDat.push(sound);
    return sound;
}