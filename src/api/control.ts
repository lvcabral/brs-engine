/*---------------------------------------------------------------------------------------------
 *  BrightScript 2D API Emulator (https://github.com/lvcabral/brs-emu)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { dataType, subscribeCallback } from "./util";

// Keyboard Mapping
const preventDefault: Set<string> = new Set([
    "Enter",
    "Space",
    "ArrowLeft",
    "ArrowUp",
    "ArrowRight",
    "ArrowDown",
    "Home",
    "End",
    "PageUp",
    "PageDown",
    "Backspace",
    "Escape",
]);

const keysMap: Map<string, string> = new Map();
keysMap.set("ArrowUp", "up");
keysMap.set("ArrowDown", "down");
keysMap.set("ArrowLeft", "left");
keysMap.set("ArrowRight", "right");
keysMap.set("Enter", "select");
keysMap.set("Escape", "back");
keysMap.set("Delete", "back");
keysMap.set("Home", "home");
keysMap.set("Shift+Escape", "home");
keysMap.set("Ctrl+Escape", "home");
keysMap.set("Backspace", "instantreplay");
keysMap.set("Ctrl+Backspace", "backspace");
keysMap.set("Ctrl+Enter", "play");
keysMap.set("End", "play");
keysMap.set("Ctrl+Enter", "select");
keysMap.set("PageDown", "rev");
keysMap.set("Ctrl+ArrowLeft", "rev");
keysMap.set("PageUp", "fwd");
keysMap.set("Ctrl+ArrowRight", "fwd");
keysMap.set("NumpadMultiply", "info");
keysMap.set("Insert", "info");
keysMap.set("Ctrl+Digit8", "info");
keysMap.set("KeyA", "a");
keysMap.set("KeyZ", "b");

const rokuKeys: Map<string, number> = new Map();
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
let sharedArray: Int32Array;

export function initControlModule(
    array: Int32Array,
    disableKeys?: boolean,
    customKeys?: Map<string, string>
) {
    sharedArray = array;
    if (!disableKeys) {
        if (customKeys instanceof Map) {
            customKeys.forEach(function (value: string, key: string) {
                keysMap.set(key, value);
            });
        }
        // Keyboard handlers
        document.addEventListener("keydown", function (event: KeyboardEvent) {
            handleKeyboardEvent(event, 0);
        });
        document.addEventListener("keyup", function keyUpHandler(event: KeyboardEvent) {
            handleKeyboardEvent(event, 100);
        });
    }
}

function handleKeyboardEvent(event: KeyboardEvent, mod: number) {
    let keyCode: string = event.code;
    if (event.shiftKey) {
        keyCode = "Shift+" + keyCode;
    } else if (event.ctrlKey) {
        keyCode = "Ctrl+" + keyCode;
    } else if (event.altKey) {
        keyCode = "Alt+" + keyCode;
    } else if (event.metaKey) {
        keyCode = "Win+" + keyCode;
    }
    const key = keysMap.get(keyCode);
    if (key && key.toLowerCase() !== "ignore") {
        sendKey(key, mod);
        if (mod == 0 && preventDefault.has(event.code)) {
            event.preventDefault();
        }
    }
}

// Observers Handling
const observers = new Map();
export function subscribeControl(observerId: string, observerCallback: subscribeCallback) {
    observers.set(observerId, observerCallback);
}
export function unsubscribeControl(observerId: string) {
    observers.delete(observerId);
}
function notifyAll(eventName: string, eventData?: any) {
    observers.forEach((callback, id) => {
        callback(eventName, eventData);
    });
}

// Keyboard Handler
export function sendKey(key: string, mod: number) {
    key = key.toLowerCase();
    if (key == "home" && mod == 0) {
        notifyAll(key);
    } else if (rokuKeys.has(key)) {
        const code = rokuKeys.get(key);
        if (typeof code !== "undefined") {
            Atomics.store(sharedArray, dataType.MOD, mod);
            Atomics.store(sharedArray, dataType.KEY, code + mod);
        }
    } else if (key.slice(0, 4).toLowerCase() === "lit_") {
        if (key.slice(4).length == 1 && key.charCodeAt(4) >= 32 && key.charCodeAt(4) < 255) {
            Atomics.store(sharedArray, dataType.MOD, mod);
            Atomics.store(sharedArray, dataType.KEY, key.charCodeAt(4) + mod);
        }
    }
}
