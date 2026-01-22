/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SubscribeCallback, formatLocale, saveDataBuffer } from "./util";
import { BufferType, DataType, MediaEvent, MediaErrorCode, Platform, MediaTrack, DeviceInfo } from "../core/common";
import Hls from "hls.js";

// Video Objects
export let player: HTMLVideoElement;
let hls: Hls | undefined;
let deviceData: DeviceInfo;
let packageVideos = new Map();
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
let previousBuffered = 0;
let previousTime = Date.now();
const audioTracks: MediaTrack[] = [];
const textTracks: MediaTrack[] = [];

// Initialize Video Module
if (typeof document !== "undefined") {
    player = document.getElementById("player") as HTMLVideoElement;
}
/**
 * Initializes the video module with shared array buffer and device configuration.
 * Sets up video player event listeners and state tracking.
 * @param array Shared Int32Array for inter-thread communication
 * @param deviceInfo Device information including locale and language preferences
 * @param mute Initial mute state (defaults to false)
 */
export function initVideoModule(array: Int32Array, deviceInfo: DeviceInfo, mute: boolean = false) {
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
                Atomics.store(sharedArray, DataType.VDO, MediaEvent.StartStream);
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
            let errorCode = MediaErrorCode.Http;
            if (player.error?.code === MediaError.MEDIA_ERR_DECODE) {
                errorCode = MediaErrorCode.Unsupported;
            }
            Atomics.store(sharedArray, DataType.VDX, errorCode);
            Atomics.store(sharedArray, DataType.VDO, MediaEvent.Failed);
            notifyAll("warning", `[video] Player Media Error ${player.error?.code}; ${player.error?.message}`);
        });
        player.addEventListener("ended", nextVideo);
        player.addEventListener("loadstart", startProgress);
        player.addEventListener("durationchange", setDuration);
        player.addEventListener("loadedmetadata", startProgress);
        player.addEventListener("loadeddata", startProgress);
        player.addEventListener("progress", calculateBandwidth);
        player.muted = true;
        player.defaultMuted = true;
        uiMuted = mute;
    }
    deviceData = deviceInfo;
    sharedArray = array;
    resetVideo();
    initDrmDetection();
}
/**
 * Calculates video download bandwidth based on buffered data.
 * Updates bandwidth estimate for non-HLS playback.
 * @param e Progress event from video player
 */
function calculateBandwidth(e: Event) {
    if (hls === undefined && player && player.buffered.length > 0) {
        let totalBuffered = 0;
        for (let i = 0; i < player.buffered.length; i++) {
            totalBuffered += player.buffered.end(i) - player.buffered.start(i);
        }
        totalBuffered = player.videoWidth * player.videoHeight * 4 * totalBuffered;
        const bufferedSinceLast = totalBuffered - previousBuffered;
        let downloadedBits = bufferedSinceLast * 8;
        const currentTime = Date.now();
        const timeElapsed = (currentTime - previousTime) / 1000; // Convert to seconds
        const bandwidth = downloadedBits / timeElapsed / 1024;
        previousBuffered = totalBuffered;
        previousTime = currentTime;
        notifyAll("bandwidth", Math.round(bandwidth));
    }
}
// Observers Handling
const observers = new Map();
/**
 * Subscribes an observer to video events.
 * @param observerId Unique identifier for the observer
 * @param observerCallback Callback function to receive events
 */
export function subscribeVideo(observerId: string, observerCallback: SubscribeCallback) {
    observers.set(observerId, observerCallback);
}
/**
 * Unsubscribes an observer from video events.
 * @param observerId Unique identifier of the observer to remove
 */
export function unsubscribeVideo(observerId: string) {
    observers.delete(observerId);
}
/**
 * Notifies all subscribed observers of a video event.
 * Updates playerState for play/pause/stop events.
 * @param eventName Name of the event
 * @param eventData Optional data associated with the event
 */
function notifyAll(eventName: string, eventData?: any) {
    if (["play", "pause", "stop"].includes(eventName)) {
        playerState = eventName;
    }
    for (const [_id, callback] of observers) {
        callback(eventName, eventData);
    }
}

