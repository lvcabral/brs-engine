import { dataBufferIndex, DataType, DebugCommand, defaultDeviceInfo, DeviceInfo } from "../common";
import { FileSystem } from "./FileSystem";
import { OutputProxy } from "./OutputProxy";

export class BrsDevice {
    static readonly deviceInfo: DeviceInfo = defaultDeviceInfo;
    static readonly registry: Map<string, string> = new Map<string, string>();
    static readonly fileSystem: FileSystem = new FileSystem();
    static readonly isDevMode = process.env.NODE_ENV === "development";

    static stdout: OutputProxy = new OutputProxy(process.stdout, false);
    static stderr: OutputProxy = new OutputProxy(process.stderr, false);

    static sharedArray: Int32Array = new Int32Array(0);
    static displayEnabled: boolean = true;
    static singleKeyEvents: boolean = true; // Default Roku behavior is `true`
    static useCORSProxy: boolean = true; // If CORS proxy is configured, use it by default
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
     * Set the device info
     * @param deviceInfo DeviceInfo to be set
     */
    static setDeviceInfo(deviceInfo: DeviceInfo) {
        Object.entries(deviceInfo).forEach(([key, value]) => {
            if (key !== "registry" && key !== "assets") {
                if (key === "developerId") {
                    // Prevent developerId from having "." to avoid issues on registry persistence
                    value = value.replace(".", ":");
                } else if (key === "corsProxy") {
                    // make sure the CORS proxy is valid URL and ends with "/"
                    if (value.length > 0 && !value.startsWith("http")) {
                        value = "";
                    } else if (value.length > 0 && !value.endsWith("/")) {
                        value += "/";
                    }
                }
                this.deviceInfo[key] = value;
            }
        });
    }

    /**
     * Returns the configured CORS proxy
     * @returns the URL or empty string
     */
    static getCORSProxy() {
        const corsProxy = this.deviceInfo.corsProxy ?? "";
        return this.useCORSProxy ? corsProxy : "";
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
}
