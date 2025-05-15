/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import {
    dataBufferIndex,
    DataType,
    DebugCommand,
    keyArraySpots,
    keyBufferSize,
    KeyEvent,
    registryInitialSize,
    registryMaxSize,
    RemoteType,
    defaultDeviceInfo,
    DeviceInfo,
    DefaultSounds,
} from "../common";
import SharedObject from "../SharedObject";
import { FileSystem } from "./FileSystem";
import { OutputProxy } from "./OutputProxy";

export class BrsDevice {
    static readonly deviceInfo: DeviceInfo = defaultDeviceInfo;
    static readonly registry: Map<string, string> = new Map<string, string>();
    static readonly fileSystem: FileSystem = new FileSystem();
    static readonly isDevMode = process.env.NODE_ENV === "development";
    static readonly keysBuffer: KeyEvent[] = [];
    static readonly terms: Map<string, string> = new Map<string, string>();

    static stdout: OutputProxy = new OutputProxy(process.stdout, false);
    static stderr: OutputProxy = new OutputProxy(process.stderr, false);

    static sharedArray: Int32Array = new Int32Array(0);
    static displayEnabled: boolean = true;
    static threadId: number = 0;
    static singleKeyEvents: boolean = true; // Default Roku behavior is `true`
    static useCORSProxy: boolean = false;
    static lastRemote: number = 0;
    static lastKey: number = -1;
    static lastMod: number = -1;
    static lastKeyTime: number = Date.now();
    static currKeyTime: number = Date.now();

    /** Array Buffer to Share the Registry across threads */
    private static registryVersion: number = 0;
    private static sharedRegistry?: SharedObject;

    /**
     * Updates the device registry with the provided data
     * @param data Map or Shared Array Buffer with registry content.
     */
    static setRegistry(data: Map<string, string> | SharedArrayBuffer) {
        let registry: Map<string, string>;
        if (data instanceof SharedArrayBuffer) {
            this.sharedRegistry = new SharedObject(registryInitialSize, registryMaxSize);
            this.sharedRegistry.setBuffer(data);
            this.registryVersion = this.sharedRegistry.getVersion();
            registry = new Map(Object.entries(this.sharedRegistry.load()));
        } else {
            registry = data;
        }
        registry.forEach((value: string, key: string) => {
            this.registry.set(key, value);
        });
    }

    /** Stores the registry to the shared buffer */
    static flushRegistry() {
        this.sharedRegistry?.store(Object.fromEntries(this.registry));
    }

    /** Refreshes the registry from the shared buffer (if newer version is available) */
    static refreshRegistry() {
        if (this.sharedRegistry && this.sharedRegistry.getVersion() !== this.registryVersion) {
            this.registryVersion = this.sharedRegistry.getVersion();
            const registry: Map<string, string> = new Map(Object.entries(this.sharedRegistry.load()));
            this.registry.clear();
            registry.forEach((value: string, key: string) => {
                this.registry.set(key, value);
            });
        }
    }

    /**
     * Setup the device sharedArray
     * @param sharedArray Int32Array to be used as sharedArray
     */
    static setSharedArray(sharedArray: Int32Array) {
        this.sharedArray = sharedArray;
    }

    /**
     * Set the device info
     * @param deviceInfo DeviceInfo to be set
     */
    static setDeviceInfo(deviceInfo: DeviceInfo) {
        Object.entries(deviceInfo).forEach(([key, value]) => {
            if (!key.startsWith("registry") && key !== "assets") {
                if (key === "developerId") {
                    // Prevent developerId from having "." to avoid issues on registry persistence
                    value = value.replace(".", ":");
                }
                this.deviceInfo[key] = value;
            }
        });
        const termsFile = `common:/locale/${this.deviceInfo.locale}/terms.json`;
        if (this.fileSystem.existsSync(termsFile)) {
            const termsJson = this.fileSystem.readFileSync(termsFile, "utf8");
            if (termsJson) {
                Object.entries(JSON.parse(termsJson)).forEach(([key, value]) => {
                    if (typeof value === "string") {
                        this.terms.set(key, value);
                    }
                });
            }
        }
    }