/**
 * Handles video playback events from the engine.
 * Processes commands like play, load, stop, pause, resume, mute, loop, next, seek, audio, subtitle.
 * @param eventData Comma-separated event string with command and parameters
 */
export function handleVideoEvent(eventData: string) {
    const data = eventData.split(",");
    if (data[1] === "play") {
        playVideo();
    } else if (data[1] === "load") {
        loadVideo(true);
    } else if (data[1] === "rect" && data.length === 6) {
        notifyAll("rect", {
            x: Number.parseInt(data[2]),
            y: Number.parseInt(data[3]),
            w: Number.parseInt(data[4]),
            h: Number.parseInt(data[5]),
        });
    } else if (data[1] === "notify" && data.length === 3) {
        notifyTime = Number.parseInt(data[2]) >= 1;
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
        if (newIndex && !Number.isNaN(Number.parseInt(newIndex))) {
            setNextVideo(Number.parseInt(newIndex));
        } else {
            Atomics.store(sharedArray, DataType.VDX, MediaErrorCode.EmptyList);
            Atomics.store(sharedArray, DataType.VDO, MediaEvent.Failed);
            notifyAll("warning", `[video] Invalid next index: ${eventData}`);
        }
    } else if (data[1] === "seek") {
        const position = data[2];
        if (position && !Number.isNaN(Number.parseInt(position))) {
            seekVideo(Math.round(Number.parseInt(position) / 1000));
        } else {
            notifyAll("warning", `[video] Invalid seek position: ${eventData}`);
        }
    } else if (data[1] === "audio") {
        setAudioTrack(audioTracks.findIndex((t) => t.id === data[2]));
    } else if (data[1] === "subtitle") {
        setSubtitleTrack(textTracks.findIndex((t) => t.id === data[2]));
    } else if (data[1] === "error") {
        stopVideo(true);
    }
}

/**
 * Mutes or unmutes video audio output.
 * @param mute True to mute video, false to unmute (defaults to false)
 */
export function muteVideo(mute: boolean = false) {
    if (player) {
        uiMuted = mute;
        player.muted = mute || videoMuted;
    }
}

/**
 * Checks if video is currently muted by the UI.
 * @returns True if UI mute is enabled
 */
export function isVideoMuted() {
    return uiMuted ?? false;
}

/**
 * Switches video playback state (play/pause).
 * @param play True to resume playback, false to pause
 */
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

/**
 * Gets the list of supported video codecs and containers in the current browser.
 * @returns Map with 'codecs' and 'containers' arrays of supported formats
 */
export function videoFormats() {
    const codecs: string[] = [];
    const containers: string[] = [];
    if (Platform.inBrowser) {
        // Mime and Codecs browser test page
        // https://cconcolato.github.io/media-mime-support/
        const formats = new Map([
            ["av1", `video/mp4; codecs="av01.0.05M.08"`],
            ["mpeg4 avc", `video/mp4; codecs="avc1.42E01E"`],
            ["hevc", `video/mp4; codecs="hev1.2.4.L120.B0"`],
            ["vp8", `video/webm; codecs="vp8, vorbis"`],
            ["vp9", `video/mp4; codecs="vp09.00.50.08"`],
            ["mpeg1", "video/mpeg"],
            ["mpeg2", "video/mpeg2"],
        ]);
        for (const [codec, mime] of formats) {
            if (player.canPlayType(mime) !== "") {
                codecs.push(codec);
            }
        }
        // All Browsers Support mp4, m4v and mov, only Chromium supports mkv natively
        // https://stackoverflow.com/questions/57060193/browser-support-for-mov-video
        containers.push.apply(containers, ["mp4", "m4v", "mov"]);
        if (player.canPlayType("application/vnd.apple.mpegurl") || Hls.isSupported()) {
            containers.push("hls");
        }
        if (player.canPlayType("video/mp2t") !== "") {
            containers.push("ts");
        }
        if (Platform.inChromium) {
            containers.push("mkv");
        }
    }
    return new Map([
        ["codecs", codecs],
        ["containers", containers],
    ]);
}

