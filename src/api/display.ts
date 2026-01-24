/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { isVideoMuted, player, subscribeVideo } from "./video";
import { SubscribeCallback } from "./util";
import {
    DeviceInfo,
    Platform,
    parseCaptionMode,
    DisplayMode,
    DisplayModes,
    CaptionOptions,
    CaptionSizes,
    CaptionColors,
    CaptionOpacities,
    CaptionFonts,
    CaptionStyleOption,
} from "../core/common";
import { strFromU8, unzipSync } from "fflate";
import Stats from "stats.js";

// Simulation Display
const screenSize = { width: 1280, height: 720 };
const appCaptionStyle: CaptionStyleOption[] = [];
let display: HTMLCanvasElement;
let deviceData: DeviceInfo;
let ctx: CanvasRenderingContext2D | null;
let bufferCanvas: OffscreenCanvas;
let bufferCtx: CanvasRenderingContext2D | null;
let lastImage: ImageBitmap | null;
let lastFrameReq: number = 0;

// Performance Stats Variables
let statsDiv: HTMLDivElement;
let statsCanvas: Stats | null;
let showStats = false;
let firstFrame = true;
let videoState = "stop";
let videoRect = { x: 0, y: 0, w: 0, h: 0 };
let videoLoop = false;

// Initialize Display Module
let displayState = true;
let overscanMode = "disabled";
let aspectRatio = 16 / 9;
let trickPlayBar = false;
let supportCaptions = false;
interface CachedSubtitleMeasurement {
    metricsWidth: number;
    calculatedBoxWidth: number; // Stores (metrics.width + padding * 2)
}

const subtitleMeasurementCache = new Map<string, CachedSubtitleMeasurement>();
let lastCachedFontSize: number | undefined;
let lastCachedFontFamily: string | undefined;

/**
 * Initializes the display module with canvas and device configuration.
 * Sets up rendering context, aspect ratio, and video subscriptions.
 * @param deviceInfo Device information including display mode
 * @param perfStats Whether to enable performance statistics (defaults to false)
 */
export function initDisplayModule(deviceInfo: DeviceInfo, perfStats = false) {
    // Initialize Display Canvas
    display = document.getElementById("display") as HTMLCanvasElement;
    ctx = display.getContext("2d", { alpha: false });
    if (typeof OffscreenCanvas !== "undefined") {
        bufferCanvas = new OffscreenCanvas(screenSize.width, screenSize.height);
        bufferCtx = bufferCanvas.getContext("2d", {
            alpha: true,
        }) as CanvasRenderingContext2D | null;
        // Performance Statistics
        enableStats(perfStats);
    } else {
        notifyAll(
            "warning",
            `[display] Your browser does not support OffscreenCanvas, so the engine will not work properly, ` +
                `to know more visit https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas`
        );
    }
    // Display Dimensions and Aspect Ratio
    deviceData = deviceInfo;
    aspectRatio = deviceData.displayMode === "480p" ? 4 / 3 : 16 / 9;
    screenSize.height = display.height;
    screenSize.width = Math.trunc(screenSize.height * aspectRatio);
    subscribeVideo("display", (event: string, data: any) => {
        if (event === "rect") {
            videoRect = data;
            return;
        } else if (event === "load") {
            resetSubtitleCache();
            return;
        } else if (["bandwidth", "http.connect", "warning", "error"].includes(event)) {
            return;
        }
        videoState = event;
        if (videoState === "play" && !videoLoop) {
            videoLoop = true;
            lastFrameReq = globalThis.requestAnimationFrame(drawVideoFrame);
        }
    });
    setCaptionStyle(deviceInfo.captionStyle);
}

// Observers Handling
const observers = new Map();
/**
 * Subscribes an observer to display events.
 * @param observerId Unique identifier for the observer
 * @param observerCallback Callback function to receive events
 */
export function subscribeDisplay(observerId: string, observerCallback: SubscribeCallback) {
    observers.set(observerId, observerCallback);
}
/**
 * Unsubscribes an observer from display events.
 * @param observerId Unique identifier of the observer to remove
 */
