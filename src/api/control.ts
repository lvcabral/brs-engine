/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SubscribeCallback, saveDataBuffer } from "./util";
import { DataType, RemoteType, DebugCommand, keyBufferSize, keyArraySpots, Platform, BufferType } from "../core/common";
/// #if BROWSER
import { deviceData } from "./package";
import gameControl, { GCGamepad, EventName } from "esm-gamecontroller.js";
/// #endif

// Control Mapping
// References:
// https://github.com/rokucommunity/vscode-brightscript-language/blob/master/docs/Debugging/remote-control-mode.md
// https://www.freecodecamp.org/news/javascript-keycode-list-keypress-event-key-codes/
// https://w3c.github.io/gamepad/#remapping
// https://www.toptal.com/developers/keycode

// Roku Remote Mapping
const rokuKeys: Map<string, number> = new Map([
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
    ["pause", 13],
    ["enter", 15],
    ["a", 17],
    ["b", 18],
    ["playonly", 22],
    ["stop", 23],
    ["channelup", 1114134],
    ["channeldown", 1114135],
    ["red", 1114226],
    ["green", 1114227],
    ["yellow", 1114228],
    ["blue", 1114229],
    ["exit", 1114230],
]);

// Initialize Control Module
const controls = { keyboard: true, gamePads: true };
let sharedArray: Int32Array;
let sendKeysEnabled = false;
let disableDebug: boolean = false;

/**
 * Initializes the control module with shared array and options.
 * Sets up keyboard and gamepad controls.
 * @param array Shared Int32Array for control state
 * @param options Optional configuration for controls
 */
export function initControlModule(array: Int32Array, options: any = {}) {
    sharedArray = array;
    if (typeof options.disableDebug === "boolean") {
        disableDebug = options.disableDebug;
    }
    /// #if BROWSER
    if (typeof options.disableKeys === "boolean") {
        controls.keyboard = !options.disableKeys;
    }
    if (options.customKeys instanceof Map) {
        setCustomKeys(options.customKeys);
    }
    if (typeof options.disableGamePads === "boolean") {
        controls.gamePads = !options.disableGamePads;
    }
    if (options.customPadButtons instanceof Map) {
        setCustomPadButtons(options.customPadButtons);
    }
    deviceData.remoteControls.push({ model: 10001, features: ["wifi", "keyboard"] });
    gameControl.on("connect", gamePadOnHandler);
    gameControl.on("disconnect", gamePadOffHandler);
    /// #endif
}

// Observers Handling
const observers = new Map();
/**
 * Subscribes an observer to control events.
 * @param observerId Unique identifier for the observer
 * @param observerCallback Callback function to receive events
 */
export function subscribeControl(observerId: string, observerCallback: SubscribeCallback) {
    observers.set(observerId, observerCallback);
}
/**
 * Unsubscribes an observer from control events.
 * @param observerId Unique identifier of the observer to remove
 */
export function unsubscribeControl(observerId: string) {
    observers.delete(observerId);
}
/**
 * Notifies all subscribed observers of a control event.
 * @param eventName Name of the event
 * @param eventData Optional data associated with the event
 */
function notifyAll(eventName: string, eventData?: any) {
    for (const [_id, callback] of observers) {
        callback(eventName, eventData);
    }
}

/**
 * Sets the control mode configuration.
 * @param newState Object with control state properties (keyboard, gamePads)
 */
export function setControlMode(newState: object) {
    Object.assign(controls, newState);
}

/**
 * Gets the current control mode configuration.
 * @returns Object with keyboard and gamePads boolean flags
 */
export function getControlMode() {
    return { ...controls };
}

export function enableSendKeys(enable: boolean) {
    /// #if BROWSER
    if (enable) {
        document.addEventListener("keydown", keyDownHandler);
        document.addEventListener("keyup", keyUpHandler);
    } else {
        document.removeEventListener("keydown", keyDownHandler);
        document.removeEventListener("keyup", keyUpHandler);
    }
    /// #endif
    sendKeysEnabled = enable;
}

/**
 * Sends a key event to the shared array buffer.
 * @param key Key name to send
 * @param mod Key modifier (0 = down, 100 = up)
 * @param type Remote type (defaults to SIM)
 * @param index Remote index (defaults to 0)
 */