/**
 * Adds a video file to the package video registry.
 * @param path Path identifier for the video
 * @param data Blob data for the video file
 */
export function addVideo(path: string, data: Blob) {
    packageVideos.set(path.toLowerCase(), data);
}

/**
 * Sets a new video playlist, stopping any current playback.
 * @param newList Array of video objects with url and format properties
 */
export function addVideoPlaylist(newList: any[]) {
    if (playList.length > 0) {
        stopVideo();
    }
    playList = newList;
    playIndex = 0;
    playNext = -1;
    startPosition = 0;
}

/**
 * Resets all video state and clears the playlist and package videos.
 */
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
    startPosition = 0;
    playerState = "stop";
    videosState = false;
}

/**
 * Handles video load progress events.
 * Loads audio/subtitle tracks and updates shared array progress.
 * @param e Load event (loadeddata or loadedmetadata)
 */
function startProgress(e: Event) {
    if (e.type === "loadeddata") {
        const currAudioTrack = loadAudioTracks();
        const currSubtitleTrack = loadSubtitleTracks();
        const tracks = { audio: audioTracks, text: textTracks };
        saveDataBuffer(sharedArray, JSON.stringify(tracks), BufferType.MEDIA_TRACKS);
        Atomics.store(sharedArray, DataType.VAT, currAudioTrack);
        Atomics.store(sharedArray, DataType.VTT, currSubtitleTrack);
    } else if (e.type === "loadedmetadata") {
        if (startPosition > 0) {
            player.currentTime = startPosition;
            startPosition = 0;
        }
    }
    loadProgress += 200;
    Atomics.store(sharedArray, DataType.VLP, loadProgress);
}

/**
 * Sets the video duration in the shared array when available.
 * @param e Duration change event from video player
 */
function setDuration(e: Event) {
    if (!Number.isNaN(player.duration)) {
        videoDuration = Math.round(player.duration);
        Atomics.store(sharedArray, DataType.VDR, videoDuration);
    }
    if (playerState !== "play") {
        startProgress(e);
    }
}

/**
 * Loads audio tracks from HLS stream and selects preferred track.
 * Prioritizes: audio language > device locale > English.
 * @returns Active audio track index
 */
function loadAudioTracks() {
    audioTracks.length = 0;
    if (!hls) {
        return -1;
    }
    let preferredTrackId = -1;
    let deviceTrackId = -1;
    let englishTrackId = -1;
    for (const [index, track] of hls.audioTracks.entries()) {
        const audioTrack: MediaTrack = {
            id: `${index + 1}`,
            name: track.name,
            lang: track.lang ?? "",
            codec: track.audioCodec,
        };
        audioTracks.push(audioTrack);
        // Format the language code
        const lang = formatLocale(audioTrack.lang);
        // Save the track ids for preferred locale, device locale and english
        let deviceLocale = deviceData.locale.toLowerCase().slice(0, 2);
        let audioLocale = deviceData.audioLanguage.toLowerCase().slice(0, 2);

        if (preferredTrackId === -1 && lang === audioLocale) {
            preferredTrackId = track.id;
        } else if (deviceTrackId === -1 && lang === deviceLocale) {
            deviceTrackId = track.id;
        } else if (englishTrackId === -1 && lang === "en") {
            englishTrackId = track.id;
        }
    }
    let activeTrack = 0;
    if (audioTracks.length > 0) {
        // Set the active track prioritizing preferred locale, device locale and english
        if (preferredTrackId > -1) {
            activeTrack = preferredTrackId;
        } else if (deviceTrackId > -1) {
            activeTrack = deviceTrackId;
        } else if (englishTrackId > -1) {
            activeTrack = englishTrackId;
        }
        hls.audioTrack = activeTrack;
        playList[playIndex].audioTrack = activeTrack;
        if (activeTrack > -1 && playerState !== "play") {
            player.currentTime = 1; // Force HLS to load audio track
            player.play();
        }
    }
    return activeTrack;
}

