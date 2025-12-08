/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SubscribeCallback, saveDataBuffer } from "../api/util";
import { DataType, RemoteType, DebugCommand, keyBufferSize, keyArraySpots, BufferType } from "../core/common";

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
 * @param array Shared Int32Array for inter-thread communication
 * @param options Optional configuration object (supports disableDebug)
 */
export function initControlModule(array: Int32Array, options: any = {}) {
    sharedArray = array;
    if (typeof options.disableDebug === "boolean") {
        disableDebug = options.disableDebug;
    }
}

// Observers Handling
const observers = new Map();

/**
 * Subscribes an observer to control events.
 * @param observerId Unique identifier for the observer
 * @param observerCallback Callback function to be called on events
 */
export function subscribeControl(observerId: string, observerCallback: SubscribeCallback) {
    observers.set(observerId, observerCallback);
}

/**
 * Unsubscribes an observer from control events.
 * @param observerId Unique identifier for the observer to remove
 */
export function unsubscribeControl(observerId: string) {
    observers.delete(observerId);
}

/**
 * Notifies all subscribed observers with an event.
 * @param eventName Name of the event
 * @param eventData Optional data to pass with the event
 */
function notifyAll(eventName: string, eventData?: any) {
    for (const [_id, callback] of observers) {
        callback(eventName, eventData);
    }
}

/**
 * Sets the control input modes (keyboard, gamepads).
 * @param newState Object with keyboard and/or gamePads boolean properties
 */
export function setControlMode(newState: object) {
    Object.assign(controls, newState);
}

/**
 * Gets the current control input modes.
 * @returns Object with keyboard and gamePads boolean properties
 */
export function getControlMode() {
    return { ...controls };
}

/**
 * Enables or disables sending key events to the interpreter.
 * @param enable True to enable key sending, false to disable
 */
export function enableSendKeys(enable: boolean) {
    sendKeysEnabled = enable;
}

/**
 * Sends a key event to the interpreter.
 * Handles special keys (home, break) and Roku remote keys.
 * @param key Key name or code
 * @param mod Modifier value (0 for press, 100 for release)
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
 * Shifts buffer if full.
 * @returns Index of next available buffer slot
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

/**
 * Sends input data to the interpreter via shared buffer.
 * @param data Input data object to serialize and send
 */
export function sendInput(data: object) {
    saveDataBuffer(sharedArray, JSON.stringify(data), BufferType.INPUT);
}

/**
 * Sets the debug state (enable/disable debugging).
 * @param enabled True to enable debugging, false to disable
 */
export function setDebugState(enabled: boolean) {
    notifyAll("debugState", enabled);
    disableDebug = !enabled;
}

/**
 * Gets the current debug state.
 * @returns True if debugging is enabled, false otherwise
 */
export function getDebugState() {
    return !disableDebug;
}
