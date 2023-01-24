/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Howl } from "howler";
// Sound Objects
const audioEvent = { SELECTED: 0, FULL: 1, PARTIAL: 2, PAUSED: 3, RESUMED: 4, FAILED: 5 };
Object.freeze(audioEvent);
let soundsIdx = new Map();
let soundsDat = new Array();
let playList = new Array();
let playIndex = 0;
let playLoop = false;
let playNext = -1;
let sharedArray;
let dataType;
let wavStreams;
let maxStreams;
// Initialize Sound Module
export function initSoundModule(array, types, streams) {
    sharedArray = array;
    dataType = types;
    maxStreams = streams;
    resetSounds();
}
// Sound Functions
export function playSound() {
    const audio = playList[playIndex];
    if (audio) {
        let sound;
        if (soundsIdx.has(audio.toLowerCase())) {
            sound = soundsDat[soundsIdx.get(audio.toLowerCase())];
        } else if (audio.slice(0, 4).toLowerCase() === "http") {
            sound = addWebSound(audio);
        } else {
            console.warn(`[playSound] Can't find audio data: ${audio}`);
            return;
        }
        sound.seek(0);
        sound.once("end", nextSound);
        if (sound.state() === "unloaded") {
            sound.once("load", function() {
                sound.play();
            });
            sound.load();
        } else {
            sound.play();
        }
        sharedArray[dataType.IDX] = playIndex;
        sharedArray[dataType.SND] = audioEvent.SELECTED;
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
        sharedArray[dataType.SND] = audioEvent.FULL;
    }
}

export function stopSound() {
    const audio = playList[playIndex];
    if (audio && soundsIdx.has(audio.toLowerCase())) {
        const sound = soundsDat[soundsIdx.get(audio.toLowerCase())];
        sound.stop();
        sharedArray[dataType.SND] = audioEvent.PARTIAL;
    } else {
        console.warn(`[stopSound] Can't find audio data: ${playIndex} - ${audio}`);
    }
}

export function pauseSound() {
    const audio = playList[playIndex];
    if (audio && soundsIdx.has(audio.toLowerCase())) {
        const sound = soundsDat[soundsIdx.get(audio.toLowerCase())];
        sound.pause();
        sharedArray[dataType.SND] = audioEvent.PAUSED;
    } else {
        console.warn(`[message:pause] Can't find audio data: ${playIndex} - ${audio}`);
    }
}

export function resumeSound() {
    const audio = playList[playIndex];
    if (audio && soundsIdx.has(audio.toLowerCase())) {
        const sound = soundsDat[soundsIdx.get(audio.toLowerCase())];
        sound.play();
        sharedArray[dataType.SND] = audioEvent.RESUMED;
    } else {
        console.warn(`[message:resume] Can't find audio data: ${playIndex} - ${audio}`);
    }
}

export function seekSound(position) {
    const audio = playList[playIndex];
    if (audio && soundsIdx.has(audio.toLowerCase())) {
        const sound = soundsDat[soundsIdx.get(audio.toLowerCase())];
        sound.seek(position);
    } else {
        console.warn(`[message:seek] Can't find audio data: ${playIndex} - ${audio}`);
    }
}

export function setLoop(enable) {
    playLoop = enable;
}

export function setNext(index) {
    playNext = index;
    if (playNext >= playList.length) {
        playNext = -1;
        console.warn(`Next index out of range: ${newIndex}`);
    }
}

export function triggerWav(wav, volume, index) {
    if (wav && soundsIdx.has(wav.toLowerCase())) {
        const soundId = soundsIdx.get(wav.toLowerCase());
        const sound = soundsDat[soundId];
        if (volume && !isNaN(volume)) {
            sound.volume(volume / 100);
        }
        if (index >= 0 && index < maxStreams) {
            if (wavStreams[index] && wavStreams[index].playing()) {
                wavStreams[index].stop();
            }
            wavStreams[index] = sound;
            sound.on("end", function() {
                sharedArray[dataType.WAV + index] = -1;
            });
            sound.play();
            sharedArray[dataType.WAV + index] = soundId;
        }
    }
}

export function playWav(soundId) {
    if (soundsDat[soundId]) {
        soundsDat[soundId].play();
    }
}

export function stopWav(wav) {
    if (wav && soundsIdx.has(wav.toLowerCase())) {
        const soundId = soundsIdx.get(wav.toLowerCase());
        const sound = soundsDat[soundId];
        for (let index = 0; index < maxStreams; index++) {
            if (sharedArray[dataType.WAV + index] === soundId) {
                sharedArray[dataType.WAV + index] = -1;
                break;
            }
        }
        sound.stop();
    } else {
        console.warn(`Can't find wav sound: ${wav}`);
    }
}

export function addPlaylist(playlist) {
    if (playList.length > 0) {
        stopSound();
    }
    playList = playlist;
    playIndex = 0;
    playNext = -1;
}

export function addSound(path, format, data) {
    soundsIdx.set(path.toLowerCase(), soundsDat.length);
    soundsDat.push(
        new Howl({
            src: [window.URL.createObjectURL(data)],
            format: format,
            preload: format === "wav",
            onloaderror: function(id, message) {
                console.warn(`Error loading ${path}: ${message}`);
            },
            onplayerror: function(id, message) {
                console.warn(`Error playing ${path}: ${message}`);
            },
        })
    );
}

export function resetSounds() {
    if (soundsDat.length > 0) {
        soundsDat.forEach(sound => {
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

function addWebSound(url) {
    // TODO: Fix the WAV index if a roAudioResource is created after this call
    soundsIdx.set(url.toLowerCase(), soundsDat.length);
    let sound = new Howl({
        src: [url],
        preload: true,
        onloaderror: function(id, message) {
            console.warn(`Error loading ${path}: ${message}`);
        },
        onplayerror: function(id, message) {
            console.warn(`Error playing ${path}: ${message}`);
        },
    });
    soundsDat.push(sound);
    return sound;
}