/**
 * Loads subtitle tracks from HLS stream and selects preferred track.
 * Prioritizes: caption language > device locale > English.
 * @returns Active subtitle track index
 */
function loadSubtitleTracks() {
    textTracks.length = 0;
    if (!hls?.subtitleTracks?.length) {
        return -1;
    }
    let preferredTrackId = -1;
    let deviceTrackId = -1;
    let englishTrackId = -1;
    for (const [index, track] of hls.subtitleTracks.entries()) {
        const textTrack: MediaTrack = {
            id: `webvtt/${index + 1}`,
            name: track.name,
            lang: track.lang ?? "",
        };
        textTracks.push(textTrack);
        // Format the language code
        const lang = formatLocale(textTrack.lang);
        // Save the track ids for preferred locale, device locale and english
        let deviceLocale = deviceData.locale.toLowerCase().slice(0, 2);
        let captionLocale = deviceData.captionLanguage.toLowerCase().slice(0, 2);
        if (preferredTrackId === -1 && lang === captionLocale) {
            preferredTrackId = index;
        } else if (deviceTrackId === -1 && lang === deviceLocale) {
            deviceTrackId = index;
        } else if (englishTrackId === -1 && lang === "en") {
            englishTrackId = index;
        }
    }
    let activeTrack = 0;
    if (textTracks.length > 0) {
        // Set the active track prioritizing preferred locale, device locale and english
        if (preferredTrackId > -1) {
            activeTrack = preferredTrackId;
        } else if (deviceTrackId > -1) {
            activeTrack = deviceTrackId;
        } else if (englishTrackId > -1) {
            activeTrack = englishTrackId;
        }
        hls.subtitleTrack = activeTrack;
        playList[playIndex].subtitleTrack = activeTrack;
    }
    return activeTrack;
}

/**
 * Sets the active audio track for HLS playback.
 * @param index Audio track index to activate
 */
function setAudioTrack(index: number) {
    if (hls && audioTracks.length && index > -1 && index < audioTracks.length) {
        hls.audioTrack = index;
        playList[playIndex].audioTrack = index;
        Atomics.store(sharedArray, DataType.VAT, hls.audioTrack);
    }
}

/**
 * Sets the active subtitle track for HLS playback.
 * @param index Subtitle track index to activate
 */
function setSubtitleTrack(index: number) {
    if (hls && textTracks.length && index > -1 && index < textTracks.length) {
        hls.subtitleTrack = index;
        playList[playIndex].subtitleTrack = index;
        Atomics.store(sharedArray, DataType.VTT, hls.subtitleTrack);
    }
}

/**
 * Clears video tracking state (progress, tracks, captions).
 * Resets shared array values to initial state.
 */
function clearVideoTracking() {
    Atomics.store(sharedArray, DataType.VLP, -1);
    loadProgress = 0;
    currentFrame = 0;
    audioTracks.length = 0;
    textTracks.length = 0;
    if (player.textTracks?.length) {
        // Disable all text tracks
        for (const track of player.textTracks) {
            track.mode = "disabled";
        }
    }
}

/**
 * Loads a video from the playlist into the player.
 * Handles different formats (mp4, mkv, hls) and sets up source.
 * @param buffer Whether to only buffer without playing (defaults to false)
 */
function loadVideo(buffer = false) {
    canPlay = false;
    const video = playList[playIndex];
    if (video && player) {
        notifyAll("load");
        let videoSrc = getVideoUrl(video);
        clearVideoTracking();
        bufferOnly = buffer;
        if (["mp4", "mkv"].includes(video.streamFormat)) {
            destroyHls();
            player.setAttribute("type", "video/mp4");
        } else if (video.streamFormat === "hls") {
            if (!loadHls(videoSrc)) {
                return;
            }
        } else {
            player.removeAttribute("type");
        }
        if (videoSrc.length) {
            player.src = videoSrc;
            player.load();
        }
    } else if (player) {
        Atomics.store(sharedArray, DataType.VDX, MediaErrorCode.EmptyList);
        Atomics.store(sharedArray, DataType.VDO, MediaEvent.Failed);
        notifyAll("warning", `[video] Can't find video index: ${playIndex}`);
    } else {
        notifyAll("error", `[video] Can't find a video player!`);
    }
}

