/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SubscribeCallback } from "./util";
import { DataType, DefaultSounds, MaxSoundStreams, MediaEvent } from "../core/common";
import { Howl, Howler } from "howler";
import { unzipSync } from "fflate";

// Sound Effects Type
type SFX = {
    id: number;
    sound: Howl;
};

// Sound Objects
const soundsIdx: Map<string, number> = new Map();
const soundsDat: Howl[] = new Array();
const soundState: number[] = new Array();
const playList: string[] = new Array();
const sfxMap: Map<string, SFX> = new Map();
const sfxStreams: Howl[] = new Array();
let playIndex = 0;
let playLoop = false;
let playNext = -1;
let sharedArray: Int32Array;
let muted: boolean;
let homeSfx: Howl;

// Initialize Sound Module
export function initSoundModule(array: Int32Array, mute: boolean = false) {
    sharedArray = array;
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

// Audio/SFX Functions
export function handleAudioEvent(eventData: string) {
    const data = eventData.split(",");
    if (data[1] === "play" || data[1] === "start") {
        playAudio();
    } else if (data[1] === "stop") {
        stopAudio();
    } else if (data[1] === "pause") {
        pauseAudio();
    } else if (data[1] === "resume") {
        resumeAudio();
    } else if (data[1] === "loop" && data.length >= 3) {
        setLoop(data[2] === "true");
    } else if (data[1] === "next" && data.length >= 3) {
        const newIndex = parseInt(data[2]);
        if (isNaN(newIndex)) {
            notifyAll("warning", `[sound] Invalid next index: ${eventData}`);
            return;
        }
        setNext(newIndex);
    } else if (data[1] === "seek" && data.length >= 3) {
        const position = parseInt(data[2]);
        if (isNaN(position)) {
            notifyAll("warning", `[sound] Invalid seek position: ${eventData}`);
            return;
        }
        seekAudio(position);
    } else {
        notifyAll("warning", `[sound] Unknown or invalid audio event: ${eventData}`);
    }
}

export function handleSfxEvent(eventData: string) {
    const data = eventData.split(",");
    if (data[1] === "new" && data.length >= 4) {
        const wav = data[2];
        const id = parseInt(data[3]);
        if (sfxMap.has(wav.toLowerCase())) {
            // Sound Effect already registered
            return;
        } else if (isNaN(id) || id < 0) {
            notifyAll("warning", `[sound] Invalid SFX index: ${id} for ${wav}`);
            return;
        }
        const idx = soundsIdx.get(wav.toLowerCase());
        if (idx !== undefined && idx >= 0 && idx < soundsDat.length) {
            const sound = soundsDat[idx];
            sfxMap.set(wav.toLowerCase(), { id: id, sound: sound });
            return;
        }
        const sound = new Howl({
            src: [wav],
            format: "wav",
            onloaderror: function (id, message) {
                notifyAll("warning", `[sound] Error loading SFX ${wav}: ${message}`);
            },
            onplayerror: function (id, message) {
                notifyAll("warning", `[sound] Error playing SFX ${wav}: ${message}`);
            },
        });
        sfxMap.set(wav.toLowerCase(), { id: id, sound: sound });
    } else if (data[1] === "trigger" && data.length >= 5) {
        triggerSfx(data[2], parseInt(data[3]), parseInt(data[4]));
    } else if (data[1] === "stop" && data.length >= 3) {
        stopSfx(data[2]);
    } else {
        notifyAll("warning", `[sound] Unknown or invalid SFX event: ${eventData}`);
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

export function addAudioPlaylist(newList: string[]) {
    if (playList.length > 0) {
        stopAudio();
    }
    playList.length = 0;
    playList.push(...newList);
    playIndex = 0;
    playNext = -1;
}

export function addSound(path: string, format: string, data: any) {
    registerSound(path, format === "wav", format, URL.createObjectURL(data));
}

function registerSound(path: string, preload: boolean, format?: string, url?: string) {
    soundsIdx.set(path.toLowerCase(), soundsDat.length);
    const sound = new Howl({
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
    soundsDat.push(sound);
    return sound;
}

export function resetSounds(assets: ArrayBufferLike) {
    if (soundsDat.length > 0) {
        soundsDat.forEach((sound) => {
            sound.unload();
        });
    }
    sfxStreams.length = 0;
    soundsIdx.clear();
    soundsDat.length = 0;
    playList.length = 0;
    playIndex = 0;
    playLoop = false;
    playNext = -1;
    if (sfxMap.size > 0) {
        sfxMap.forEach((sound) => {
            sound.sound?.unload();
        });
        sfxMap.clear();
    }
    try {
        const commonFs = unzipSync(new Uint8Array(assets));
        DefaultSounds.forEach((sound, index) => {
            const audioData = new Blob([commonFs[`audio/${sound}.wav`] as BlobPart]);
            const sfx: SFX = {
                id: index,
                sound: new Howl({ src: [URL.createObjectURL(audioData)], format: "wav", preload: true }),
            };
            sfxMap.set(sound, sfx);
        });
        if (homeSfx === undefined) {
            const audioData = new Blob([commonFs["audio/select.wav"] as BlobPart]);
            homeSfx = new Howl({ src: [URL.createObjectURL(audioData)], format: "wav", preload: true });
            homeSfx.on("play", function () {
                notifyAll("home");
            });
        }
    } catch (e: any) {
        notifyAll("error", `[sound] Error unzipping audio files: ${e.message}`);
    }
}

export function playHomeSound() {
    if (homeSfx) {
        homeSfx.play();
    }
}

function playAudio() {
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
        sound.once("end", nextAudio);
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

function nextAudio() {
    Atomics.store(sharedArray, DataType.SDX, playIndex);
    Atomics.store(sharedArray, DataType.SND, MediaEvent.FINISHED);
    if (playNext >= 0 && playNext < playList.length) {
        playIndex = playNext;
    } else {
        playIndex++;
    }
    playNext = -1;
    if (playIndex < playList.length) {
        playAudio();
    } else if (playLoop) {
        playIndex = 0;
        playAudio();
    } else {
        playIndex = 0;
        Atomics.store(sharedArray, DataType.SND, MediaEvent.FULL);
    }
}

function stopAudio() {
    const audio = playList[playIndex];
    if (audio && soundsIdx.has(audio.toLowerCase())) {
        const idx = soundsIdx.get(audio.toLowerCase());
        if (soundsDat[idx!]?.state() !== "loading") {
            soundsDat[idx!]?.stop();
        } else {
            soundsDat[idx!]?.unload();
        }
        Atomics.store(sharedArray, DataType.SND, MediaEvent.PARTIAL);
    } else if (audio) {
        notifyAll("warning", `[sound] Can't find audio to stop: ${playIndex} - ${audio}`);
    }
}

function pauseAudio(notify = true) {
    const audio = playList[playIndex];
    if (audio && soundsIdx.has(audio.toLowerCase())) {
        const idx = soundsIdx.get(audio.toLowerCase());
        soundsDat[idx!]?.pause();
        if (notify) {
            Atomics.store(sharedArray, DataType.SND, MediaEvent.PAUSED);
        }
    } else if (audio) {
        notifyAll("warning", `[sound] Can't find audio to pause: ${playIndex} - ${audio}`);
    }
}

function resumeAudio(notify = true) {
    const audio = playList[playIndex];
    if (audio && soundsIdx.has(audio.toLowerCase())) {
        const idx = soundsIdx.get(audio.toLowerCase());
        soundsDat[idx!]?.play();
        if (notify) {
            Atomics.store(sharedArray, DataType.SND, MediaEvent.RESUMED);
        }
    } else if (audio) {
        notifyAll("warning", `[sound] Can't find audio to resume: ${playIndex} - ${audio}`);
    }
}

function seekAudio(position: number) {
    const audio = playList[playIndex];
    if (audio && soundsIdx.has(audio.toLowerCase())) {
        const idx = soundsIdx.get(audio.toLowerCase());
        soundsDat[idx!]?.seek(position);
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

// Sound Effects (WAV) Functions
function triggerSfx(wav: string, volume: number, index: number) {
    const sfx = sfxMap.get(wav.toLowerCase());
    if (sfx?.sound instanceof Howl) {
        if (volume && !isNaN(volume)) {
            sfx.sound.volume(volume / 100);
        }
        if (index >= 0 && index < MaxSoundStreams) {
            if (sfxStreams[index]?.playing()) {
                sfxStreams[index].stop();
            }
            sfxStreams[index] = sfx.sound;
            sfx.sound.once("end", function () {
                Atomics.store(sharedArray, DataType.WAV + index, -1);
            });
            sfx.sound.play();
            Atomics.store(sharedArray, DataType.WAV + index, sfx.id);
        }
    }
}

function stopSfx(wav: string) {
    const sfx = sfxMap.get(wav.toLowerCase());
    if (sfx) {
        for (let index = 0; index < MaxSoundStreams; index++) {
            const wavId = Atomics.load(sharedArray, DataType.WAV + index);
            if (wavId === sfx.id) {
                Atomics.store(sharedArray, DataType.WAV + index, -1);
                break;
            }
        }
        sfx.sound.stop();
    } else {
        notifyAll("warning", `[sound] Can't find wav sound: ${wav}`);
    }
}
