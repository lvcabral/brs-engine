/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { player, subscribeVideo } from "./video";
import { SubscribeCallback } from "./util";
import { DeviceInfo, platform, parseCaptionMode, DisplayMode, DisplayModes } from "../core/common";
import Stats from "stats.js";

// Simulation Display
const screenSize = { width: 1280, height: 720 };
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
let videoState = "stop";
let videoRect = { x: 0, y: 0, w: 0, h: 0 };
let videoLoop = false;

// Initialize Display Module
let displayState = true;
let overscanMode = "disabled";
let aspectRatio = 16 / 9;
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
        } else if (["bandwidth", "http.connect", "warning", "error"].includes(event)) {
            return;
        }
        videoState = event;
        if (videoState === "play" && !videoLoop) {
            videoLoop = true;
            lastFrameReq = globalThis.requestAnimationFrame(drawVideoFrame);
        }
    });
}

// Observers Handling
const observers = new Map();
export function subscribeDisplay(observerId: string, observerCallback: SubscribeCallback) {
    observers.set(observerId, observerCallback);
}
export function unsubscribeDisplay(observerId: string) {
    observers.delete(observerId);
}
function notifyAll(eventName: string, eventData?: any) {
    for (const [_id, callback] of observers) {
        callback(eventName, eventData);
    }
}

// Redraw Display Canvas
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

// Draw App Splash
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
            bufferCtx.clearRect(0, 0, w, h);
            bufferCtx.drawImage(imgBmp, x, y);
        } else {
            bufferCtx.drawImage(imgBmp, 0, 0, w, h);
        }
        drawBufferImage();
    }
}

export function drawIconAsSplash(imgBmp: ImageBitmap) {
    drawSplashScreen(imgBmp, true);
}

export function getScreenshot(): ImageData | null {
    return bufferCtx?.getImageData(0, 0, bufferCanvas.width, bufferCanvas.height) ?? null;
}

// Update Buffer Image
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
    }
}

// Draw Buffer Image to the Display Canvas
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

// Draw Video Player frame to the Display Canvas
function drawVideoFrame() {
    if (bufferCtx && player instanceof HTMLVideoElement && ["play", "pause"].includes(videoState)) {
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
        }
        drawBufferImage();
        lastFrameReq = globalThis.requestAnimationFrame(drawVideoFrame);
    } else {
        videoLoop = false;
    }
}

// Update Performance Statistics
export function statsUpdate(start: boolean) {
    if (showStats && statsCanvas) {
        if (start) {
            statsCanvas.begin();
        } else {
            statsCanvas.end();
        }
    }
}

// Show Display and set focus
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

// Clear Display and Buffer
export function clearDisplay(cancelFrame?: boolean) {
    if (cancelFrame) {
        globalThis.cancelAnimationFrame(lastFrameReq);
        videoLoop = false;
    }
    if (ctx && platform.inSafari) {
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    } else if (ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
}

// Set/Get Current Display Mode
export function setDisplayMode(mode: DisplayMode) {
    if (!DisplayModes.includes(mode)) {
        notifyAll("warning", `[display] Invalid Display Mode: ${mode}`);
        return;
    }
    deviceData.displayMode = mode;
    aspectRatio = mode === "480p" ? 4 / 3 : 16 / 9;
    notifyAll("mode", mode);
}

export function getDisplayMode() {
    return deviceData.displayMode;
}

export function setDisplayState(enabled: boolean) {
    displayState = enabled;
}

// Set/Get Overscan Mode
export function setOverscanMode(mode: string) {
    overscanMode = mode;
}

export function getOverscanMode() {
    return overscanMode;
}

// Set/Get Closed Caption Mode
export function setCaptionMode(mode: string) {
    const newMode = parseCaptionMode(mode);
    if (!newMode) {
        notifyAll("warning", `[display] Invalid Closed Caption mode: ${mode}`);
        return;
    }
    deviceData.captionMode = newMode;
}

export function getCaptionMode() {
    return deviceData.captionMode;
}

// Set the Performance Statistics state
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
            const dispTop = display.style.top;
            const dispLeft = display.style.left;
            statsCanvas = new Stats();
            statsCanvas.dom.style.cssText = `position:absolute;top:${dispTop}px;left:${dispLeft}px;`;
            const statPanels = statsCanvas.dom.children.length;
            const newDom = statsCanvas.dom.cloneNode() as HTMLDivElement;
            for (let index = 0; index < statPanels; index++) {
                const panel = statsCanvas.dom.children[0] as HTMLCanvasElement;
                const panLeft = index * panel.width;
                panel.style.cssText = `position:absolute;top:${dispTop}px;left:${panLeft}px;`;
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