/**
 * Loads an HLS stream using HLS.js or native browser support.
 * @param videoSrc URL of the HLS stream
 * @returns True if using native HLS, false if using HLS.js
 */
function loadHls(videoSrc: string): boolean {
    let native = false;
    if (Hls.isSupported()) {
        createHlsInstance();
        hls?.loadSource(videoSrc);
        hls?.attachMedia(player);
    } else if (player.canPlayType("application/vnd.apple.mpegurl")) {
        // Fallback to native HLS support
        player.setAttribute("type", "application/vnd.apple.mpegurl");
        native = true;
    } else {
        Atomics.store(sharedArray, DataType.VDX, MediaErrorCode.Unsupported);
        Atomics.store(sharedArray, DataType.VDO, MediaEvent.Failed);
        notifyAll("warning", "[video] HLS is not supported");
    }
    return native;
}

/**
 * Gets the video URL from the video object.
 * Handles http URLs, pkg:// paths, and blob URLs.
 * @param video Video object with url property
 * @returns Video URL string
 */
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

/**
 * Plays the loaded video.
 * Loads video first if not ready, handles autoplay restrictions.
 */
function playVideo() {
    if (canPlay) {
        previousBuffered = 0;
        previousTime = Date.now();
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

// Flag to prevent double event call
let ending = false;

/**
 * Advances to the next video in the playlist.
 * Handles looping, single video repeat, and end-of-playlist.
 * Called on video 'ended' event or explicitly via setNextVideo.
 */
function nextVideo() {
    if (ending) {
        return;
    }
    ending = true;
    Atomics.store(sharedArray, DataType.VDX, playIndex);
    Atomics.store(sharedArray, DataType.VDO, MediaEvent.Finished);
    if (playNext < 0) {
        playNext = playIndex + 1;
    }
    if (playNext < playList.length) {
        playIndex = playNext;
    } else if (playLoop) {
        playIndex = 0;
        if (playList.length === 1) {
            player.currentTime = startPosition;
            resumeVideo(false);
            ending = false;
            return;
        }
    } else {
        Atomics.store(sharedArray, DataType.VDX, playIndex);
        Atomics.store(sharedArray, DataType.VDO, MediaEvent.Full);
        playIndex = 0;
        playNext = -1;
        canPlay = false;
        startPosition = 0;
        clearVideoTracking();
        notifyAll("stop");
        ending = false;
        return;
    }
    playNext = -1;
    playerState = "stop";
    canPlay = false;
    Atomics.store(sharedArray, DataType.VSE, playIndex);
    loadVideo();
    ending = false;
}

/**
 * Stops video playback and clears state.
 * @param error Whether video stopped due to error (defaults to false)
 */
function stopVideo(error?: boolean) {
    if (player && (playerState !== "stop" || error)) {
        player.pause();
        if (hls) {
            destroyHls();
        } else {
            player.removeAttribute("src"); // empty source
            player.load();
        }
        notifyAll("stop");
        Atomics.store(sharedArray, DataType.VDX, playIndex);
        Atomics.store(sharedArray, DataType.VDO, error ? MediaEvent.Finished : MediaEvent.Partial);
        clearVideoTracking();
        startPosition = 0;
        canPlay = false;
    }
}

/**
 * Pauses video playback.
 * Updates shared array state to indicate pause.
 */
function pauseVideo() {
    if (player) {
        player.pause();
        notifyAll("pause");
        Atomics.store(sharedArray, DataType.VDO, MediaEvent.Paused);
    }
}

/**
 * Resumes paused video playback.
 * @param notify Whether to update shared array state (defaults to true)
 */
function resumeVideo(notify = true) {
    if (player?.paused) {
        player.play();
        player.muted = uiMuted || videoMuted;
        if (notify) {
            Atomics.store(sharedArray, DataType.VDO, MediaEvent.Resumed);
        }
    }
}

/**
 * Seeks to a specific position in the video.
 * Handles seek before play, during playback, and before next video.
 * @param position Position in seconds to seek to
 */
function seekVideo(position: number) {
    if (!player) {
        return;
    }
    if (playerState === "stop") {
        // Seek before play set the start of the video to a specific position
        // Replicate Roku behavior and start a few seconds before the seek position
        startPosition = position < 3 ? 0 : position - 2;
    } else if (playNext === -1 || playNext === playIndex) {
        if (position > videoDuration || position < 0) {
            // Replicate Roku behavior: go to a few seconds before the end of video
            position = videoDuration - 2;
        }
        player.currentTime = position;
        if (playerState === "pause") {
            resumeVideo(false);
        }
    } else {
        startPosition = position;
        nextVideo();
    }
}

/**
 * Sets whether the video playlist should loop.
 * @param enable True to enable looping
 */
function setVideoLoop(enable: boolean) {
    playLoop = enable;
}

/**
 * Sets the next video index to play after current finishes.
 * @param index Next video index in playlist
 */
function setNextVideo(index: number) {
    playNext = index;
    if (playNext >= playList.length) {
        playNext = -1;
        notifyAll("warning", `[video] Next index out of range: ${index}`);
    }
}

/**
 * Creates an object URL for a video blob.
 * @param blob Video blob data
 * @returns Object URL string
 */
function createVideoURL(blob: Blob) {
    return URL.createObjectURL(blob);
}

/**
 * Revokes a video object URL to free memory.
 * @param url Object URL to revoke
 */
function revokeVideoURL(url: string) {
    URL.revokeObjectURL(url);
}

/**
 * Creates and configures a new HLS.js instance with error handlers.
 * Sets up event listeners for manifest, fragments, and errors.
 */
function createHlsInstance() {
    hls?.detachMedia();
    hls?.destroy();
    hls = new Hls();
    hls.on(Hls.Events.ERROR, function (event, data) {
        if (data.fatal) {
            switch (data.type) {
                case Hls.ErrorTypes.MEDIA_ERROR:
                    hls?.recoverMediaError();
                    break;
                case Hls.ErrorTypes.NETWORK_ERROR:
                    // All retries and media options have been exhausted.
                    Atomics.store(sharedArray, DataType.VDX, MediaErrorCode.Http);
                    Atomics.store(sharedArray, DataType.VDO, MediaEvent.Failed);
                    notifyAll("warning", `[video] fatal network error encountered: ${data.details}`);
                    break;
                default:
                    // cannot recover
                    Atomics.store(sharedArray, DataType.VDX, MediaErrorCode.Unknown);
                    Atomics.store(sharedArray, DataType.VDO, MediaEvent.Failed);
                    notifyAll("warning", "[video] fatal media error encountered, cannot recover");
                    break;
            }
        }
    });

    hls.on(Hls.Events.MANIFEST_LOADED, function (event, data) {
        if (data.networkDetails) {
            notifyAll("http.connect", data.networkDetails);
        }
    });

    hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
        const bandwidth = hls?.bandwidthEstimate || Number.NaN;
        if (!Number.isNaN(bandwidth)) {
            notifyAll("bandwidth", Math.round(bandwidth / 1000));
        }
    });

    hls.on(Hls.Events.FRAG_CHANGED, function (event, data) {
        if (typeof data.frag.sn === "number") {
            currentFrame = data.frag.sn;
        }
    });

    hls.on(Hls.Events.MEDIA_ENDED, nextVideo);
}