export function unsubscribeDisplay(observerId: string) {
    observers.delete(observerId);
}
/**
 * Notifies all subscribed observers of a display event.
 * @param eventName Name of the event
 * @param eventData Optional data associated with the event
 */
function notifyAll(eventName: string, eventData?: any) {
    for (const [_id, callback] of observers) {
        callback(eventName, eventData);
    }
}

/**
 * Redraws the display canvas with specified dimensions and settings.
 * @param running Whether the app is currently running
 * @param fullScreen Whether to render in fullscreen mode
 * @param width Optional canvas width
 * @param height Optional canvas height
 * @param dpr Optional device pixel ratio
 */
export function redrawDisplay(running?: boolean, fullScreen?: boolean, width?: number, height?: number, dpr?: number) {
    if (!width) {
        width = globalThis.innerWidth;
    }
    if (!height) {
        height = globalThis.innerHeight;
    }
    if (!dpr) {
        dpr = globalThis.devicePixelRatio;
    }
    screenSize.width = width;
    screenSize.height = Math.trunc(screenSize.width / aspectRatio);
    if (screenSize.height > height) {
        screenSize.height = height;
        screenSize.width = Math.trunc(screenSize.height * aspectRatio);
    }

    if (display instanceof HTMLCanvasElement) {
        // Set the display size of the canvas
        display.style.width = `${screenSize.width}px`;
        display.style.height = `${screenSize.height}px`;
        if (fullScreen && height > screenSize.height) {
            display.style.top = `${Math.trunc((height - screenSize.height) / 2)}px`;
        } else {
            display.style.top = `0px`;
        }
        // Check if User Screen is bigger than Simulated Screen
        if (bufferCanvas.width < screenSize.width) {
            screenSize.width = bufferCanvas.width;
            screenSize.height = bufferCanvas.height;
            dpr = 1;
        }
        // Set the "actual" internal size of the canvas
        display.width = Math.trunc(screenSize.width * dpr);
        display.height = Math.trunc(screenSize.height * dpr);
        // Scale the context to ensure correct drawing operations
        ctx?.scale(dpr, dpr);
    }
    if (running) {
        drawBufferImage();
    } else {
        clearDisplay();
    }
    notifyAll("redraw", fullScreen);
}

/**
 * Draws a splash screen image on the display canvas.
 * @param imgBmp Image bitmap to display
 * @param icon Whether this is an icon (defaults to false)
 */
export function drawSplashScreen(imgBmp: ImageBitmap, icon = false) {
    if (bufferCtx) {
        if (display instanceof HTMLCanvasElement) {
            display.style.opacity = "1";
        }
        const dims = getDisplayModeDims();
        let w = dims.width;
        let h = dims.height;
        bufferCanvas.width = w;
        bufferCanvas.height = h;
        if (icon) {
            const x = Math.trunc((w - imgBmp.width) / 2);
            const y = Math.trunc((h - imgBmp.height) / 2);
            bufferCtx.fillStyle = "black";
            bufferCtx.fillRect(0, 0, w, h);
            bufferCtx.drawImage(imgBmp, x, y);
        } else {
            bufferCtx.drawImage(imgBmp, 0, 0, w, h);
        }
        drawBufferImage();
        firstFrame = true;
    }
}

/**
 * Draws an icon as a splash screen.
 * @param imgBmp Image bitmap to display as icon
 */
export function drawIconAsSplash(imgBmp: ImageBitmap) {
    drawSplashScreen(imgBmp, true);
}

/**
 * Gets a screenshot of the current display buffer.
 * @returns ImageData of the display or null if unavailable
 */
export function getScreenshot(): ImageData | null {
    return bufferCtx?.getImageData(0, 0, bufferCanvas.width, bufferCanvas.height) ?? null;
}

/**
 * Updates the display buffer with new image data.
 * @param buffer ImageData to render on the display
 */
