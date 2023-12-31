/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SubscribeCallback } from "./util";
import Stats from "stats.js";

// Simulation Display
const screenSize = { width: 1280, height: 720 };
let display: HTMLCanvasElement | OffscreenCanvas;
let ctx: CanvasRenderingContext2D | null;
let bufferCanvas: OffscreenCanvas;
let bufferCtx: CanvasRenderingContext2D | null;

// Performance Stats Variables
let statsDiv: HTMLDivElement;
let statsCanvas: Stats;
let showStats = false;

// Initialize Display Module
export let displayMode = "720p";
export let overscanMode = "disabled";
let aspectRatio = 16 / 9;
export function initDisplayModule(mode: string, perfStats = false) {
    // Initialize Display Canvas
    if (typeof OffscreenCanvas !== "undefined") {
        display =
            (document.getElementById("display") as HTMLCanvasElement) ||
            new OffscreenCanvas(screenSize.width, screenSize.height);
        ctx = display.getContext("2d", { alpha: false });
        bufferCanvas = new OffscreenCanvas(screenSize.width, screenSize.height);
        bufferCtx = bufferCanvas.getContext("2d", {
            alpha: false,
        }) as CanvasRenderingContext2D | null;
        // Performance Statistics
        showPerfStats(perfStats);
    } else {
        notifyAll(
            "warning",
            `[display] Your browser does not support OffscreenCanvas, so the engine will not work properly, ` +
                `to know more visit https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas`
        );
    }
    // Display Dimensions and Aspect Ratio
    displayMode = mode;
    aspectRatio = displayMode === "480p" ? 4 / 3 : 16 / 9;
    screenSize.height = display.height;
    screenSize.width = Math.trunc(screenSize.height * aspectRatio);
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
    observers.forEach((callback, id) => {
        callback(eventName, eventData);
    });
}

// Redraw Display Canvas
export function redrawDisplay(
    running: boolean,
    fullScreen: boolean,
    width?: number,
    height?: number,
    dpr?: number
) {
    if (!width) {
        width = window.innerWidth;
    }
    if (!height) {
        height = window.innerHeight;
    }
    if (!dpr) {
        dpr = window.devicePixelRatio;
    }
    screenSize.width = width;
    screenSize.height = Math.trunc(screenSize.width / aspectRatio);
    if (screenSize.height > height) {
        screenSize.height = height;
        screenSize.width = Math.trunc(screenSize.height * aspectRatio);
    }

    if (display instanceof HTMLCanvasElement) {
        // Set the "actual" size of the canvas
        display.width = screenSize.width * dpr;
        display.height = screenSize.height * dpr;
        // Scale the context to ensure correct drawing operations
        if (ctx) {
            ctx.scale(dpr, dpr);
        }
        display.style.width = `${screenSize.width}px`;
        display.style.height = `${screenSize.height}px`;
        if (fullScreen && height > screenSize.height) {
            display.style.top = `${Math.trunc((height - screenSize.height) / 2)}px`;
        } else {
            display.style.top = `0px`;
        }
    } else {
        display.width = screenSize.width;
        display.height = screenSize.height;
    }
    if (running) {
        window.requestAnimationFrame(drawBufferImage);
    } else {
        clearDisplay();
    }
    notifyAll("redraw", fullScreen);
}

// Draw App Splash
export function drawSplashScreen(imgData: ImageBitmap) {
    if (ctx) {
        if (display instanceof HTMLCanvasElement) {
            display.style.opacity = "1";
        }
        ctx.drawImage(imgData, 0, 0, screenSize.width, screenSize.height);
        let buffer = ctx.getImageData(0, 0, screenSize.width, screenSize.height);
        bufferCanvas.width = buffer.width;
        bufferCanvas.height = buffer.height;
        if (bufferCtx) {
            bufferCtx.putImageData(buffer, 0, 0);
        }
    }
}

export function drawIconAsSplash(imgData: ImageBitmap) {
    if (bufferCtx) {
        if (display instanceof HTMLCanvasElement) {
            display.style.opacity = "1";
        }
        let w = 1280;
        let h = 720;
        if (displayMode === "480p") {
            w = 720;
            h = 540;
        } else if (displayMode === "1080p") {
            w = 1920;
            h = 1080;
        }
        bufferCanvas.width = w;
        bufferCanvas.height = h;
        const x = Math.trunc((w - imgData.width) / 2);
        const y = Math.trunc((h - imgData.height) / 2);
        bufferCtx.clearRect(0, 0, w, h);
        bufferCtx.drawImage(imgData, x, y);
        bufferCtx.textAlign = "center";
        bufferCtx.fillStyle = "white";
        bufferCtx.font = "30px sans-serif";
        bufferCtx.fillText("Loading...", w / 2, y + imgData.height + 45);
        window.requestAnimationFrame(drawBufferImage);
    }
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
        window.requestAnimationFrame(drawBufferImage);
    }
}

// Draw Buffer Image to the Display Canvas
let previousTimeStamp = 0;
function drawBufferImage(timeStamp: number) {
    const elapsed = timeStamp - previousTimeStamp;
    if (ctx && elapsed > 10) {
        statsUpdate(false);
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
        statsUpdate(true);
        previousTimeStamp = timeStamp;
    }
}
function statsUpdate(start: boolean) {
    if (showStats) {
        if (start) {
            statsCanvas.begin();
        } else {
            statsCanvas.end();
        }
    }
}

// Show Display and set focus
export function showDisplay() {
    bufferCanvas.width = 1;
    if (display instanceof HTMLCanvasElement) {
        display.style.opacity = "1";
        display.focus();
        if (statsDiv && statsDiv.style.visibility === "visible") {
            showStats = true;
        }
    }
}

//Clear Display
export function clearDisplay() {
    if (ctx) {
        ctx.clearRect(0, 0, display.width, display.height);
    }
}

// Set Current Display Mode
export function setCurrentMode(mode: string) {
    displayMode = mode;
    aspectRatio = mode === "480p" ? 4 / 3 : 16 / 9;
    notifyAll("mode", mode);
}

// Set Overscan Mode
export function setOverscan(mode: string) {
    overscanMode = mode;
}

export function showPerfStats(show: boolean): boolean {
    if (statsCanvas?.dom) {
        showStats = show;
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
