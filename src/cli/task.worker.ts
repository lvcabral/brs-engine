/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import path from "node:path";
import { MessagePort, parentPort } from "node:worker_threads";
import { BrsDevice } from "../core/device/BrsDevice";
import { executeTask } from "../core";
import {
    ExtensionInfo,
    isTaskPayload,
    SupportedExtension,
    TaskPayload,
} from "../core/common";
import { registerExtension } from "../core/extensions";

declare const __non_webpack_require__: NodeJS.Require;
const loadModule: NodeJS.Require =
    typeof __non_webpack_require__ === "function" ? __non_webpack_require__ : eval("require");

const port: MessagePort = (() => {
    if (!parentPort) {
        throw new Error("[cli-task-worker] parentPort is undefined");
    }
    return parentPort;
})();

const loadedExtensions = new Set<SupportedExtension>();

console.log("[task-worker] Initialized");

(globalThis as any).postMessage = (message: any) => {
    port.postMessage(message);
};

port.on("message", async (message: any) => {
    if (message instanceof SharedArrayBuffer || message instanceof ArrayBuffer) {
        console.log("[task-worker] Received shared buffer");
        BrsDevice.setSharedArray(new Int32Array(message));
        return;
    }
    if (isTaskPayload(message)) {
        try {
            console.log(`[task-worker] Received task payload for taskId ${message.taskData.id}`);
            await loadExtensions(message);
            await executeTask(message);
        } catch (error: any) {
            port.postMessage(`error,[task-worker] ${error?.message ?? error}`);
        }
        return;
    }
    port.postMessage(`warning,[task-worker] Unsupported message received: ${typeof message}`);
});

async function loadExtensions(payload: TaskPayload) {
    const pendingExtensions = payload.extensions;
    if (!Array.isArray(pendingExtensions) || pendingExtensions.length === 0) {
        return;
    }
    const deviceExtensions = payload.device.extensions;
    for (const extension of pendingExtensions) {
        if (loadedExtensions.has(extension)) {
            continue;
        }
        const modulePath = resolveExtensionPath(deviceExtensions, extension);
        if (!modulePath) {
            port.postMessage(`warning,[task-worker] Path not found for extension ${extension}.`);
            continue;
        }
        try {
            const resolvedPath = path.isAbsolute(modulePath) ? modulePath : path.resolve(__dirname, modulePath);
            const extensionModule: any = loadModule(resolvedPath);
            const ExtensionCtor =
                extensionModule?.BrightScriptExtension ?? extensionModule?.default?.BrightScriptExtension;
            if (typeof ExtensionCtor !== "function") {
                port.postMessage(`warning,[task-worker] Invalid module for extension ${extension}.`);
                continue;
            }
            const instance = new ExtensionCtor();
            registerExtension(() => instance);
            loadedExtensions.add(extension);
            const info: ExtensionInfo = {
                name: extension,
                library: modulePath,
                version: instance.version ?? "0.0.0",
            };
            port.postMessage(info);
        } catch (error: any) {
            port.postMessage(`warning,[task-worker] Failed to load ${extension}: ${error?.message ?? error}`);
        }
    }
}

function resolveExtensionPath(
    extensionMap: Map<SupportedExtension, string> | Record<string, string> | undefined,
    extension: SupportedExtension
): string | undefined {
    if (!extensionMap) {
        return undefined;
    }
    if (extensionMap instanceof Map) {
        return extensionMap.get(extension);
    }
    const record = extensionMap as Record<string, string>;
    return record[extension as unknown as string];
}