export function sendKey(key: string, mod: number, type: RemoteType = RemoteType.SIM, index = 0) {
    if (["home", "volumemute", "poweroff"].includes(key.toLowerCase())) {
        if (mod === 0) {
            notifyAll(key.toLowerCase());
        }
        notifyAll("control", { key: key.toLowerCase(), mod: mod });
    } else if (!sendKeysEnabled) {
        return;
    } else if (key.toLowerCase() === "break") {
        if (!disableDebug && mod === 0) {
            Atomics.store(sharedArray, DataType.DBG, DebugCommand.BREAK);
            notifyAll("control", { key: key.toLowerCase(), mod: mod });
        }
    } else if (rokuKeys.has(key.toLowerCase())) {
        const code = rokuKeys.get(key.toLowerCase());
        if (code !== undefined) {
            const next = getNext();
            Atomics.store(sharedArray, DataType.RID + next, type + index);
            Atomics.store(sharedArray, DataType.MOD + next, mod);
            Atomics.store(sharedArray, DataType.KEY + next, code + mod);
            notifyAll("control", { key: key.toLowerCase(), mod: mod });
        }
    } else if (key.slice(0, 4).toLowerCase() === "lit_") {
        if (key.slice(4).length === 1) {
            const next = getNext();
            Atomics.store(sharedArray, DataType.RID + next, type + index);
            Atomics.store(sharedArray, DataType.MOD + next, mod);
            Atomics.store(sharedArray, DataType.KEY + next, key.codePointAt(4)! + mod);
            notifyAll("control", { key: key, mod: mod });
        }
    }
}

/**
 * Gets the next available slot in the key buffer.
 * Shifts buffer entries if full to make room.
 * @returns Index of next available key buffer slot
 */
function getNext() {
    for (let i = 0; i < keyBufferSize; i++) {
        const next = i * keyArraySpots;
        if (Atomics.load(sharedArray, DataType.KEY + next) < 0) {
            return next;
        }
    }
    // buffer full
    for (let i = 1; i < keyBufferSize; i++) {
        const prev = (i - 1) * keyArraySpots;
        const next = i * keyArraySpots;
        Atomics.store(sharedArray, DataType.KEY + prev, Atomics.load(sharedArray, DataType.KEY + next));
    }
    return (keyBufferSize - 1) * keyArraySpots;
}

// Input API
export function sendInput(data: object) {
    saveDataBuffer(sharedArray, JSON.stringify(data), BufferType.INPUT);
}

// Debug API
export function setDebugState(enabled: boolean) {
    notifyAll("debugState", enabled);
    disableDebug = !enabled;
}
export function getDebugState() {
    return !disableDebug;
}

/// #if BROWSER

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
keysMap.set("End", "play");
if (Platform.inIOS || Platform.inMacOS) {
    keysMap.set("Meta+Backspace", "backspace");
    keysMap.set("Meta+Enter", "play");
    keysMap.set("Meta+ArrowLeft", "rev");
    keysMap.set("Meta+ArrowRight", "fwd");
    keysMap.set("Control+KeyC", "break");
} else {
    keysMap.set("Control+Backspace", "backspace");
    keysMap.set("Control+Enter", "play");
    keysMap.set("Control+ArrowLeft", "rev");
    keysMap.set("Control+ArrowRight", "fwd");
    keysMap.set("Control+Pause", "break");
}
keysMap.set("PageUp", "rev");
keysMap.set("PageDown", "fwd");
keysMap.set("Insert", "info");
keysMap.set("Help", "info");
keysMap.set("Alt+Digit8", "info");
keysMap.set("Control+Digit8", "info");
keysMap.set("Control+KeyA", "a");
keysMap.set("Control+KeyZ", "b");
keysMap.set("F10", "volumemute");

// Keyboard API
export function setCustomKeys(newKeys: Map<string, string>) {
    for (let [key, value] of newKeys) {
        let newKey = key.replace(/Windows|Command/gi, "Meta");
        keysMap.set(newKey.replace("Option", "Alt"), value);
    }
}

/**
 * Handles keyboard key down events.
 * Ignores repeated key events.
 * @param event Keyboard event
 */
function keyDownHandler(event: KeyboardEvent) {
    if (!event.repeat) {
        handleKeyboardEvent(event, 0);
    }
}
/**
 * Handles keyboard key up events.
 * @param event Keyboard event
 */
