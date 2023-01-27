/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

// Keyboard Mapping
const preventDefault = new Set([
    "Enter",
    "Space",
    "ArrowLeft",
    "ArrowUp",
    "ArrowRight",
    "ArrowDown",
]);
const keysMap = new Map();
keysMap.set("Backspace", "back");
keysMap.set("ArrowUp", "up");
keysMap.set("ArrowDown", "down");
keysMap.set("ArrowLeft", "left");
keysMap.set("ArrowRight", "right");
keysMap.set("Enter", "select");
keysMap.set("Slash", "instantreplay");
keysMap.set("Comma", "rev");
keysMap.set("Period", "fwd");
keysMap.set("NumpadMultiply", "info");
keysMap.set("Digit8", "info");
keysMap.set("Delete", "backspace");
keysMap.set("Space", "play");
keysMap.set("KeyA", "a");
keysMap.set("KeyZ", "b");
keysMap.set("Escape", "home");

const rokuKeys = new Map();
rokuKeys.set("back", 0);
rokuKeys.set("up", 2);
rokuKeys.set("down", 3);
rokuKeys.set("left", 4);
rokuKeys.set("right", 5);
rokuKeys.set("select", 6);
rokuKeys.set("instantreplay", 7);
rokuKeys.set("rev", 8);
rokuKeys.set("fwd", 9);
rokuKeys.set("info", 10);
rokuKeys.set("backspace", 11);
rokuKeys.set("play", 13);
rokuKeys.set("enter", 15);
rokuKeys.set("a", 17);
rokuKeys.set("b", 18);
rokuKeys.set("stop", 23);

// Initialize Control Module
let sharedArray;
let dataType;
export function initControlModule(array, types, disableKeys, customKeys) {
    sharedArray = array;
    dataType = types;
    if (!disableKeys) {
        if (customKeys instanceof Map) {
            concatMaps(keysMap, customKeys);
        }
        // Keyboard handlers
        document.addEventListener("keydown", function (event) {
            if (keysMap.has(event.code)) {
                handleKey(keysMap.get(event.code), 0);
                if (preventDefault.has(event.code)) {
                    event.preventDefault();
                }
            }
        });
        document.addEventListener("keyup", function keyUpHandler(event) {
            if (keysMap.has(event.code)) {
                handleKey(keysMap.get(event.code), 100);
            }
        });
    }
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
// Keyboard Handler
export function handleKey(key, mod) {
    Atomics.store(sharedArray, dataType.MOD, mod);
    if (key.toLowerCase() == "home" && mod == 0) {
        notifyAll("home");
    } else if (rokuKeys.has(key)) {
        Atomics.store(sharedArray, dataType.KEY, rokuKeys.get(key) + mod);
    } else if (key.slice(0, 4).toLowerCase() === "lit_") {
        if (key.slice(4).length == 1 && key.charCodeAt(4) >= 32 && key.charCodeAt(4) < 255) {
            Atomics.store(sharedArray, dataType.KEY, key.charCodeAt(4) + mod);
        }
    }
}

function concatMaps(map, ...iterables) {
    for (const iterable of iterables) {
        for (const item of iterable) {
            map.set(...item);
        }
    }
}
