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
let soundMuted = false;
let uiMuted = false;
let homeSfx: Howl;
let notifyInterval = 500; // milliseconds

/**
 * Initializes the sound module with shared array buffer and mute state.
 * @param array Shared Int32Array for inter-thread communication
 * @param mute Initial mute state (defaults to false)
 */
export function initSoundModule(array: Int32Array, mute: boolean = false) {
    sharedArray = array;
    muteSound(mute);
}

// Observers Handling
const observers = new Map();
/**
 * Subscribes an observer to sound events.
 * @param observerId Unique identifier for the observer
 * @param observerCallback Callback function to receive events
 */
export function subscribeSound(observerId: string, observerCallback: SubscribeCallback) {
    observers.set(observerId, observerCallback);
}
/**
 * Unsubscribes an observer from sound events.
 * @param observerId Unique identifier of the observer to remove
 */
export function unsubscribeSound(observerId: string) {
    observers.delete(observerId);
}
/**
 * Notifies all subscribed observers of a sound event.
 * @param eventName Name of the event
 * @param eventData Optional data associated with the event
 */
function notifyAll(eventName: string, eventData?: any) {
    for (const [_id, callback] of observers) {
        callback(eventName, eventData);
    }
}

/**
 * Handles audio playback events from the engine.
 * Processes commands like play, stop, pause, resume, loop, next, seek, and mute.
 * @param eventData Comma-separated event string with command and parameters
 */
export function handleAudioEvent(eventData: string) {
    const data = eventData.split(",");
    if (data[1] === "play" || data[1] === "start") {
        playAudio();
    } else if (data[1] === "stop") {
        stopAudio();
    } else if (data[1] === "notify" && data.length === 3) {
        notifyInterval = Number.parseInt(data[2]);
    } else if (data[1] === "pause") {
        pauseAudio();
    } else if (data[1] === "resume") {
        resumeAudio();
    } else if (data[1] === "loop" && data.length >= 3) {
        setLoop(data[2] === "true");
    } else if (data[1] === "next" && data.length >= 3) {
        const newIndex = Number.parseInt(data[2]);
        if (Number.isNaN(newIndex)) {
            notifyAll("warning", `[sound] Invalid next index: ${eventData}`);
            return;
        }
        setNext(newIndex);
    } else if (data[1] === "seek" && data.length >= 3) {
        const position = Number.parseInt(data[2]);
        if (Number.isNaN(position)) {
            notifyAll("warning", `[sound] Invalid seek position: ${eventData}`);
            return;
        }
        seekAudio(position);
    } else if (data[1] === "mute" && data.length >= 3) {
        soundMuted = data[2] === "true";
        Howler.mute(uiMuted || soundMuted);
    } else {
        notifyAll("warning", `[sound] Unknown or invalid audio event: ${eventData}`);
    }
}

/**
 * Handles sound effect (SFX) events from the engine.
 * Processes commands like new, trigger, and stop for WAV sound effects.
 * @param eventData Comma-separated event string with command and parameters
 */