function keyUpHandler(event: KeyboardEvent) {
    handleKeyboardEvent(event, 100);
}
/**
 * Processes keyboard events and sends appropriate key codes.
 * Handles modifier keys and maps to Roku remote keys.
 * @param event Keyboard event
 * @param mod Key modifier (0 = down, 100 = up)
 */
function handleKeyboardEvent(event: KeyboardEvent, mod: number) {
    if (!controls.keyboard) {
        return;
    }
    let keyCode: string = event.code;
    if (event.shiftKey && !keyCode.startsWith("Shift")) {
        keyCode = "Shift+" + keyCode;
    } else if (event.ctrlKey && !keyCode.startsWith("Control")) {
        keyCode = "Control+" + keyCode;
    } else if (event.altKey && !keyCode.startsWith("Alt")) {
        keyCode = "Alt+" + keyCode;
    } else if (event.metaKey && !keyCode.startsWith("Meta")) {
        keyCode = "Meta+" + keyCode;
    }
    const key = keysMap.get(keyCode);
    if (key && key.toLowerCase() !== "ignore") {
        sendKey(key, mod, RemoteType.WD);
        event.preventDefault();
    } else if (!["Alt", "Control", "Meta", "Shift", "Tab", "Dead"].includes(event.key)) {
        sendKey(`lit_${event.key}`, mod, RemoteType.WD);
    }
}

// Game Pad Mapping
const axesMap = new Map([
    [0, ["up", "down", "left", "right"]],
    [1, ["up", "down", "left", "right"]],
]);
const buttonsMap = new Map([
    [0, "select"],
    [1, "back"],
    [2, "instantreplay"],
    [3, "play"],
    [4, "instantreplay"],
    [5, "info"],
    [6, "rev"],
    [7, "fwd"],
    [8, "play"],
    [9, "home"],
    [10, "a"],
    [11, "b"],
    [12, "up"],
    [13, "down"],
    [14, "left"],
    [15, "right"],
    [16, "info"],
    [17, "volumemute"],
]);

// Game Pad API
export function setCustomPadButtons(newButtons: Map<number, string>) {
    for (const [button, value] of newButtons) {
        if (button >= 0 && button < 32 && value.length) {
            buttonsMap.set(button, value);
        }
    }
}

/**
 * Handles gamepad connection events.
 * Registers device and subscribes to button/axis events.
 * @param gamePad Connected gamepad object
 */
function gamePadOnHandler(gamePad: GCGamepad) {
    deviceData.remoteControls.push({ model: 10002, features: ["bluetooth", "gamepad"] });
    for (const [index, events] of axesMap.entries()) {
        for (const key of events) {
            if (gamePad.axes > index) {
                const eventName = `${key}${index}` as EventName;
                gamePadSubscribe(gamePad, eventName, index, key);
            }
        }
    }
    for (const [index, key] of buttonsMap.entries()) {
        if (gamePad.buttons > index) {
            const eventName = `button${index}` as EventName;
            gamePadSubscribe(gamePad, eventName, index, key);
        }
    }
}
/**
 * Subscribes to gamepad button or axis events.
 * Sets up before/after handlers to send key press/release events.
 * @param gamePad Gamepad object
 * @param eventName Event name to subscribe to
 * @param index Button or axis index
 * @param key Roku key name to map to
 */
function gamePadSubscribe(gamePad: GCGamepad, eventName: EventName, index: number, key: string) {
    gamePad.before(eventName, () => {
        if (eventName.startsWith("button")) {
            key = buttonsMap.get(index) ?? "";
        }
        if (controls.gamePads && key !== "") {
            sendKey(key, 0, RemoteType.BT, gamePad.id + 1);
        }
    });
    gamePad.after(eventName, () => {
        if (eventName.startsWith("button")) {
            key = buttonsMap.get(index) ?? "";
        }
        if (controls.gamePads && key !== "") {
            sendKey(key, 100, RemoteType.BT, gamePad.id + 1);
        }
    });
}
/**
 * Handles gamepad disconnection events.
 * @param id Gamepad ID that was disconnected
 */
function gamePadOffHandler(id: number) {
    console.info(`GamePad ${id} disconnected!`);
}
/// #endif
