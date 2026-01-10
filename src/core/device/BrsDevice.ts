/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import {
    DataBufferIndex,
    DataType,
    DebugCommand,
    KeyArraySpots,
    KeyBufferSize,
    KeyEvent,
    RegistryInitialSize,
    RegistryMaxSize,
    RemoteType,
    DefaultDeviceInfo,
    DeviceInfo,
    DefaultSounds,
    MaxSoundStreams,
    RegistryData,
    AppPayload,
    TaskPayload,
    ExtVolInitialSize,
    ExtVolMaxSize,
} from "../common";
import SharedObject from "../SharedObject";
import { FileSystem } from "./FileSystem";
import { OutputProxy } from "./OutputProxy";

export class BrsDevice {
    static readonly deviceInfo: DeviceInfo = DefaultDeviceInfo;
    static readonly registry: RegistryData = { current: new Map<string, string>(), removed: [], isDirty: false };
    static readonly fileSystem: FileSystem = new FileSystem();
    static readonly extVolume: SharedObject = new SharedObject(ExtVolInitialSize, ExtVolMaxSize);
    static readonly isDevMode = process.env.NODE_ENV === "development";
    static readonly keysBuffer: KeyEvent[] = [];
    static readonly terms: Map<string, string> = new Map<string, string>();
    static readonly sfx: string[] = DefaultSounds.slice();

    static stdout: OutputProxy = new OutputProxy(process.stdout, false);
    static stderr: OutputProxy = new OutputProxy(process.stderr, false);

    static sharedArray: Int32Array = new Int32Array(0);
    static displayEnabled: boolean = true;
    static singleKeyEvents: boolean = true; // Default Roku behavior is `true`
    static useCORSProxy: boolean = true; // If CORS proxy is configured, use it by default
    static lastRemote: number = 0;
    static lastKey: number = -1;
    static lastMod: number = -1;
    static lastKeyTime: number = Date.now();
    static currKeyTime: number = Date.now();

    /** External Storage Volume (ext1:) properties */
    private static extVolVersion: number = -1;
    private static extVolMounted: boolean = false;

    /** Clock Support properties */
    private static timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone;
    private static clockFormat: string = "12h";
    private static locale: string = "en-US";

    /** Memory Volumes Shared Buffers */
    private static tmpVolume?: SharedArrayBuffer;
    private static cacheFS?: SharedArrayBuffer;

    /** Array Buffer to Share the Registry across threads */
    private static registryVersion: number = 0;
    private static sharedRegistry?: SharedObject;

    /**
     * Returns the SharedArrayBuffer used for the tmp: volume.
     * Creates the buffer if it doesn't exist.
     * @returns SharedArrayBuffer for tmp: volume
     */
    static getTmpVolume(): SharedArrayBuffer {
        this.tmpVolume ??= new SharedArrayBuffer(this.deviceInfo.tmpVolSize);
        return this.tmpVolume;
    }

    /**
     * Returns the SharedArrayBuffer used for the cachefs: volume.
     * Creates the buffer if it doesn't exist.
     * @returns SharedArrayBuffer for cachefs: volume
     */
    static getCacheFS(): SharedArrayBuffer {
        this.cacheFS ??= new SharedArrayBuffer(this.deviceInfo.cacheFSVolSize);
        return this.cacheFS;
    }

    /**
     * Sets up the file system with provided application payload and memory volumes.
     * @param payload Partial application/task payload with device and zip information
     */
    static setupFileSystem(payload: Partial<AppPayload & TaskPayload>) {
        if (payload.device === undefined) {
            throw new Error("Device information is required to setup the file system.");
        }
        if (payload.extZip) {
            const uev = Atomics.load(this.sharedArray, DataType.EVE);
            this.extVolume.setBuffer(payload.extZip);
            this.extVolVersion = this.extVolume.getVersion();
            this.extVolMounted = uev === 1;
        }
        this.fileSystem.setup(
            payload.device.assets,
            payload.taskData?.tmp ?? this.getTmpVolume(),
            payload.taskData?.cacheFS ?? this.getCacheFS(),
            payload.pkgZip,
            this.extVolMounted ? this.extVolume.loadData() : undefined,
            payload.root,
            payload.ext
        );
    }