export function updateBuffer(buffer: ImageData) {
    if (bufferCtx) {
        if (bufferCanvas.width !== buffer.width || bufferCanvas.height !== buffer.height) {
            notifyAll("resolution", { width: buffer.width, height: buffer.height });
            bufferCanvas.width = buffer.width;
            bufferCanvas.height = buffer.height;
        }
        bufferCtx.putImageData(buffer, 0, 0);
        createImageBitmap(buffer).then((bitmap) => {
            lastImage = bitmap;
        });
        if (!videoLoop) {
            clearDisplay();
            lastFrameReq = globalThis.requestAnimationFrame(drawBufferImage);
        }
        firstFrame = false;
    }
}

/**
 * Draws the buffer image to the display canvas.
 * Applies overscan settings and updates performance statistics.
 */
function drawBufferImage() {
    if (ctx) {
        statsUpdate(false);
        if (displayState) {
            let overscan = 0.04;
            if (overscanMode === "overscan") {
                let x = Math.round(bufferCanvas.width * overscan);
                let y = Math.round(bufferCanvas.height * overscan);
                let w = bufferCanvas.width - x * 2;
                let h = bufferCanvas.height - y * 2;
                ctx.drawImage(bufferCanvas, x, y, w, h, 0, 0, screenSize.width, screenSize.height);
            } else {
                ctx.drawImage(bufferCanvas, 0, 0, screenSize.width, screenSize.height);
                if (overscanMode === "guidelines") {
                    let x = Math.round(screenSize.width * overscan);
                    let y = Math.round(screenSize.height * overscan);
                    let w = screenSize.width - x * 2;
                    let h = screenSize.height - y * 2;
                    ctx.strokeStyle = "#D0D0D0FF";
                    ctx.lineWidth = 2;
                    ctx.setLineDash([1, 2]);
                    ctx.strokeRect(x, y, w, h);
                }
            }
        } else {
            clearDisplay();
        }
        statsUpdate(true);
    }
}

/**
 * Draws the current video player frame to the display canvas.
 * Called recursively via requestAnimationFrame during video playback.
 */
function drawVideoFrame() {
    if (!(bufferCtx && player instanceof HTMLVideoElement && ["play", "pause"].includes(videoState))) {
        videoLoop = false;
        return;
    }
    if (firstFrame) {
        // Clear buffer on first frame to avoid artifacts from previous apps
        bufferCtx.clearRect(0, 0, bufferCanvas.width, bufferCanvas.height);
        lastImage = null;
        firstFrame = false;
    }
    videoLoop = true;
    let left = videoRect.x;
    let top = videoRect.y;
    let width = videoRect.w || bufferCanvas.width;
    let height = videoRect.h || bufferCanvas.height;
    if (player.videoHeight > 0) {
        const videoAR = player.videoWidth / player.videoHeight;
        if (Math.trunc(width / videoAR) > height) {
            let nw = Math.trunc(height * videoAR);
            left += (width - nw) / 2;
            width = nw;
        } else {
            let nh = Math.trunc(width / videoAR);
            top += (height - nh) / 2;
            height = nh;
        }
    }
    bufferCtx.fillStyle = "black";
    bufferCtx.fillRect(0, 0, bufferCanvas.width, bufferCanvas.height);
    if (displayState) {
        bufferCtx.drawImage(player as any, left, top, width, height);
        if (lastImage) {
            bufferCtx.drawImage(lastImage, 0, 0);
        }
        if (getCaptionState() && !trickPlayBar) {
            drawSubtitles(bufferCtx);
        }
    }
    drawBufferImage();
    lastFrameReq = globalThis.requestAnimationFrame(drawVideoFrame);
}

/**
 * Draws closed captions/subtitles on the display canvas.
 * Applies caption styling and caches text measurements for performance.
 * @param ctx Canvas 2D rendering context
 */
