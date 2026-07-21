/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import readline from "node:readline";
import { saveDataBuffer } from "../api/util";
import { BufferType, DataType, DebugCommand, DebugPrompt } from "../core/common";
import { enableSendKeys, initControlModule, sendKey, subscribeControl } from "./control";

/**
 * Terminal keyboard remote control for the CLI.
 *
 * While the app runs on a worker thread, the main thread owns stdin:
 * - App running: raw mode; keypresses map to Roku remote keys written into the shared
 *   control array (same Atomics protocol as the browser `src/api/control.ts`).
 * - Micro Debugger active (worker posted "command,stop"): line mode; each line is relayed
 *   to the debugger via the shared array (BREAK/PAUSE commands or DEBUG_EXPR strings),
 *   mirroring the browser API `debug()`.
 */

// How long after the last keypress the synthetic key-up is sent (terminals have no keyup).
const KEY_UP_DELAY_MS = 150;

// Terminal keypress name → Roku remote key (mirrors the browser map in src/api/control.ts).
const keysMap: Map<string, string> = new Map([
    ["up", "up"],
    ["down", "down"],
    ["left", "left"],
    ["right", "right"],
    ["return", "select"],
    ["escape", "back"],
    ["delete", "back"],
    ["backspace", "instantreplay"],
    ["home", "home"],
    ["end", "play"],
    ["pageup", "rev"],
    ["pagedown", "fwd"],
    ["insert", "info"],
    ["ctrl+left", "rev"],
    ["ctrl+right", "fwd"],
    ["ctrl+backspace", "backspace"],
    ["ctrl+return", "play"],
    ["ctrl+a", "a"],
    ["ctrl+z", "b"],
    ["ctrl+8", "info"],
]);

/**
 * Translates a Node keypress event into a Roku remote key name.
 * Printable single characters map to literal text keys (`lit_<char>`) for keyboard dialogs.
 * @param str The character produced by the keypress (may be undefined for special keys)
 * @param key The parsed key object from readline keypress events
 * @returns The Roku key name, or undefined when the key has no mapping
 */
export function translateKey(str: string | undefined, key: { name?: string; ctrl?: boolean }): string | undefined {
    const name = key.name ?? "";
    const mapKey = key.ctrl ? `ctrl+${name}` : name;
    const mapped = keysMap.get(mapKey);
    if (mapped) {
        return mapped;
    }
    if (!key.ctrl && str && str.length === 1 && str >= " " && str !== "\u007F") {
        return `lit_${str}`;
    }
    return undefined;
}

// Module state
let sharedArray: Int32Array | undefined;
let rawMode = false;
let debuggerRl: readline.Interface | undefined;
let keyUpTimer: NodeJS.Timeout | undefined;
let lastKeyDown = "";
let exitRequested = false;
let exitHandler: () => void = () => process.exit(0);
let snapshotHandler: (() => void) | undefined;
// Debugger commands awaiting delivery: the shared data buffer holds a single command, so each
// line is sent only after the worker consumed the previous one (DBG back to -1). Piped input
// (tests, scripts) delivers many lines at once and would otherwise overwrite pending commands.
const debugQueue: string[] = [];
let debugFlusher: NodeJS.Timeout | undefined;

/**
 * Starts keyboard remote control on stdin. No-op when stdin is not a TTY (tests, pipes, CI).
 * @param array Shared control Int32Array (keys + debug commands)
 * @param onExit Callback invoked when the user presses Ctrl+C
 * @param onSnapshot Callback invoked when the user presses Ctrl+S (screenshot shortcut)
 */
export function startKeyboardControl(array: Int32Array, onExit?: () => void, onSnapshot?: () => void) {
    sharedArray = array;
    if (onExit) {
        exitHandler = onExit;
    }
    snapshotHandler = onSnapshot;
    if (!process.stdin.isTTY) {
        // Non-TTY (tests, pipes, CI): no raw-mode keys, but the debugger line relay
        // (handleDebuggerCommand) still works with piped stdin.
        return;
    }
    initControlModule(array);
    enableSendKeys(true);
    subscribeControl("keyboard", (event: string) => {
        // The home key exits the app (same as the ECP `home` handling).
        if ((event === "home" || event === "poweroff") && sharedArray) {
            Atomics.store(sharedArray, DataType.DBG, DebugCommand.EXIT);
            Atomics.notify(sharedArray, DataType.DBG);
        }
    });
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("keypress", keypressHandler);
    rawMode = true;
}

/**
 * Stops keyboard control and restores the terminal so the process can exit.
 */
export function stopKeyboardControl() {
    closeDebuggerPrompt();
    debugQueue.length = 0;
    if (debugFlusher) {
        clearTimeout(debugFlusher);
        debugFlusher = undefined;
    }
    if (keyUpTimer) {
        clearTimeout(keyUpTimer);
        keyUpTimer = undefined;
    }
    if (process.stdin.isTTY && rawMode) {
        process.stdin.off("keypress", keypressHandler);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        rawMode = false;
    }
    sharedArray = undefined;
    snapshotHandler = undefined;
}