    /**
     * Mounts the external storage volume (ext1:) from the provided shared array buffer.
     * @param extData ArrayBufferLike containing the external volume zip data
     * @returns True if mounted successfully, false otherwise
     */
    static mountExtVolume(extData: ArrayBufferLike) {
        if (this.extVolMounted || extData.byteLength === 0) {
            return false;
        }
        this.extVolume.storeData(extData);
        this.extVolVersion = this.extVolume.getVersion();
        const zipData = this.extVolume.loadData();
        if (!zipData) return false;
        this.fileSystem.mountExt(zipData);
        this.extVolMounted = true;
        return true;
    }

    /**
     * Mounts the external storage volume (ext1:) from the provided file path.
     * @param extPath Path to the external volume zip file
     * @returns True if mounted successfully, false otherwise
     */
    static mountExtPathVolume(extPath: string) {
        if (this.extVolMounted) {
            return false;
        }
        this.fileSystem.setExt(extPath);
        this.extVolMounted = true;
        return true;
    }

    /**
     * Unmounts the external storage volume (ext1:) if it is currently mounted.
     * @returns True if unmounted successfully, false otherwise
     */
    static umountExtVolume() {
        if (!this.extVolMounted) {
            return false;
        }
        this.extVolMounted = false;
        this.fileSystem.umountExt();
        return true;
    }

    /**
     * Refreshes the external storage volume (ext1:) if it has been updated.
     * @returns True if the volume was refreshed or unmounted, false otherwise
     */
    static refreshExtVolume() {
        try {
            const uev = Atomics.load(this.sharedArray, DataType.EVE);
            if (uev === -1 || (!this.extVolMounted && uev === 0)) {
                // No update event or not mounted and event is 0 (unmounted)
                return false;
            } else if (this.extVolMounted && uev === 0) {
                // Mounted but event is 0 (unmounted)
                this.umountExtVolume();
                return true;
            }
            // Mounted and event is 1 (mounted) - check for updates
            if (this.fileSystem.ext) {
                // Mounted from path, no need to refresh
                return false;
            } else if (this.extVolume.getVersion() !== this.extVolVersion) {
                this.extVolVersion = this.extVolume.getVersion();
                const zipData = this.extVolume.loadData();
                if (zipData !== undefined) {
                    this.fileSystem.mountExt(zipData);
                    this.extVolMounted = true;
                    return true;
                } else if (this.isDevMode) {
                    postMessage("warning,[BrsDevice] No data found in external storage volume (ext1:) to refresh.");
                }
            }
        } catch (err: any) {
            Atomics.store(this.sharedArray, DataType.EVE, -1); // reset event on error
            if (this.isDevMode) {
                postMessage("error,[BrsDevice] Error refreshing external storage volume (ext1:):", err.message);
            }
        }
        return false;
    }

    /**
     * Resets all memory volumes (tmp: and cachefs:) by clearing their buffers.
     * Reinitializes the file system with cleared volumes.
     */
    static resetMemoryVolumes() {
        const tmpView = new Uint8Array(this.getTmpVolume());
        tmpView.fill(0);
        const cacheView = new Uint8Array(this.getCacheFS());
        cacheView.fill(0);
        this.fileSystem.resetMemoryFS(this.tmpVolume!, this.cacheFS!);
    }

    /**
     * Updates the device registry with the provided data.
     * @param data Map or SharedArrayBuffer with registry content
     */
    static setRegistry(data: Map<string, string> | SharedArrayBuffer) {
        let registry: Map<string, string>;
        if (data instanceof SharedArrayBuffer) {
            this.sharedRegistry = new SharedObject(RegistryInitialSize, RegistryMaxSize);
            this.sharedRegistry.setBuffer(data);
            this.registryVersion = this.sharedRegistry.getVersion();
            registry = new Map(Object.entries(this.sharedRegistry.load()));
        } else {
            registry = data;
        }
        for (const [key, value] of registry) {
            this.registry.current.set(key, value);
        }
        this.registry.isDirty = false;
    }