function drawSubtitles(ctx: CanvasRenderingContext2D) {
    if (!deviceData.captionStyle) {
        deviceData.captionStyle = [];
    }
    // Draw active subtitles
    const fhd = ctx.canvas.height === 1080 ? 1 : 0;
    const backgroundColor = getCaptionStyleOption("background/color", "black");
    const backColor = CaptionColors.get(backgroundColor === "default" ? "black" : backgroundColor);
    const backgroundOpacity = getCaptionStyleOption("background/opacity");
    const backOpacity = CaptionOpacities.get(backgroundOpacity) ?? 1;
    const textFont = getCaptionStyleOption("text/font");
    const fontFamily = CaptionFonts.get(textFont) ?? "cc-serif";
    const textColor = CaptionColors.get(getCaptionStyleOption("text/color"));
    const textOpacity = CaptionOpacities.get(getCaptionStyleOption("text/opacity")) ?? 1;
    const textSize = getCaptionStyleOption("text/size");
    const textEffect = getCaptionStyleOption("text/effect");
    const fontSize = CaptionSizes.get(textSize)![fhd];
    ctx.font = `${fontSize}px ${fontFamily}, sans-serif`;

    if (lastCachedFontSize !== fontSize || lastCachedFontFamily !== fontFamily) {
        resetSubtitleCache(fontSize, fontFamily);
    }

    ctx.fillStyle = textColor!;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const baseX = ctx.canvas.width / 2;
    const lineHeight = fontSize * 1.2;
    let y = ctx.canvas.height * 0.9 - lineHeight / 2;

    for (const track of player.textTracks) {
        if (track.mode !== "showing" || !track.activeCues?.length) {
            continue;
        }
        for (const cue of track.activeCues) {
            // Safely access cue.text if it exists (VTTCue/WebKitTextTrackCue)
            const cueText = (cue as any)?.text ?? "";
            if (!cueText) {
                continue;
            }
            // Split cueText into lines by line breaks
            const lines = cueText.split(/\r?\n/);
            let currentLineY = y;

            for (let k = lines.length - 1; k >= 0; k--) {
                const currentLineText = lines[k];
                const cacheKey = `${currentLineText}:${fontSize}:${fontFamily}`;
                let lineMetricsWidth: number;
                let lineCalculatedBoxWidth: number;
                const padding = fontSize * 0.4;

                const cachedMeasurement = subtitleMeasurementCache.get(cacheKey);
                if (cachedMeasurement) {
                    lineMetricsWidth = cachedMeasurement.metricsWidth;
                    lineCalculatedBoxWidth = cachedMeasurement.calculatedBoxWidth;
                } else {
                    notifyAll("debug", `[display] caching subtitle measurement: ${cacheKey}`);
                    const metrics = ctx.measureText(currentLineText);
                    lineMetricsWidth = metrics.width;
                    lineCalculatedBoxWidth = lineMetricsWidth + padding * 2;
                    subtitleMeasurementCache.set(cacheKey, {
                        metricsWidth: lineMetricsWidth,
                        calculatedBoxWidth: lineCalculatedBoxWidth,
                    });
                }

                // Draw background box behind the text
                const boxWidth = lineCalculatedBoxWidth;
                const boxHeight = lineHeight;

                // Calculate rounded coordinates and dimensions for the background box
                const boxLeft = Math.round(baseX - boxWidth / 2);
                const boxRight = Math.round(baseX + boxWidth / 2);
                const finalBoxWidth = boxRight - boxLeft;

                const lineBoxBottomY = Math.round(currentLineY + boxHeight / 2);
                const lineBoxTopY = Math.round(currentLineY - boxHeight / 2);
                const finalBoxHeight = lineBoxBottomY - lineBoxTopY;

                ctx.save();
                ctx.globalAlpha = backOpacity;
                ctx.fillStyle = backColor!;
                ctx.fillRect(boxLeft, lineBoxTopY, finalBoxWidth, finalBoxHeight);
                ctx.restore();

                const textDrawX = Math.round(baseX);
                const textDrawY = Math.round(currentLineY);
                drawText(ctx, currentLineText, textDrawX, textDrawY, textOpacity, textEffect);
                currentLineY -= lineHeight;
            }
        }
    }
}