export function handleSfxEvent(eventData: string) {
    const data = eventData.split(",");
    if (data[1] === "new" && data.length >= 4) {
        const wav = data[2];
        const id = Number.parseInt(data[3]);
        if (sfxMap.has(wav.toLowerCase())) {
            // Sound Effect already registered
            return;
        } else if (Number.isNaN(id) || id < 0) {
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
        triggerSfx(data[2], Number.parseInt(data[3]), Number.parseInt(data[4]));
    } else if (data[1] === "stop" && data.length >= 3) {
        stopSfx(data[2]);
    } else {
        notifyAll("warning", `[sound] Unknown or invalid SFX event: ${eventData}`);
    }
}

/**
 * Mutes or unmutes all sound output.
 * @param mute True to mute sound, false to unmute (defaults to false)
 */
export function muteSound(mute: boolean = false) {
    uiMuted = mute;
    Howler.mute(uiMuted || soundMuted);
}

/**
 * Checks if sound is currently muted by the UI.
 * @returns True if UI mute is enabled
 */
export function isSoundMuted() {
    return uiMuted;
}

/**
 * Checks if any sound is currently playing.
 * @returns True if any sound is playing
 */
export function soundPlaying() {
    return soundsDat.some((sound) => {
        return sound.playing();
    });
}

/**
 * Switches sound playback state (play/pause all sounds).
 * @param play True to resume all paused sounds, false to pause all playing sounds
 */
export function switchSoundState(play: boolean) {
    if (play) {
        for (const id of soundState) {
            soundsDat[id]?.play();
        }
    } else {
        soundState.length = 0;
        for (const [index, sound] of soundsDat.entries()) {
            if (sound.playing()) {
                sound.pause();
                soundState.push(index);
            }
        }
    }
}

/**
 * Gets the list of supported audio codecs in the current browser.
 * @returns Array of supported codec names
 */
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

/**
 * Sets a new audio playlist, stopping any current playback.
 * @param newList Array of audio file paths or URLs
 */
export function addAudioPlaylist(newList: string[]) {
    if (playList.length > 0) {
        stopAudio();
    }
    playList.length = 0;
    playList.push(...newList);
    playIndex = 0;
    playNext = -1;
}

let animationFrameId: number;
let lastUpdate: number = 0;

/**
 * Adds a sound file to the sound registry.
 * @param path Path identifier for the sound
 * @param format Audio format (e.g., 'wav', 'mp3')
 * @param data Blob data for the sound file
 */
export function addSound(path: string, format: string, data: any) {
    registerSound(path, format === "wav", format, URL.createObjectURL(data));
}

/**
 * Registers a sound in the sound system with Howler.
 * Sets up progress tracking and error handlers.
 * @param path Sound identifier path
 * @param preload Whether to preload the sound
 * @param format Optional audio format
 * @param url Optional URL to load from
 * @returns Created Howl sound object
 */
function registerSound(path: string, preload: boolean, format?: string, url?: string) {
    soundsIdx.set(path.toLowerCase(), soundsDat.length);
    let sound = new Howl({
        src: [url ?? path],
        format: format,
        preload: preload,
        onloaderror: function (id, message) {
            Atomics.store(sharedArray, DataType.SND, MediaEvent.Failed);
            notifyAll("warning", `[sound] Error loading sound ${id} ${path}: ${message}`);
        },
        onplayerror: function (id, message) {
            Atomics.store(sharedArray, DataType.SND, MediaEvent.Failed);
            notifyAll("warning", `[sound] Error playing sound ${id} ${path}: ${message}`);
        },
    });
    sound.on("play", function () {
        const updateProgress = () => {
            if (!sound.playing()) {
                return;
            }
            if (Date.now() - lastUpdate > notifyInterval) {
                if (!Number.isNaN(sound.duration()) && sound.duration() !== Infinity) {
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

/**
 * Resets all sounds and loads default sounds from Common FS assets.
 * @param assets ArrayBuffer containing the zipped Common FS assets
 */
export function resetSounds(assets: ArrayBufferLike) {
    if (soundsDat.length > 0) {
        for (const sound of soundsDat) {
            sound.unload();
        }
    }
    sfxStreams.length = 0;
    soundsIdx.clear();
    soundsDat.length = 0;
    playList.length = 0;
    playIndex = 0;
    playLoop = false;
    playNext = -1;
    if (sfxMap.size > 0) {
        for (const sound of sfxMap.values()) {
            sound.sound?.unload();
        }
        sfxMap.clear();
    }
    try {
        const commonFs = unzipSync(new Uint8Array(assets));
        for (const [index, sound] of DefaultSounds.entries()) {
            const audioData = new Blob([commonFs[`audio/${sound}.wav`] as BlobPart]);
            const sfx: SFX = {
                id: index,
                sound: new Howl({ src: [URL.createObjectURL(audioData)], format: "wav", preload: true }),
            };
            sfxMap.set(sound, sfx);
        }
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

/**
 * Plays the home button sound effect.
 */
export function playHomeSound() {
    if (homeSfx) {
        homeSfx.play();
    }
}

/**
 * Plays the audio at the current playlist index.
 * Loads and plays the sound, updates shared array state.
 */
function playAudio() {
    const audio = playList[playIndex];
    if (audio) {
        let sound: Howl;
        let idx = soundsIdx.get(audio.toLowerCase());
        if (idx !== undefined && idx >= 0 && idx < soundsDat.length) {
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
        Atomics.store(sharedArray, DataType.SND, MediaEvent.Selected);
    } else {
        notifyAll("warning", `[sound] Can't find audio index: ${playIndex}`);
    }
}

/**
 * Advances to the next audio in the playlist.
 * Handles looping and end-of-playlist events.
 */
function nextAudio() {
    Atomics.store(sharedArray, DataType.SDX, playIndex);
    Atomics.store(sharedArray, DataType.SND, MediaEvent.Finished);
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
        Atomics.store(sharedArray, DataType.SND, MediaEvent.Full);
    }
}

/**
 * Stops the currently playing audio.
 * Updates shared array to indicate partial playback.
 */
function stopAudio() {
    const audio = playList[playIndex];
    if (audio && soundsIdx.has(audio.toLowerCase())) {
        const idx = soundsIdx.get(audio.toLowerCase());
        if (soundsDat[idx!]?.state() !== "loading") {
            soundsDat[idx!]?.stop();
        } else {
            soundsDat[idx!]?.unload();
        }
        Atomics.store(sharedArray, DataType.SND, MediaEvent.Partial);
    } else if (audio) {
        notifyAll("warning", `[sound] Can't find audio to stop: ${playIndex} - ${audio}`);
    }
}

/**
 * Pauses the currently playing audio.
 * @param notify Whether to update shared array state (defaults to true)
 */
function pauseAudio(notify = true) {
    const audio = playList[playIndex];
    if (audio && soundsIdx.has(audio.toLowerCase())) {
        const idx = soundsIdx.get(audio.toLowerCase());
        soundsDat[idx!]?.pause();
        if (notify) {
            Atomics.store(sharedArray, DataType.SND, MediaEvent.Paused);
        }
    } else if (audio) {
        notifyAll("warning", `[sound] Can't find audio to pause: ${playIndex} - ${audio}`);
    }
}

/**
 * Resumes the paused audio.
 * @param notify Whether to update shared array state (defaults to true)
 */
function resumeAudio(notify = true) {
    const audio = playList[playIndex];
    if (audio && soundsIdx.has(audio.toLowerCase())) {
        const idx = soundsIdx.get(audio.toLowerCase());
        soundsDat[idx!]?.play();
        if (notify) {
            Atomics.store(sharedArray, DataType.SND, MediaEvent.Resumed);
        }
    } else if (audio) {
        notifyAll("warning", `[sound] Can't find audio to resume: ${playIndex} - ${audio}`);
    }
}

/**
 * Seeks to a specific position in the current audio.
 * @param position Position in seconds
 */
function seekAudio(position: number) {
    const audio = playList[playIndex];
    if (audio && soundsIdx.has(audio.toLowerCase())) {
        const idx = soundsIdx.get(audio.toLowerCase());
        soundsDat[idx!]?.seek(position);
    } else if (audio) {
        notifyAll("warning", `[sound] Can't find audio to seek: ${playIndex} - ${audio}`);
    }
}

/**
 * Sets whether the audio playlist should loop.
 * @param enable True to enable looping
 */
function setLoop(enable: boolean) {
    playLoop = enable;
}

/**
 * Sets the next audio index to play after current finishes.
 * @param index Next audio index in playlist
 */
function setNext(index: number) {
    playNext = index;
    if (playNext >= playList.length) {
        playNext = -1;
        notifyAll("warning", `[sound] Next index out of range: ${index}`);
    }
}

/**
 * Triggers a sound effect (WAV) to play.
 * @param wav Sound effect path/identifier
 * @param volume Volume level (0-100)
 * @param index Stream index (0 to MaxSoundStreams-1)
 */
function triggerSfx(wav: string, volume: number, index: number) {
    const sfx = sfxMap.get(wav.toLowerCase());
    if (sfx?.sound instanceof Howl) {
        if (volume && !Number.isNaN(volume)) {
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

/**
 * Stops a specific sound effect.
 * @param wav Sound effect path/identifier to stop
 */
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
