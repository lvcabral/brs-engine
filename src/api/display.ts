/*---------------------------------------------------------------------------------------------
 *  BrightScript Emulator (https://github.com/lvcabral/brs-emu)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SubscribeCallback } from "./util";
import Stats from "stats.js";

// Emulator Display
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
export function initDisplayModule(mode: string, lowRes: boolean, perfStats: boolean) {
    // Initialize Display Canvas
    if (typeof OffscreenCanvas !== undefined) {
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
        console.warn(
            `Your browser does not support OffscreenCanvas, so the emulator will not work properly, ` +
                `to know more visit https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas`
        );
    }
    displayMode = mode;
    // Display Aspect Ratio
    if (lowRes) {
        const isSD = displayMode === "480p";
        aspectRatio = isSD ? 4 / 3 : 16 / 9;
        screenSize.width = isSD ? 640 : 854;
        screenSize.height = 480;
    } else {
        if (displayMode === "1080p") {
            screenSize.width = 1920;
            screenSize.height = 1080;
            aspectRatio = 16 / 9;
        } else if (displayMode === "480p") {
            screenSize.width = 720;
            screenSize.height = 480;
            aspectRatio = 4 / 3;
        } else {
            screenSize.width = 1280;
            screenSize.height = 720;
            aspectRatio = 16 / 9;
        }
    }
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
export function redrawDisplay(running: boolean, fullScreen: boolean) {
    notifyAll("redraw", fullScreen);
    screenSize.width = window.innerWidth;
    screenSize.height = Math.trunc(screenSize.width / aspectRatio);
    if (screenSize.height > window.innerHeight) {
        screenSize.height = window.innerHeight;
        screenSize.width = Math.trunc(screenSize.height * aspectRatio);
    }

    if (display instanceof HTMLCanvasElement) {
        // Get the DPR and size of the canvas
        const dpr = window.devicePixelRatio;

        // Set the "actual" size of the canvas
        display.width = screenSize.width * dpr;
        display.height = screenSize.height * dpr;
        // Scale the context to ensure correct drawing operations
        if (ctx) {
            ctx.scale(dpr, dpr);
        }
        display.style.width = `${screenSize.width}px`;
        display.style.height = `${screenSize.height}px`;
        if (fullScreen && window.innerHeight > screenSize.height) {
            display.style.top = `${Math.trunc((window.innerHeight - screenSize.height) / 2)}px`;
        } else {
            display.style.top = `0px`;
        }
    } else {
        display.width = screenSize.width;
        display.height = screenSize.height;
    }
    if (running) {
        drawBufferImage();
    } else {
        clearDisplay();
    }
}

// Draw Channel Splash
export function drawSplashScreen(imgData: CanvasImageSource) {
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

// Draw Buffer Image to the Display Canvas
export function drawBufferImage(buffer?: any) {
    if (ctx) {
        if (showStats) {
            statsCanvas.end();
        }
        if (buffer) {
            if (bufferCanvas.width !== buffer.width || bufferCanvas.height !== buffer.height) {
                notifyAll("resolution", { width: buffer.width, height: buffer.height });
                bufferCanvas.width = buffer.width;
                bufferCanvas.height = buffer.height;
            }
            if (bufferCtx) {
                bufferCtx.putImageData(buffer, 0, 0);
            }
        }
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
        if (showStats) {
            statsCanvas.begin();
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
    if (statsCanvas && statsCanvas.dom) {
        showStats = show;
        console.log("show no create");
    } else if (show) {
        statsDiv = document.getElementById("stats") as HTMLDivElement;
        if (statsDiv instanceof HTMLDivElement && display instanceof HTMLCanvasElement) {
            console.log("show and create");
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
            console.warn("[brsEmu] Missing 'Stats' div, can't display Peformance Stats!");
        }
    }
    return showStats;
}
