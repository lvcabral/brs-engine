import {
    dataBufferIndex,
    DataType,
    DebugCommand,
    keyArraySpots,
    keyBufferSize,
    KeyEvent,
    RemoteType,
} from "./common";
import { FileSystem } from "./FileSystem";

export class BrsDevice {
    static readonly deviceInfo: Map<string, any> = new Map<string, any>();
    static readonly registry: Map<string, string> = new Map<string, string>();
    static readonly fileSystem: FileSystem = new FileSystem();

    static sharedArray: Int32Array = new Int32Array(0);
    static displayEnabled: boolean = true;
    static lastRemote: number = 0;
    static lastKeyTime: number = Date.now();
    static currKeyTime: number = Date.now();

    /**
     * Updates the device registry with the provided data
     * @param registry Map with registry content.
     */
    static setRegistry(registry: Map<string, string>) {
        registry.forEach((value: string, key: string) => {
            this.registry.set(key, value);
        });
    }

    /**
     * Setup the device sharedArray
     * @param sharedArray Int32Array to be used as sharedArray
     */
    static setSharedArray(sharedArray: Int32Array) {
        this.sharedArray = sharedArray;
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
     * Method to update the control keys buffer, used by roScreen and roSGScreen
     */
    static updateKeysBuffer(keysBuffer: KeyEvent[]) {
        for (let i = 0; i < keyBufferSize; i++) {
            const idx = i * keyArraySpots;
            const key = Atomics.load(this.sharedArray, DataType.KEY + idx);
            if (key === -1) {
                return;
            } else if (keysBuffer.length === 0 || key !== keysBuffer.at(-1)?.key) {
                const remoteId = Atomics.load(this.sharedArray, DataType.RID + idx);
                const remoteType = Math.trunc(remoteId / 10) * 10;
                const remoteStr = RemoteType[remoteType] ?? RemoteType[RemoteType.SIM];
                const remoteIdx = remoteId - remoteType;
                const mod = Atomics.load(this.sharedArray, DataType.MOD + idx);
                Atomics.store(this.sharedArray, DataType.KEY + idx, -1);
                keysBuffer.push({ remote: `${remoteStr}:${remoteIdx}`, key: key, mod: mod });
                this.lastRemote = remoteIdx;
            }
        }
    }
}