    /**
     * Stores the current registry to the shared buffer and notifies the main thread for persistence.
     */
    static flushRegistry() {
        postMessage(this.registry);
        this.sharedRegistry?.store(Object.fromEntries(this.registry.current));
        // Clear removed keys after persistence
        this.registry.removed.length = 0;
        this.registry.isDirty = false;
    }

    /**
     * Refreshes the registry from the shared buffer if a newer version is available.
     */
    static refreshRegistry() {
        if (this.sharedRegistry && this.sharedRegistry.getVersion() !== this.registryVersion) {
            this.registryVersion = this.sharedRegistry.getVersion();
            const registry: Map<string, string> = new Map(Object.entries(this.sharedRegistry.load()));
            this.registry.current.clear();
            for (const [key, value] of registry) {
                this.registry.current.set(key, value);
            }
            this.registry.isDirty = false;
        }
    }

    /**
     * Sets up the device shared array for inter-thread communication.
     * @param sharedArray Int32Array to be used as the shared array
     */
    static setSharedArray(sharedArray: Int32Array) {
        this.sharedArray = sharedArray;
    }

    /**
     * Sets the device info by merging provided values with existing configuration.
     * Normalizes and validates device info values before assignment.
     * @param deviceInfo DeviceInfo object with configuration to set
     */
    static setDeviceInfo(deviceInfo: DeviceInfo) {
        for (const key of Object.keys(deviceInfo) as (keyof DeviceInfo)[]) {
            if (key.startsWith("registry") || key === "assets") {
                continue;
            }
            const newValue = this.normalizeDeviceInfoValue(key, deviceInfo[key]);
            this.assignDeviceInfoValue(key, newValue);
        }
        this.clockFormat = BrsDevice.deviceInfo.clockFormat;
        this.timeZone = BrsDevice.deviceInfo.timeZone;
        this.locale = BrsDevice.deviceInfo.locale.replace("_", "-");
    }

    /**
     * Assigns the device info value to the static deviceInfo object
     * @param key Key of the DeviceInfo
     * @param value Value to be assigned
     */
    private static assignDeviceInfoValue<K extends keyof DeviceInfo>(key: K, value: DeviceInfo[K]) {
        this.deviceInfo[key] = value;
    }

    /**
     * Normalizes certain device info values before assignment
     * @param key Key of the DeviceInfo
     * @param value Value to be normalized
     * @returns Normalized value
     */
    private static normalizeDeviceInfoValue<K extends keyof DeviceInfo>(key: K, value: DeviceInfo[K]): DeviceInfo[K] {
        if (key === "developerId" && typeof value === "string") {
            // Prevent developerId from having "." to avoid issues on registry persistence
            return value.replace(".", ":") as DeviceInfo[K];
        }
        if (key === "corsProxy") {
            // make sure the CORS proxy is valid URL and ends with "/"
            const corsValue = typeof value === "string" ? value : "";
            if (corsValue.length === 0 || !corsValue.startsWith("http")) {
                return "" as DeviceInfo[K];
            }
            return (corsValue.endsWith("/") ? corsValue : `${corsValue}/`) as DeviceInfo[K];
        }
        return value;
    }

    /**
     * Loads the localized terms based on the current locale ID to the terms map.
     * Note: Only to be called after filesystem volumes are mounted.
     */
    static loadLocaleTerms() {
        const locale = this.locale.replace("-", "_");
        const termsFile = `common:/locale/${locale}/terms.json`;
        if (this.fileSystem.existsSync(termsFile)) {
            const termsJson = this.fileSystem.readFileSync(termsFile, "utf8");
            if (termsJson) {
                for (const [key, value] of Object.entries(JSON.parse(termsJson))) {
                    if (typeof value === "string") {
                        this.terms.set(key, value);
                    }
                }
            }
        }
    }

    /**
     * Gets the current display mode based on device info.
     * @returns Display mode string ("FHD", "HD", or "SD")
     */
    static getDisplayMode(): string {
        if (this.deviceInfo?.displayMode?.startsWith("1080")) {
            return "FHD";
        } else if (this.deviceInfo?.displayMode?.startsWith("480")) {
            return "SD";
        }
        return "HD";
    }