    static getTerm(term: string): string {
        return this.terms.get(term) ?? term;
    }

    /**
     * Returns the configured CORS proxy
     * @returns the URL or empty string
     */
    static getCORSProxy() {
        if (this.useCORSProxy) {
            return this.deviceInfo.corsProxy ?? "";
        }
        return "";
    }

    /**
     * Method to check if the Break Command is set in the sharedArray
     * @returns the last debug command
     */
    static checkBreakCommand(debugMode: boolean): number {
        let cmd = debugMode ? DebugCommand.BREAK : -1;
        if (!debugMode) {
            cmd = Atomics.load(this.sharedArray, DataType.DBG);
            if (cmd === DebugCommand.BREAK) {
                Atomics.store(this.sharedArray, DataType.DBG, -1);
            } else if (cmd === DebugCommand.PAUSE) {
                postMessage("debug,pause");
                Atomics.wait(this.sharedArray, DataType.DBG, DebugCommand.PAUSE);
                Atomics.store(this.sharedArray, DataType.DBG, -1);
                cmd = -1;
                postMessage("debug,continue");
            }
        }
        return cmd;
    }

    /**
     * Method to extract the data buffer from the sharedArray
     * @returns the data buffer as a string
     */
    static readDataBuffer(): string {
        let data = "";
        this.sharedArray.slice(dataBufferIndex).every((char) => {
            if (char > 0) {
                data += String.fromCharCode(char);
            }
            return char; // if \0 stops decoding
        });
        Atomics.store(this.sharedArray, DataType.BUF, -1);
        return data;
    }

    /**
     * Method to update the control keys buffer and return the next key
     * @returns the next key in the buffer to be handled or undefined if queue is empty
     */
    static updateKeysBuffer(): KeyEvent | undefined {
        for (let i = 0; i < keyBufferSize; i++) {
            const idx = i * keyArraySpots;
            const key = Atomics.load(this.sharedArray, DataType.KEY + idx);
            if (key === -1) {
                break;
            } else if (this.keysBuffer.length === 0 || key !== this.keysBuffer.at(-1)?.key) {
                const remoteId = Atomics.load(this.sharedArray, DataType.RID + idx);
                const remoteType = Math.trunc(remoteId / 10) * 10;
                const remoteStr = RemoteType[remoteType] ?? RemoteType[RemoteType.SIM];
                const remoteIdx = remoteId - remoteType;
                const mod = Atomics.load(this.sharedArray, DataType.MOD + idx);
                Atomics.store(this.sharedArray, DataType.KEY + idx, -1);
                this.keysBuffer.push({ remote: `${remoteStr}:${remoteIdx}`, key: key, mod: mod });
                this.lastRemote = remoteIdx;
            }
        }
        const nextKey = this.keysBuffer.shift();
        if (!nextKey || nextKey.key === this.lastKey) {
            return;
        }
        if (this.singleKeyEvents) {
            if (nextKey.mod === 0) {
                if (this.lastMod === 0) {
                    this.keysBuffer.unshift({ ...nextKey });
                    nextKey.key = this.lastKey + 100;
                    nextKey.mod = 100;
                }
            } else if (nextKey.key !== this.lastKey + 100) {
                return;
            }
        }
        this.lastKeyTime = this.currKeyTime;
        this.currKeyTime = Date.now();
        this.lastKey = nextKey.key;
        this.lastMod = nextKey.mod;
        return nextKey;
    }

    /**
     * Method to play a system navigation sound
     * @param sound String with the sound name
     */
    static playSound(sound: string) {
        if (DefaultSounds.includes(sound)) {
            postMessage(`audio,trigger,${sound},${this.deviceInfo.audioVolume},0`);
        }
    }
}
