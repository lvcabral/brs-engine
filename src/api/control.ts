/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2023 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { DataType, DebugCommand, SubscribeCallback, context } from "./util";
import gameControl, { GCGamepad, EventName } from "esm-gamecontroller.js";

// Control Mapping
// References:
// https://github.com/rokucommunity/vscode-brightscript-language/blob/master/docs/Debugging/remote-control-mode.md
// https://www.freecodecamp.org/news/javascript-keycode-list-keypress-event-key-codes/
// https://w3c.github.io/gamepad/#remapping
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
keysMap.set("End", "play");
if (context.inApple) {
    keysMap.set("Command+Backspace", "backspace");
    keysMap.set("Command+Enter", "play");
    keysMap.set("Command+ArrowLeft", "rev");
    keysMap.set("Command+ArrowRight", "fwd");
    keysMap.set("Command+Digit8", "info");
    keysMap.set("Control+KeyC", "break");
} else {
    keysMap.set("Control+Backspace", "backspace");
    keysMap.set("Control+Enter", "play");
    keysMap.set("Control+ArrowLeft", "rev");
    keysMap.set("Control+ArrowRight", "fwd");
    keysMap.set("Control+Digit8", "info");
    keysMap.set("Control+Pause", "break");
}
keysMap.set("PageDown", "rev");
keysMap.set("PageUp", "fwd");
keysMap.set("Insert", "info");
keysMap.set("Control+KeyA", "a");
keysMap.set("Control+KeyZ", "b");
const axesMap = new Map([
    [0, ["up", "down", "left", "right"]],
    [1, ["up", "down", "left", "right"]],
]);
const buttonsMap = new Map([
    [0, "select"],
    [1, "back"],
    [2, "rev"],
    [3, "fwd"],
    [4, "info"],
    [5, "play"],
    [6, "instantreplay"],
    [7, "home"],
    [8, "instantreplay"],
    [9, "home"],
    [10, "a"],
    [11, "b"],
    [12, "up"],
    [13, "down"],
    [14, "left"],
    [15, "right"],
    [16, "info"],
]);
const rokuKeys: Map<string, number> = new Map([
    ["back", 0],
    ["back", 0],
    ["up", 2],
    ["down", 3],
    ["left", 4],
    ["right", 5],
    ["select", 6],
    ["instantreplay", 7],
    ["rev", 8],
    ["fwd", 9],
    ["info", 10],
    ["backspace", 11],
    ["play", 13],
    ["enter", 15],
    ["a", 17],
    ["b", 18],
    ["stop", 23],
]);

// Initialize Control Module
let sharedArray: Int32Array;
let disableKeys: boolean = false;

export function initControlModule(array: Int32Array, options: any = {}) {
    sharedArray = array;
    if (options.customKeys instanceof Map) {
        addControlKeys(options.customKeys);
    }
    if (typeof options.disableKeys === "boolean") {
        disableKeys = options.disableKeys;
    }
    if (!options.disableGamePads) {
        gameControl.on("connect", gamePadOnHandler);
        gameControl.on("disconnect", gamePadOffHandler);
    }
}
export function addControlKeys(newKeys: Map<string, string>) {
    newKeys.forEach(function (value: string, key: string) {
        key = key.replace(/Windows|Command/gi, "Meta");
        key = key.replace("Option", "Alt");
        keysMap.set(key, value);
    });
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

// Control API
export function enableControl(enable: boolean) {
    if (!disableKeys) {
        if (enable) {
            document.addEventListener("keydown", keyDownHandler);
            document.addEventListener("keyup", keyUpHandler);
        } else {
            document.removeEventListener("keydown", keyDownHandler);
            document.removeEventListener("keyup", keyUpHandler);
        }
    }
}
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

// Keyboard handlers
function keyDownHandler(event: KeyboardEvent) {
    handleKeyboardEvent(event, 0);
}
function keyUpHandler(event: KeyboardEvent) {
    handleKeyboardEvent(event, 100);
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

// GamePad handlers
function gamePadOnHandler(gamePad: GCGamepad) {
    axesMap.forEach((events, index) => {
        events.forEach((key: string) => {
            if (gamePad.axes > index) {
                const eventName = `${key}${index}` as EventName;
                gamePad.before(eventName, () => {
                    sendKey(key, 0);
                });
                gamePad.after(eventName, () => {
                    sendKey(key, 100);
                });
            }
        });
    });

    buttonsMap.forEach((key, index) => {
        if (gamePad.buttons > index) {
            const eventName = `button${index}` as EventName;
            gamePad.before(eventName, () => {
                sendKey(key, 0);
            });
            gamePad.after(eventName, () => {
                sendKey(key, 100);
            });
        }
    });
}

function gamePadOffHandler(id: number) {
    console.info(`GamePad ${id} disconnected!`);
}
