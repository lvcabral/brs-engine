/*---------------------------------------------------------------------------------------------
 *  BrightScript Emulator (https://github.com/lvcabral/brs-emu)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { DataType, DebugCommand, SubscribeCallback } from "./util";

// Keyboard Mapping
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
keysMap.set("Control+Escape", "home");
keysMap.set("Backspace", "instantreplay");
keysMap.set("Control+Backspace", "backspace");
keysMap.set("Control+Enter", "play");
keysMap.set("End", "play");
keysMap.set("Control+Enter", "select");
keysMap.set("PageDown", "rev");
keysMap.set("Control+ArrowLeft", "rev");
keysMap.set("PageUp", "fwd");
keysMap.set("Control+ArrowRight", "fwd");
keysMap.set("NumpadMultiply", "info");
keysMap.set("Insert", "info");
keysMap.set("Control+Digit8", "info");
keysMap.set("KeyA", "a");
keysMap.set("KeyZ", "b");
keysMap.set("Control+KeyC", "break");

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
rokuKeys.set("break", 204);

// Initialize Control Module
let sharedArray: Int32Array;

export function initControlModule(array: Int32Array, options: any = {}) {
    sharedArray = array;
    if (!options.disableKeys) {
        if (options.customKeys instanceof Map) {
            options.customKeys.forEach(function (value: string, key: string) {
                key = key.replace(/Windows|Command/gi,"Meta");
                key = key.replace("Option","Alt");
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
        keyCode = "Control+" + keyCode;
    } else if (event.altKey) {
        keyCode = "Alt+" + keyCode;
    } else if (event.metaKey) {
        keyCode = "Meta+" + keyCode;
    }
    const key = keysMap.get(keyCode);
    if (key && key.toLowerCase() !== "ignore") {
        sendKey(key, mod);
        if (mod === 0) {
            event.preventDefault();
        }
    }
}

// Observers Handling
const observers = new Map();
export function subscribeControl(observerId: string, observerCallback: SubscribeCallback) {
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
    if (key === "home" && mod === 0) {
        notifyAll(key);
    } else if (key === "break") {
        Atomics.store(sharedArray, DataType.DBG, DebugCommand.BREAK);
    } else if (rokuKeys.has(key)) {
        const code = rokuKeys.get(key);
        if (typeof code !== "undefined") {
            Atomics.store(sharedArray, DataType.MOD, mod);
            Atomics.store(sharedArray, DataType.KEY, code + mod);
        }
    } else if (key.slice(0, 4).toLowerCase() === "lit_") {
        if (key.slice(4).length === 1 && key.charCodeAt(4) >= 32 && key.charCodeAt(4) < 255) {
            Atomics.store(sharedArray, DataType.MOD, mod);
            Atomics.store(sharedArray, DataType.KEY, key.charCodeAt(4) + mod);
        }
    }
}
