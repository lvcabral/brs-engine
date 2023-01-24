/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// Emulator Display
const display = document.getElementById("display");
const ctx = display.getContext("2d", { alpha: false });
const screenSize = { width: 1280, height: 720 };
const bufferCanvas = new OffscreenCanvas(screenSize.width, screenSize.height);
const bufferCtx = bufferCanvas.getContext("2d");
// Display and Overscan Modes
export let displayMode = "720p";
export let overscanMode = "disabled";
let aspectRatio = 16 / 9;
// Initialize Display Module
export function initDisplayModule(mode, lowRes) {
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
export function subscribeDisplay(observerId, observerCallback) {
    observers.set(observerId, observerCallback);
}
export function unsubscribeDisplay(observerId) {
    observers.delete(observerId);
}
function notifyAll(eventName, eventData) {
    observers.forEach((callback, id) => {
        callback(eventName, eventData);
    });
}
// Redraw Display Canvas
export function redrawDisplay(running, fullScreen) {
    notifyAll("redraw", fullScreen);
    if (fullScreen) {
        screenSize.width = window.innerWidth;
        screenSize.height = parseInt(screenSize.width / aspectRatio);
        if (screenSize.height > window.innerHeight) {
            screenSize.height = window.innerHeight;
            screenSize.width = parseInt(screenSize.height * aspectRatio);
        }
    } else {
        const ratio = 0.98;
        let offset = 25;
        if (display.style.bottom !== "0px") { // TODO: Check if this is  effective
            offset = 30;
        }
        screenSize.width = window.innerWidth * ratio;
        screenSize.height = parseInt(screenSize.width / aspectRatio);
        if (screenSize.height > window.innerHeight * ratio - offset) {
            screenSize.height = window.innerHeight * ratio - offset;
            screenSize.width = parseInt(screenSize.height * aspectRatio);
        }
    }
    display.width = screenSize.width;
    display.style.width = screenSize.width;
    display.height = screenSize.height;
    display.style.height = screenSize.height;
    if (running) {
        drawBufferImage();
    } else {
        clearDisplay();
    }
}
// Draw Channel Splash 
export function drawSplashScreen(imgData) {
    display.style.opacity = 1;
    ctx.drawImage(imgData, 0, 0, screenSize.width, screenSize.height);
    let buffer = ctx.getImageData(0, 0, screenSize.width, screenSize.height);
    bufferCanvas.width = buffer.width;
    bufferCanvas.height = buffer.height;
    bufferCtx.putImageData(buffer, 0, 0);
}
// Draw Buffer Image to the Display Canvas
export function drawBufferImage(buffer) {
    if (buffer) {
        if (bufferCanvas.width !== buffer.width || bufferCanvas.height !== buffer.height) {
            notifyAll("resolution", { width: buffer.width, height: buffer.height });
            bufferCanvas.width = buffer.width;
            bufferCanvas.height = buffer.height;
        }
        bufferCtx.putImageData(buffer, 0, 0);
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
    }
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
// Show Display and set focus
export function showDisplay() {
    bufferCanvas.width = 1;
    display.style.opacity = 1;
    display.focus();
}
//Clear Display
export function clearDisplay() {
    ctx.clearRect(0, 0, display.width, display.height);
}
// Set Current Display Mode
export function setCurrentMode(mode) {
    displayMode = mode;
    aspectRatio = mode === "480p" ? 4 / 3 : 16 / 9;
    notifyAll("mode", mode);
}

// Set Overscan Mode
export function setOverscan(mode) {
    overscanMode = mode;
}

// Toggle Full Screen when Double Click
display.ondblclick = function () {
    notifyAll("dblclick");
};