/**
 * Draws text with specified effects (raised, depressed, uniform, drop shadow).
 * @param ctx Canvas 2D rendering context
 * @param text Text string to draw
 * @param x X coordinate
 * @param y Y coordinate
 * @param opacity Text opacity (0-1)
 * @param effect Text effect style name
 */
function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, opacity: number, effect: string) {
    ctx.save();
    ctx.globalAlpha = opacity;
    // Apply text effect for stroke/shadow
    if (effect === "raised") {
        ctx.strokeStyle = "gray";
        ctx.lineWidth = 1;
        ctx.strokeText(text, x - 1, y - 1);
    } else if (effect === "depressed") {
        ctx.strokeStyle = "gray";
        ctx.lineWidth = 1;
        ctx.strokeText(text, x + 1, y + 1);
    } else if (effect === "uniform") {
        ctx.strokeStyle = "black";
        ctx.lineWidth = 4;
        ctx.strokeText(text, x, y);
    } else if (effect === "drop shadow (left)") {
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.strokeText(text, x - 2, y + 2);
    } else if (effect === "drop shadow (right)") {
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.strokeText(text, x + 2, y + 2);
    }
    // Draw the subtitle text
    ctx.fillText(text, x, y);
    ctx.restore();
}

/**
 * Loads closed caption fonts from the Common FS assets.
 * @param assets ArrayBuffer containing the zipped font assets
 */
export async function loadCaptionsFonts(assets: ArrayBufferLike) {
    if (!assets.byteLength) {
        notifyAll("warning", "[display] Common FS not available, captions fonts will not be loaded.");
        return;
    }
    try {
        const fontsFile = "fonts/default-fonts.json";
        const commonZip = unzipSync(new Uint8Array(assets));
        const jsonFonts = commonZip[fontsFile];
        if (!(jsonFonts instanceof Uint8Array)) {
            notifyAll("warning", `[display] No '${fontsFile}' found in Common FS.`);
            return;
        }
        const ccFonts = JSON.parse(strFromU8(jsonFonts));
        const fonts = ccFonts.closedCaptions!;
        for (const fontName in fonts) {
            const fontData = commonZip[`fonts/${fonts[fontName]}`];
            if (fontData instanceof Uint8Array) {
                const fontBlob = new Blob([fontData as Uint8Array<ArrayBuffer>], { type: "font/ttf" });
                const fontUrl = URL.createObjectURL(fontBlob);
                const fontFace = new FontFace(fontName, `url(${fontUrl})`);
                await fontFace.load();
                document.fonts.add(fontFace);
                notifyAll("debug", `[display] Closed Caption font ${fontName} loaded successfully.`);
            } else {
                notifyAll("warning", `[display] Invalid font data for ${fontName}`);
            }
        }
    } catch (e: any) {
        notifyAll("error", `[display] Error loading caption fonts from Common FS: ${e.message}`);
    }
}

/**
 * Resets the subtitle measurement cache.
 * Called when font size or family changes.
 * @param fontSize Optional new font size to cache
 * @param fontFamily Optional new font family to cache
 */
function resetSubtitleCache(fontSize?: number, fontFamily?: string) {
    subtitleMeasurementCache.clear();
    lastCachedFontSize = fontSize;
    lastCachedFontFamily = fontFamily;
}

/**
 * Marks the beginning or end of the frame to measure performance statistics.
 * @param start True to mark the beginning of the frame, false to mark the end
 */
export function statsUpdate(start: boolean) {
    if (showStats && statsCanvas) {
        if (start) {
            statsCanvas.begin();
        } else {
            statsCanvas.end();
        }
    }
}

/**
 * Shows the display canvas and sets focus to it.
 */
export function showDisplay() {
    if (display instanceof HTMLCanvasElement) {
        displayState = true;
        display.style.opacity = "1";
        display.focus();
        if (statsDiv && statsDiv.style.opacity !== "0") {
            showStats = true;
        }
        notifyAll("resolution", getDisplayModeDims());
    }
}