/**
 * Switches stdin between app raw mode and debugger line mode based on worker messages.
 * Call with "stop" when the Micro Debugger opens and "continue" when the app resumes.
 * @param command The debugger command posted by the worker ("stop", "continue", "pause")
 */
export function handleDebuggerCommand(command: string) {
    if (!sharedArray) {
        return;
    }
    if (command === "stop" && !debuggerRl) {
        openDebuggerPrompt();
    } else if (command === "continue" && debuggerRl) {
        closeDebuggerPrompt();
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
            process.stdin.resume();
            rawMode = true;
        }
    }
}

/**
 * Handles raw-mode keypress events, mapping them to Roku remote keys.
 * @param str Character produced by the keypress
 * @param key Parsed key object from readline
 */
function keypressHandler(str: string | undefined, key: { name?: string; ctrl?: boolean; sequence?: string }) {
    if (!rawMode || debuggerRl || !sharedArray) {
        return;
    }
    if (key.ctrl && (key.name === "c" || key.name === "d")) {
        // First press: graceful exit; second press: force-quit (the graceful path may be
        // stuck if the app worker is unresponsive).
        if (exitRequested) {
            process.exit(130);
        }
        exitRequested = true;
        exitHandler();
        return;
    }
    if (key.ctrl && key.name === "b") {
        // Break into the Micro Debugger (same protocol as the browser API debug("break")).
        Atomics.store(sharedArray, DataType.DBG, DebugCommand.BREAK);
        Atomics.notify(sharedArray, DataType.DBG);
        return;
    }
    if (key.ctrl && key.name === "s") {
        snapshotHandler?.();
        return;
    }
    const rokuKey = translateKey(str, key);
    if (!rokuKey) {
        return;
    }
    // Terminals have no key-up events: send key-down now and schedule a synthetic key-up,
    // collapsing terminal auto-repeat into one long press.
    if (keyUpTimer && lastKeyDown === rokuKey) {
        keyUpTimer.refresh();
        return;
    }
    if (keyUpTimer && lastKeyDown !== rokuKey) {
        clearTimeout(keyUpTimer);
        sendKey(lastKeyDown, 100);
    }
    lastKeyDown = rokuKey;
    sendKey(rokuKey, 0);
    keyUpTimer = setTimeout(() => {
        keyUpTimer = undefined;
        sendKey(rokuKey, 100);
    }, KEY_UP_DELAY_MS);
    keyUpTimer.unref();
}

/**
 * Opens the debugger line-mode prompt, relaying each line to the worker's Micro Debugger.
 */
function openDebuggerPrompt() {
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
    }
    rawMode = false;
    debuggerRl = readline.createInterface({ input: process.stdin, terminal: false });
    debuggerRl.on("close", () => {
        // stdin EOF while the debugger waits for a command (piped input exhausted):
        // relay an `exit` command so the worker's Atomics.wait can never hang the process.
        if (debuggerRl) {
            debugQueue.push("exit");
            flushDebugQueue();
        }
        debuggerRl = undefined;
    });
    debuggerRl.on("line", (line: string) => {
        const command = line.trim();
        if (command.length === 0) {
            process.stdout.write(`\r\n${DebugPrompt}`);
            return;
        }
        debugQueue.push(command);
        flushDebugQueue();
    });
}

/**
 * Delivers queued debugger commands one at a time: a command is written into the shared
 * data buffer only when the worker has consumed the previous one (DBG slot back to -1).
 */
function flushDebugQueue() {
    if (debugFlusher || !sharedArray) {
        return;
    }
    if (debugQueue.length === 0) {
        return;
    }
    if (Atomics.load(sharedArray, DataType.DBG) !== -1) {
        // Previous command still pending; retry shortly.
        debugFlusher = setTimeout(() => {
            debugFlusher = undefined;
            flushDebugQueue();
        }, 10);
        debugFlusher.unref();
        return;
    }
    const command = debugQueue.shift()!;
    if (["break", "pause"].includes(command.toLowerCase())) {
        const cmd = command.toUpperCase() as keyof typeof DebugCommand;
        Atomics.store(sharedArray, DataType.DBG, DebugCommand[cmd]);
        Atomics.notify(sharedArray, DataType.DBG);
    } else {
        saveDataBuffer(sharedArray, command, BufferType.DEBUG_EXPR);
        Atomics.store(sharedArray, DataType.DBG, DebugCommand.EXPR);
        Atomics.notify(sharedArray, DataType.DBG);
    }
    if (debugQueue.length > 0) {
        debugFlusher = setTimeout(() => {
            debugFlusher = undefined;
            flushDebugQueue();
        }, 10);
        debugFlusher.unref();
    }
}

/**
 * Closes the debugger prompt interface, if open.
 */
function closeDebuggerPrompt() {
    const rl = debuggerRl;
    // Clear before closing so the "close" handler knows this is an intentional close
    // (not a stdin EOF) and must not send an EXIT command.
    debuggerRl = undefined;
    rl?.close();
}