/**
 * Destroys the HLS.js instance and frees resources.
 */
function destroyHls() {
    hls?.detachMedia();
    hls?.destroy();
    hls = undefined;
}

/**
 * Initializes DRM detection asynchronously and updates device data.
 * Should be called during module initialization.
 */
export function initDrmDetection() {
    if (Platform.inBrowser) {
        detectDrmInfo()
            .then((drmInfo) => {
                deviceData.drmInfo = drmInfo;
            })
            .catch((err: any) => {
                notifyAll("error", `[video] Failed to detect DRM info: ${err.message}`);
            });
    }
}

type DrmInfoEntry = {
    multikey: boolean;
    securestop: boolean;
    tee: boolean;
    version: string;
    securityLevel: string;
    keySystem: string;
    robustness: string;
};

type DrmSystemDefinition = {
    name: "PlayReady" | "Widevine";
    keySystems: string[];
    version: string;
};

const DRM_SYSTEMS: DrmSystemDefinition[] = [
    {
        name: "PlayReady",
        version: "2.5",
        keySystems: [
            "com.microsoft.playready",
            "com.microsoft.playready.recommendation",
            "com.microsoft.playready.hardware",
        ],
    },
    {
        name: "Widevine",
        version: "widevine 16.4.0",
        keySystems: ["com.widevine.alpha"],
    },
];