/**
 * Clears the display canvas and optionally cancels animation frames.
 * @param cancelFrame Whether to cancel pending animation frames
 */
export function clearDisplay(cancelFrame?: boolean) {
    if (cancelFrame) {
        globalThis.cancelAnimationFrame(lastFrameReq);
        videoLoop = false;
    }
    if (ctx && Platform.inSafari) {
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    } else if (ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
}

/**
 * Sets the display mode (480p, 720p, or 1080p).
 * Updates aspect ratio and screen size accordingly.
 * @param mode Display mode to set
 */
export function setDisplayMode(mode: DisplayMode) {
    if (!DisplayModes.includes(mode)) {
        notifyAll("warning", `[display] Invalid Display Mode: ${mode}`);
        return;
    }
    deviceData.displayMode = mode;
    aspectRatio = mode === "480p" ? 4 / 3 : 16 / 9;
    notifyAll("mode", mode);
}

/**
 * Gets the current display mode.
 * @returns Current DisplayMode
 */
export function getDisplayMode() {
    return deviceData.displayMode;
}

/**
 * Sets whether the display is enabled or disabled.
 * @param enabled True to enable display, false to disable
 */
export function setDisplayState(enabled: boolean) {
    displayState = enabled;
}

/**
 * Sets the overscan mode.
 * @param mode Overscan mode string
 */
export function setOverscanMode(mode: string) {
    overscanMode = mode;
}

/**
 * Gets the current overscan mode.
 * @returns Current overscan mode string
 */
export function getOverscanMode() {
    return overscanMode;
}

/**
 * Sets the closed caption mode.
 * @param mode Caption mode string to parse and set
 * @returns True if mode was valid and set, false otherwise
 */
export function setCaptionMode(mode: string): boolean {
    const newMode = parseCaptionMode(mode);
    if (!newMode) {
        notifyAll("warning", `[display] Invalid Closed Caption mode: ${mode}`);
        return false;
    } else if (newMode === deviceData.captionMode) {
        // No change
        return false;
    }
    deviceData.captionMode = newMode;
    return true;
}

/**
 * Gets the current closed caption mode.
 * @returns Current caption mode
 */
export function getCaptionMode() {
    return deviceData.captionMode;
}

/**
 * Determines if captions should be displayed based on caption mode and mute state.
 * @returns True if captions should be shown
 */
function getCaptionState(): boolean {
    const mode = deviceData.captionMode;
    return supportCaptions && (mode === "On" || (mode === "When mute" && isVideoMuted()));
}

/**
 * Sets whether the trick play bar is visible.
 * @param enabled True to show trick play bar
 */
export function setTrickPlayBar(enabled: boolean) {
    trickPlayBar = enabled;
}

/**
 * Sets whether the app supports closed captions.
 * @param support True if captions are supported
 */
export function setSupportCaptions(support: boolean) {
    supportCaptions = support;
}

/**
 * Sets the closed caption style options.
 * @param style Optional array of CaptionStyleOption
 */
export function setCaptionStyle(style?: CaptionStyleOption[]) {
    const captionStyle = deviceData.captionStyle;
    for (const [key, option] of CaptionOptions) {
        if (!key.includes("/")) {
            continue;
        }
        const entry = style?.find((entry) => entry.id.toLowerCase() === key);
        if (entry instanceof Object) {
            setCaptionStyleOption(captionStyle, key, entry.style);
            continue;
        }
        captionStyle.push({ id: key, style: option[0] });
    }
}

/**
 * Sets the application-specific caption style.
 * @param style Array of CaptionStyleOption from the app
 */
export function setAppCaptionStyle(style: CaptionStyleOption[]) {
    appCaptionStyle.length = 0;
    for (const [key] of CaptionOptions) {
        if (!key.includes("/")) {
            continue;
        }
        const entry = style?.find((entry) => entry.id.toLowerCase() === key);
        if (entry instanceof Object) {
            setCaptionStyleOption(appCaptionStyle, key, entry.style);
        }
    }
}

/**
 * Gets a caption style option, merging device and app settings.
 * @param id Style option identifier
 * @param defaultStyle Default style value if not found
 * @returns Resolved style value
 */
function getCaptionStyleOption(id: string, defaultStyle: string = "default"): string {
    const deviceOption = deviceData.captionStyle.find((option) => option.id.toLowerCase() === id.toLowerCase());
    const deviceStyle = deviceOption?.style?.toLowerCase() ?? defaultStyle;
    const appOption = appCaptionStyle.find((option) => option.id.toLowerCase() === id.toLowerCase());
    return deviceStyle === "default" ? appOption?.style?.toLowerCase() ?? defaultStyle : deviceStyle;
}

/**
 * Sets a caption style option in the provided array.
 * @param captionStyle Array of caption style options to modify
 * @param id Style option identifier
 * @param style Style value to set
 * @returns True if value was changed
 */
function setCaptionStyleOption(captionStyle: CaptionStyleOption[], id: string, style: string): boolean {
    const index = captionStyle.findIndex((caption) => caption.id.toLowerCase() === id.toLowerCase());
    if (index >= 0) {
        captionStyle[index].id = id.toLowerCase();
        if (captionStyle[index].style === style) {
            notifyAll("debug", `[display] caption style option unchanged: ${id} = ${style}`);
            return false;
        }
        captionStyle[index].style = style;
        notifyAll("debug", `[display] caption style option changed: ${id} = ${style}`);
        return true;
    } else {
        captionStyle.push({ id: id.toLowerCase(), style: style.toLowerCase() });
        notifyAll("debug", `[display] caption style option added: ${id} = ${style}`);
        return true;
    }
}

/**
 * Enables or disables performance statistics display.
 * @param show True to show statistics, false to hide
 * @returns Whether statistics are now shown
 */
export function enableStats(show: boolean): boolean {
    if (statsCanvas?.dom) {
        showStats = show;
        if (showStats) {
            statsDiv.style.opacity = "0.5";
        } else {
            statsCanvas.dom.remove();
            statsCanvas = null;
        }
    } else if (show) {
        statsDiv = document.getElementById("stats") as HTMLDivElement;
        if (statsDiv instanceof HTMLDivElement && display instanceof HTMLCanvasElement) {
            const top = display.style.top;
            const left = display.style.left;
            statsCanvas = new Stats();
            statsCanvas.dom.style.cssText = `position:absolute;top:${top}px;left:${left}px;`;
            const statPanels = statsCanvas.dom.children.length;
            const newDom = statsCanvas.dom.cloneNode() as HTMLDivElement;
            for (let index = 0; index < statPanels; index++) {
                const panel = statsCanvas.dom.children[0] as HTMLCanvasElement;
                const panLeft = index * panel.width;
                panel.style.cssText = `position:absolute;top:${top}px;left:${panLeft}px;`;
                newDom.appendChild(panel);
            }
            statsCanvas.dom = newDom;
            statsCanvas.dom.addEventListener(
                "click",
                function (event) {
                    event.preventDefault();
                    showStats = !showStats;
                    statsDiv.style.opacity = showStats ? "0.5" : "0";
                },
                false
            );
            statsDiv.appendChild(statsCanvas.dom);
            showStats = true;
        } else {
            notifyAll("warning", "[display] Missing 'Stats' div, can't display Performance Stats!");
            showStats = false;
        }
    }
    return showStats;
}

/**
 * Gets the dimensions for the current display mode.
 * @returns Object with width and height for current display mode
 */
function getDisplayModeDims() {
    let w = 1280;
    let h = 720;
    if (deviceData.displayMode === "480p") {
        w = 720;
        h = 540;
    } else if (deviceData.displayMode === "1080p") {
        w = 1920;
        h = 1080;
    }
    return { width: w, height: h };
}
