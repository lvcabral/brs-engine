/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu)
 *
 *  Copyright (c) 2019-2021 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// Keyboard Mapping
const preventDefault = new Set(["Enter", "Space", "ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"]);
const keys = new Map();
keys.set("Backspace", "back");
keys.set("Delete", "backspace");
keys.set("Enter", "select");
keys.set("Escape", "home");
keys.set("Space", "play");
keys.set("ArrowLeft", "left");
keys.set("ArrowUp", "up")
keys.set("ArrowRight", "right");
keys.set("ArrowDown", "down");
keys.set("Slash", "instantreplay");
keys.set("NumpadMultiply", "info");
keys.set("Digit8", "info");
keys.set("Comma", "rev");
keys.set("Period", "fwd");
keys.set("KeyA", "a");
keys.set("KeyZ", "b");
// Control array
let sharedArray;
let dataType;
// Initialize Control Module
export function initControlModule(array, types) {
    sharedArray = array;
    dataType = types;
}
// Observers Handling
const observers = new Map();
export function subscribeControl(observerId, observerCallback) {
    observers.set(observerId, observerCallback);
}
export function unsubscribeControl(observerId) {
    observers.delete(observerId);
}
function notifyAll(eventName, eventData) {
    observers.forEach((callback, id) => {
        callback(eventName, eventData);
    });
}
// Keyboard handlers
document.addEventListener("keydown", function (event) {    
    if (keys.has(event.code)) {
        handleKey(keys.get(event.code), 0);
        if (preventDefault.has(event.code)) {
            event.preventDefault();
        }    
    }   
});
document.addEventListener("keyup", function keyUpHandler(event) {
    if (keys.has(event.code)) {
        handleKey(keys.get(event.code), 100);
    }
});
// Keyboard Handler
export function handleKey(key, mod) {
    sharedArray[dataType.MOD] = mod;
    if (key.toLowerCase() == "back") {
        sharedArray[dataType.KEY] = 0 + mod;
    } else if (key.toLowerCase() == "select") {
        sharedArray[dataType.KEY] = 6 + mod;
    } else if (key.toLowerCase() == "left") {
        sharedArray[dataType.KEY] = 4 + mod;
    } else if (key.toLowerCase() == "right") {
        sharedArray[dataType.KEY] = 5 + mod;
    } else if (key.toLowerCase() == "up") {
        sharedArray[dataType.KEY] = 2 + mod;
    } else if (key.toLowerCase() == "down") {
        sharedArray[dataType.KEY] = 3 + mod;
    } else if (key.toLowerCase() == "instantreplay") {
        sharedArray[dataType.KEY] = 7 + mod;
    } else if (key.toLowerCase() == "info") {
        sharedArray[dataType.KEY] = 10 + mod;
    } else if (key.toLowerCase() == "backspace") {
        sharedArray[dataType.KEY] = 11 + mod;
    } else if (key.toLowerCase() == "enter") {
        sharedArray[dataType.KEY] = 15 + mod;
    } else if (key.toLowerCase() == "rev") {
        sharedArray[dataType.KEY] = 8 + mod;
    } else if (key.toLowerCase() == "fwd") {
        sharedArray[dataType.KEY] = 9 + mod;
    } else if (key.toLowerCase() == "play") {
        sharedArray[dataType.KEY] = 13 + mod;
    } else if (key.toLowerCase() == "playonly") {
        sharedArray[dataType.KEY] = 22 + mod;
    } else if (key.toLowerCase() == "stop") {
        sharedArray[dataType.KEY] = 23 + mod;
    } else if (key.toLowerCase() == "a") {
        sharedArray[dataType.KEY] = 17 + mod;
    } else if (key.toLowerCase() == "b") {
        sharedArray[dataType.KEY] = 18 + mod;
    } else if (key.toLowerCase() == "home" && mod == 0) {
        notifyAll("home");
    } else if (key.substr(0,4).toLowerCase() === "lit_") {
        if (key.substr(4).length == 1 && key.charCodeAt(4) >= 32 && key.charCodeAt(4) < 255) {
            sharedArray[dataType.KEY] = key.charCodeAt(4) + mod; 
        }
    }
}