const DRM_INIT_DATA_TYPES = ["cenc", "keyids", "webm"];
const DRM_VIDEO_CONTENT_TYPES = ['video/mp4; codecs="avc1.42E01E"', 'video/webm; codecs="vp9"'];
const DRM_AUDIO_CONTENT_TYPES = ['audio/mp4; codecs="mp4a.40.2"'];
const DRM_SESSION_TYPES: MediaKeySessionType[] = ["temporary", "persistent-license"];

const ROBUSTNESS_PRESETS = {
    hardware: {
        video: "HW_SECURE_ALL",
        audio: "HW_SECURE_CRYPTO",
    },
    software: {
        video: "SW_SECURE_DECODE",
        audio: "SW_SECURE_CRYPTO",
    },
} as const;

const DRM_FALLBACK = new Map<string, DrmInfoEntry>([
    [
        "PlayReady",
        {
            multikey: false,
            securestop: false,
            tee: false,
            version: "playready 2.5",
            securityLevel: "2000",
            keySystem: "com.microsoft.playready",
            robustness: ROBUSTNESS_PRESETS.software.video,
        },
    ],
    [
        "Widevine",
        {
            multikey: true,
            securestop: true,
            tee: false,
            version: "widevine 16.4.0",
            securityLevel: "2",
            keySystem: "com.widevine.alpha",
            robustness: ROBUSTNESS_PRESETS.software.video,
        },
    ],
]);

const DRM_SAFARI = new Map<string, DrmInfoEntry>([
    [
        "FairPlay",
        {
            multikey: true,
            securestop: true,
            tee: true,
            version: "fairplay 4.0",
            securityLevel: "1",
            keySystem: "com.apple.fps.1_0",
            robustness: ROBUSTNESS_PRESETS.hardware.video,
        },
    ],
]);

const DRM_CAPABILITY_PRESETS: Array<{ video?: string; audio?: string }> = [
    { video: ROBUSTNESS_PRESETS.hardware.video, audio: ROBUSTNESS_PRESETS.hardware.audio },
    { video: ROBUSTNESS_PRESETS.software.video, audio: ROBUSTNESS_PRESETS.software.audio },
];

const DRM_SESSION_VARIANTS: Array<{ sessionTypes: MediaKeySessionType[]; persistentState: MediaKeysRequirement }> = [
    { sessionTypes: DRM_SESSION_TYPES, persistentState: "required" },
    { sessionTypes: DRM_SESSION_TYPES, persistentState: "optional" },
    { sessionTypes: ["temporary"], persistentState: "optional" },
];

/**
 * Gets DRM system information and capabilities from the browser.
 * Uses Encrypted Media Extensions (EME) API to detect PlayReady and Widevine support.
 * Adds explicit robustness requirements to avoid UA warnings and surface the selected security tier.
 * @returns Promise that resolves to a Map with DRM system info objects
 */
