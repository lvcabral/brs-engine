import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoArray, RoAssociativeArray } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { RoTimespan } from "./RoTimespan";
import { isAppData } from "../../common";

export class RoAppManager extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;

    constructor() {
        super("roAppManager");
        this.registerMethods({
            ifAppManager: [
                this.getUpTime,
                this.getScreensaverTimeout,
                this.setUserSignedIn,
                this.setAutomaticAudioGuideEnabled,
                this.setNowPlayingContentMetaData,
                this.showChannelStoreSpringboard,
                this.isAppInstalled,
                this.launchApp, // Blocked by Static Analysis on Roku Channel Store
                this.updateLastKeyPressTime, // Blocked by Static Analysis on Roku Channel Store
                // this.startVoiceActionSelectionRequest,
                // this.setVoiceActionStrings,
                // this.getLastExitInfo, // Roku OS 13.0
                this.setTheme, // Deprecated
                this.setThemeAttribute, // Deprecated
                this.clearThemeAttribute, // Deprecated
                this.getRunParams, // undocumented
                this.getAppList, // undocumented
                // this.setDisplayDisabled, // undocumented
            ],
        });
        // Undocumented methods found at: https://github.com/rokudev/sublimetext-package/blob/master/plugin_source/BrightScript.sublime-completions
    }

    toString(parent?: BrsType): string {
        return "<Component: roChannelStore>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    // ifAppManager ------------------------------------------------------------------------------------

    /** Returns an roTimespan object which is "marked" when the user started the app. */
    private readonly getUpTime = new Callable("getUpTime", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            return new RoTimespan(interpreter.startTime);
        },
    });

    /** Returns the user's screensaver wait time setting in number of minutes, or zero if the screensaver is disabled. */
    private readonly getScreensaverTimeout = new Callable("getScreensaverTimeout", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(0);
        },
    });

    /** Resets the idle timer that is used to count down to screensaver activation, so if a screensaver is not already displayed it will reset the timer and defer the activation. */
    private readonly updateLastKeyPressTime = new Callable("updateLastKeyPressTime", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter) => {
            interpreter.lastKeyTime = Date.now();
            return BrsInvalid.Instance;
        },
    });

    /** Allows an app to tell Roku when the user is signed in or signed out of the app. */
    private readonly setUserSignedIn = new Callable("setUserSignedIn", {
        signature: {
            args: [new StdlibArgument("signedIn", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, signedIn: BrsBoolean) => {
            return BrsInvalid.Instance;
        },
    });

    /** Updates video or audio content metadata during playback. This method takes a subset of content metadata parameters to be updated. */
    private readonly setNowPlayingContentMetaData = new Callable("launchApp", {
        signature: {
            args: [new StdlibArgument("contentMetaData", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, contentMetaData: RoAssociativeArray) => {
            return BrsInvalid.Instance;
        },
    });

    /** Set a group of theme attributes for the application. */
    private readonly setTheme = new Callable("setTheme", {
        signature: {
            args: [new StdlibArgument("attributeArray", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, attributeArray: BrsComponent) => {
            return BrsInvalid.Instance;
        },
    });

    /** Set an individual theme attribute for the application. */
    private readonly setThemeAttribute = new Callable("setThemeAttribute", {
        signature: {
            args: [
                new StdlibArgument("attributeName", ValueKind.String),
                new StdlibArgument("attributeValue", ValueKind.String),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, attributeName: BrsString, attributeValue: BrsString) => {
            return BrsInvalid.Instance;
        },
    });

    /** Clears a previously set attribute and reverts to its default value. */
    private readonly clearThemeAttribute = new Callable("clearThemeAttribute", {
        signature: {
            args: [new StdlibArgument("attributeName", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, attributeName: BrsString) => {
            return BrsInvalid.Instance;
        },
    });

    /** Returns true if an app with the specified channelID and the minimum version required is installed. */
    private readonly isAppInstalled = new Callable("isAppInstalled", {
        signature: {
            args: [
                new StdlibArgument("channelId", ValueKind.String),
                new StdlibArgument("version", ValueKind.String),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, channelId: BrsString, version: BrsString) => {
            const appList = interpreter.deviceInfo.get("appList");
            if (appList instanceof Array) {
                const app = appList.find((app) => {
                    return app.id === channelId.value;
                });
                return BrsBoolean.from(app && compareVersions(app.version, version.value) >= 0);
            }
            return BrsBoolean.False;
        },
    });

    /** Launch Application with the specified channel ID. */
    private readonly launchApp = new Callable("launchApp", {
        signature: {
            args: [
                new StdlibArgument("channelId", ValueKind.String),
                new StdlibArgument("version", ValueKind.String),
                new StdlibArgument("params", ValueKind.Dynamic),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (
            interpreter: Interpreter,
            channelId: BrsString,
            version: BrsString,
            params: RoAssociativeArray
        ) => {
            const appList = interpreter.deviceInfo.get("appList");
            if (appList instanceof Array) {
                const app = appList.find((app) => {
                    return app.id === channelId.value;
                });
                if (isAppData(app) && compareVersions(app.version, version.value) >= 0) {
                    const paramsMap: Map<string, string> = new Map();
                    params.elements.forEach((value, key) => {
                        paramsMap.set(key.toString(), value.toString());
                    });
                    paramsMap.set("source", "other-channel");
                    app.params = paramsMap;
                    postMessage(app);
                    return BrsBoolean.True;
                }
            }
            return BrsBoolean.False;
        },
    });

    /** Launches the channel store springboard of the specified channel id. */
    private readonly showChannelStoreSpringboard = new Callable("showChannelStoreSpringboard", {
        signature: {
            args: [new StdlibArgument("channelId", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, _channelId: BrsString) => {
            // Roku Channel Store Springboard is not available
            return BrsBoolean.False;
        },
    });

    /** Returns the execution parameters passed to the app. */
    private readonly getRunParams = new Callable("getRunParams", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            return interpreter.runParams || new RoAssociativeArray([]);
        },
    });

    /** Returns the list of available/installed apps. */
    private readonly getAppList = new Callable("getAppList", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            const result = new RoArray([]);
            const appList = interpreter.deviceInfo.get("appList");
            if (appList instanceof Array) {
                appList.forEach((app) => {
                    const appAA = new RoAssociativeArray([]);
                    appAA.set(new BrsString("id"), new BrsString(app.id));
                    appAA.set(new BrsString("title"), new BrsString(app.title));
                    appAA.set(new BrsString("version"), new BrsString(app.version));
                    result.elements.push(appAA);
                });
            }
            return result;
        },
    });
    /** Enables or disables automatic Audio Guide and override any manifest setting. */
    private readonly setAutomaticAudioGuideEnabled = new Callable("setAutomaticAudioGuideEnabled", {
        signature: {
            args: [new StdlibArgument("enabled", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, enabled: BrsBoolean) => {
            return BrsInvalid.Instance;
        },
    });
}

// Utility function to compare versions
function compareVersions(version1: string, version2: string): number {
    const splitVersion = (version: string) =>
        version.split(".").map((part) => part.match(/\d+|\D+/g) || []);
    const v1Parts = splitVersion(version1);
    const v2Parts = splitVersion(version2);
    const maxLength = Math.max(v1Parts.length, v2Parts.length);
    for (let i = 0; i < maxLength; i++) {
        const part1 = v1Parts[i] || [];
        const part2 = v2Parts[i] || [];
        const maxPartLength = Math.max(part1.length, part2.length);
        for (let j = 0; j < maxPartLength; j++) {
            const subPart1 = part1[j] || "";
            const subPart2 = part2[j] || "";
            if (subPart1 !== subPart2) {
                const num1 = parseInt(subPart1, 10);
                const num2 = parseInt(subPart2, 10);
                if (!isNaN(num1) && !isNaN(num2)) {
                    if (num1 !== num2) {
                        return num1 > num2 ? 1 : -1;
                    }
                } else {
                    return subPart1 > subPart2 ? 1 : -1;
                }
            }
        }
    }
    return 0;
}
