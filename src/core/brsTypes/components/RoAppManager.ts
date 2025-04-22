import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean, Uninitialized } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoArray, RoAssociativeArray, toAssociativeArray } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { RoTimespan } from "./RoTimespan";
import { AppData, AppExitReason, isAppData } from "../../common";
import { BrsDevice } from "../../device/BrsDevice";

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
                this.startVoiceActionSelectionRequest,
                this.setVoiceActionStrings,
                this.getLastExitInfo, // Roku OS 13.0
                this.setTheme, // Deprecated
                this.setThemeAttribute, // Deprecated
                this.clearThemeAttribute, // Deprecated
                this.getRunParams, // undocumented
                this.getAppList, // undocumented
                this.setDisplayDisabled, // undocumented
            ],
        });
        // Undocumented methods found at: https://github.com/rokudev/sublimetext-package/blob/master/plugin_source/BrightScript.sublime-completions
    }

    toString(parent?: BrsType): string {
        return "<Component: roAppManager>";
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
        impl: (_: Interpreter) => {
            BrsDevice.lastKeyTime = performance.now();
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
    private readonly setNowPlayingContentMetaData = new Callable("setNowPlayingContentMetaData", {
        signature: {
            args: [new StdlibArgument("contentMetaData", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, contentMetaData: RoAssociativeArray) => {
            return BrsInvalid.Instance;
        },
    });

    /** Triggers a voice request for the viewer to select a user profile if the device is paired with a hands-free Roku Voice remote control. */
    private readonly startVoiceActionSelectionRequest = new Callable(
        "startVoiceActionSelectionRequest",
        {
            signature: {
                args: [],
                returns: ValueKind.Void,
            },
            impl: (_: Interpreter) => {
                return BrsInvalid.Instance;
            },
        }
    );

    /** Specifies a list of text strings, such as user profile names, that can be matched to voice requests. */
    private readonly setVoiceActionStrings = new Callable("setVoiceActionStrings", {
        signature: {
            args: [new StdlibArgument("actions", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, actions: RoArray) => {
            return BrsInvalid.Instance;
        },
    });

    /** Returns a roAssociativeArray that includes an exit code indicating why an app was terminated. */
    private readonly getLastExitInfo = new Callable("getLastExitInfo", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            const app = BrsDevice.deviceInfo.appList?.find((app: AppData) => app.running);
            const exitInfo = {
                exit_code: app?.exitReason ?? AppExitReason.UNKNOWN,
                media_player_state: "stopped",
                mem_limit: null,
                timestamp: app?.exitTime ? new Date(app.exitTime).toISOString() : null,
            };
            return toAssociativeArray(exitInfo);
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
        impl: (_: Interpreter, channelId: BrsString, version: BrsString) => {
            const appList = BrsDevice.deviceInfo.appList;
            if (appList instanceof Array) {
                const app = appList.find((app) => {
                    return app.id === channelId.value;
                });
                return BrsBoolean.from(
                    app !== undefined && compareVersions(app.version, version.value) >= 0
                );
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
            _: Interpreter,
            channelId: BrsString,
            version: BrsString,
            params: RoAssociativeArray
        ) => {
            const appList = BrsDevice.deviceInfo.appList;
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
        impl: (_: Interpreter) => {
            const result = new RoArray([]);
            const appList = BrsDevice.deviceInfo.appList;
            if (appList instanceof Array) {
                appList.forEach((app) => {
                    const appObj = { id: app.id, title: app.title, version: app.version };
                    result.elements.push(toAssociativeArray(appObj));
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

    /** If set to true disables the TV Display, set to false to restore it. **/
    private readonly setDisplayDisabled = new Callable("setDisplayDisabled", {
        signature: {
            args: [new StdlibArgument("disabled", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, disabled: BrsBoolean) => {
            BrsDevice.displayEnabled = !disabled.toBoolean();
            postMessage({ displayEnabled: !disabled.toBoolean() });
            return Uninitialized.Instance;
        },
    });
}

// Utility functions to compare versions
export function compareVersions(installedVersion: string, userVersion: string): number {
    const installedParts = formatVersion(installedVersion).split(".");
    const userParts = userVersion.trim() === "" ? ["0"] : userVersion.split(".");
    for (let i = 0; i < 3; i++) {
        const installed = Number(installedParts[i]);
        const user = !userParts[i] || userParts[i].trim() === "" ? 0 : Number(userParts[i]);
        if (installed < user || isNaN(user)) {
            return -1;
        } else if (installed > user) {
            return 1;
        }
    }
    return 0;
}

function formatVersion(version: string): string {
    let parts = version.split(".");
    parts = parts.slice(0, 3);
    const formattedParts = parts.map((part) => {
        const num = parseInt(part, 10);
        return isNaN(num) ? 0 : num;
    });
    while (formattedParts.length < 3) {
        formattedParts.push(0);
    }
    return formattedParts.join(".");
}