async function detectDrmInfo(): Promise<Map<string, DrmInfoEntry>> {
    const drmInfo = new Map<string, DrmInfoEntry>();
    const probeErrors: string[] = [];
    if (!Platform.inBrowser || !navigator.requestMediaKeySystemAccess) {
        notifyAll("warning", "[video] DRM detection not supported in this environment.");
        return new Map(DRM_FALLBACK);
    } else if (typeof window !== "undefined" && !window.isSecureContext) {
        notifyAll("warning", "[video] DRM detection requires a secure context (https or electron secure).");
        return new Map(DRM_FALLBACK);
    }
    if (Platform.inSafari) {
        return new Map(DRM_SAFARI);
    }
    for (const system of DRM_SYSTEMS) {
        for (const keySystem of system.keySystems) {
            try {
                const configs = buildMediaKeyConfigs(system.name, keySystem);
                const access = await navigator.requestMediaKeySystemAccess(keySystem, configs);
                const configUsed = access.getConfiguration();
                const robustness = configUsed.videoCapabilities?.[0]?.robustness ?? "";
                const hardware = robustness.startsWith("HW_") || keySystem.includes("hardware");
                const sessionTypes = configUsed.sessionTypes ?? [];
                const persistentState = configUsed.persistentState ?? "optional";
                const securestop = persistentState === "required" || sessionTypes.includes("persistent-license");
                const securityLevel = system.name === "Widevine" ? (hardware ? "1" : "3") : hardware ? "3000" : "2000";

                drmInfo.set(system.name, {
                    multikey: sessionTypes.includes("persistent-license"),
                    securestop,
                    tee: hardware,
                    version: system.version,
                    securityLevel,
                    keySystem,
                    robustness,
                });
                break;
            } catch (error: any) {
                probeErrors.push(error?.message ?? String(error));
            }
        }
    }
    if (drmInfo.size === 0) {
        notifyAll(
            "warning",
            `[video] DRM detection fallback due to: ${
                probeErrors.length ? "unsupported key systems" : "no drm interfaces"
            }`
        );
        return new Map(DRM_FALLBACK);
    }
    notifyAll("debug", `[video] DRM info detected: ${JSON.stringify(Array.from(drmInfo.entries()))}`);
    return drmInfo;
}

/**
 * Builds MediaKeySystemConfiguration array for DRM capability testing.
 * Creates configurations with different robustness and session type combinations.
 * @param systemName DRM system name ("PlayReady" or "Widevine")
 * @param keySystem Key system identifier string
 * @returns Array of MediaKeySystemConfiguration objects to test
 */
function buildMediaKeyConfigs(systemName: string, keySystem: string): MediaKeySystemConfiguration[] {
    const prefersHardware = keySystem.includes("hardware") || systemName === "Widevine";
    const configs: MediaKeySystemConfiguration[] = [];
    const seen = new Set<string>();
    for (const preset of DRM_CAPABILITY_PRESETS) {
        if (preset === DRM_CAPABILITY_PRESETS[0] && !prefersHardware) {
            continue;
        }
        for (const session of DRM_SESSION_VARIANTS) {
            const signature = `${preset.video ?? "none"}-${preset.audio ?? "none"}-${session.sessionTypes.join(",")}-${
                session.persistentState
            }`;
            if (seen.has(signature)) {
                continue;
            }
            seen.add(signature);
            configs.push({
                initDataTypes: DRM_INIT_DATA_TYPES,
                distinctiveIdentifier: "optional",
                persistentState: session.persistentState,
                sessionTypes: session.sessionTypes,
                videoCapabilities: DRM_VIDEO_CONTENT_TYPES.map((contentType) =>
                    preset.video && preset.video.length > 0
                        ? { contentType, robustness: preset.video }
                        : { contentType }
                ),
                audioCapabilities: DRM_AUDIO_CONTENT_TYPES.map((contentType) =>
                    preset.audio && preset.audio.length > 0
                        ? { contentType, robustness: preset.audio }
                        : { contentType }
                ),
            });
        }
    }
    return configs;
}
