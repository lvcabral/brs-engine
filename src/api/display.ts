/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ExtraSize, SubscribeCallback } from "./util";
import Stats from "stats.js";

// Emulator Display
const screenSize = { width: 1280, height: 720 };
let display: HTMLCanvasElement | OffscreenCanvas;
let ctx: CanvasRenderingContext2D | null;
let bufferCanvas: OffscreenCanvas;
let bufferCtx: CanvasRenderingContext2D | null;

// Performance Variables
const statsDiv = document.getElementById("stats") as HTMLDivElement;
const statsCanvas = new Stats();
let showStats = false;
let calcFps = false;
let lastTime = 0;
let frames = 0;
let fpsSum = 0;
let fpsAvg = 0;

// Initialize Display Module
export let displayMode = "720p";
export let overscanMode = "disabled";
let aspectRatio = 16 / 9;
export function initDisplayModule(mode: string, lowRes: boolean) {
    // Initialize Display Canvas
    if (typeof OffscreenCanvas !== undefined) {
        display =
            (document.getElementById("display") as HTMLCanvasElement) ||
            new OffscreenCanvas(screenSize.width, screenSize.height);
        if (display) {
            ctx = display.getContext("2d", { alpha: false });
        }
        bufferCanvas = new OffscreenCanvas(screenSize.width, screenSize.height);
        if (bufferCanvas) {
            bufferCtx = bufferCanvas.getContext("2d") as CanvasRenderingContext2D | null;
        }
        if (statsDiv) {
            statsCanvas.dom.style.top = display.style.top;
            statsCanvas.dom.style.left = display.style.left;
            const statPanels = statsCanvas.dom.children.length;
            const newDom = statsCanvas.dom.cloneNode() as HTMLDivElement;
            console.log(statPanels);
            for (let index = 0; index < statPanels; index++) {
                const panel = statsCanvas.dom.children[0] as HTMLCanvasElement;
                panel.style.cssText = `position:absolute;top:${display.style.top}px;left:${index * 160}px`;
                console.log(index,panel);
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
        }
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
export function redrawDisplay(running: boolean, fullScreen: boolean, extraSize: ExtraSize) {
    notifyAll("redraw", fullScreen);
    if (fullScreen) {
        screenSize.width = window.innerWidth;
        screenSize.height = Math.trunc(screenSize.width / aspectRatio);
        if (screenSize.height > window.innerHeight) {
            screenSize.height = window.innerHeight;
            screenSize.width = Math.trunc(screenSize.height * aspectRatio);
        }
    } else {
        // TODO: use extraSize.width
        screenSize.width = window.innerWidth;
        screenSize.height = Math.trunc(screenSize.width / aspectRatio);
        if (screenSize.height > window.innerHeight - extraSize.height) {
            screenSize.height = window.innerHeight - extraSize.height;
            screenSize.width = Math.trunc(screenSize.height * aspectRatio);
        }
    }
    display.width = screenSize.width;
    display.height = screenSize.height;
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
        if (calcFps) {
            const now = performance.now();
            const fps = 1000 / (now - lastTime);
            lastTime = now;
            frames++;
            fpsSum += fps;
            if (frames === 15) {
                fpsAvg = fpsSum / frames;
                frames = 0;
                fpsSum = 0;
            }
            notifyAll("fps", fpsAvg);
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

// Set flag to calculate Frames per Second on Screen
export function setCalcFps(state: boolean) {
    calcFps = state;
}