    /**
     * Returns the translated term based on current locale ID.
     * @param term Term to be translated
     * @returns Translated term or original if not found
     */
    static getTerm(term: string): string {
        return this.terms.get(term) ?? term;
    }

    /**
     * Returns the configured CORS proxy with the URL if applicable.
     * Skips proxy for localhost and 127.0.0.1.
     * @param url Optional URL to be fetched (defaults to empty string)
     * @returns Proxied URL or original URL
     */
    static getCORSProxy(url: string = "") {
        const corsProxy = this.deviceInfo.corsProxy ?? "";
        const useProxy = this.useCORSProxy && !url.includes("//localhost") && !url.includes("//127.0.0.1");
        return useProxy ? `${corsProxy}${url}` : url;
    }

    /**
     * Checks if the Break Command is set in the shared array.
     * Handles debug pause and continue states.
     * @param debugSession Whether debug session is active
     * @returns Debug command code
     */
    static checkBreakCommand(debugSession: boolean): number {
        let cmd = debugSession ? DebugCommand.BREAK : -1;
        if (!debugSession) {
            cmd = Atomics.load(this.sharedArray, DataType.DBG);
            if (cmd === DebugCommand.BREAK) {
                Atomics.store(this.sharedArray, DataType.DBG, -1);
            } else if (cmd === DebugCommand.PAUSE) {
                postMessage("command,pause");
                Atomics.wait(this.sharedArray, DataType.DBG, DebugCommand.PAUSE);
                Atomics.store(this.sharedArray, DataType.DBG, -1);
                cmd = -1;
                postMessage("command,continue");
            }
        }
        return cmd;
    }

    /**
     * Extracts the data buffer from the shared array.
     * Reads characters until null terminator and clears buffer flag.
     * @returns Data buffer content as string
     */
    static readDataBuffer(): string {
        let data = "";
        this.sharedArray.slice(DataBufferIndex).every((char) => {
            if (char > 0) {
                data += String.fromCharCode(char);
            }
            return char; // if \0 stops decoding
        });
        Atomics.store(this.sharedArray, DataType.BUF, -1);
        return data;
    }

    /**
     * Updates the control keys buffer from shared array and returns the next key.
     * Handles single key event mode and remote button press/release logic.
     * @returns Next key event to be handled or undefined if queue is empty
     */
    static updateKeysBuffer(): KeyEvent | undefined {
        for (let i = 0; i < KeyBufferSize; i++) {
            const idx = i * KeyArraySpots;
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
     * Plays a system navigation sound if it exists in default sounds.
     * @param sound Sound name to play
     */
    static playSound(sound: string) {
        if (DefaultSounds.includes(sound)) {
            const id = this.sfx.indexOf(sound);
            const stream = this.getSfxStream(id);
            if (stream >= 0) {
                postMessage(`sfx,trigger,${sound},${this.deviceInfo.audioVolume},${stream}`);
            }
        }
    }

    /**
     * Gets the next available sound effect stream.
     * @param id Sound effect ID
     * @returns Index of the stream or -1 if not available
     */
    static getSfxStream(id: number): number {
        for (let i = 0; i < MaxSoundStreams; i++) {
            const sfxId = Atomics.load(this.sharedArray, DataType.WAV + i);
            if (sfxId === id || sfxId === -1) {
                Atomics.store(this.sharedArray, DataType.WAV + i, id);
                return i;
            }
        }
        return -1;
    }

    /**
     * Gets the current time in the Roku beacon format.
     * Formats time based on configured clock format (12h/24h) and locale.
     * @returns Formatted time string
     */
    static getTime() {
        const now = new Date();
        if (this.clockFormat === "12h") {
            return new Intl.DateTimeFormat(this.locale, {
                hour: "numeric",
                minute: "numeric",
                hour12: true,
                timeZone: this.timeZone,
            })
                .format(now)
                .toLowerCase();
        }
        return new Intl.DateTimeFormat(this.locale, {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: this.timeZone,
        }).format(now);
    }
}
