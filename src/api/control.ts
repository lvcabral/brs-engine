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
]);

const keysMap: Map<string, string> = new Map();
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
    disableKeys: boolean,
    customKeys: Map<string, string>
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
            const key: string | undefined = keysMap.get(event.code);
            if (key) {
                handleKey(key, 0);
                if (preventDefault.has(event.code)) {
                    event.preventDefault();
                }
            }
        });
        document.addEventListener("keyup", function keyUpHandler(event: KeyboardEvent) {
            const key: string | undefined = keysMap.get(event.code);
            if (key) {
                handleKey(key, 100);
            }
        });
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
export function handleKey(key: string, mod: number) {
    if (key.toLowerCase() == "home" && mod == 0) {
        notifyAll("home");
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
