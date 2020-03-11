import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { RoTimespan } from "./RoTimespan";

export class RoAppManager extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;

    constructor() {
        super("roAppManager");
        this.registerMethods({
            ifAppManager: [
                this.getUpTime,
                this.getScreensaverTimeout,
                this.updateLasKeyPressTime,
                this.setUserSignedIn,
                this.setTheme,
                this.setThemeAttribute,
                this.clearThemeAttribute,
                this.isAppInstalled,
                this.setAutomaticAudioGuideEnabled,
            ],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roChannelStore>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    // ifChannelStore ------------------------------------------------------------------------------------

    /** Returns an roTimespan object which is "marked" when the user started the channel. */
    private getUpTime = new Callable("getUpTime", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            return new RoTimespan(interpreter.startTime);
        },
    });

    /** Returns the user's screensaver wait time setting in number of minutes, or zero if the screensaver is disabled. */
    private getScreensaverTimeout = new Callable("getScreensaverTimeout", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(0);
        },
    });

    /** Resets the idle timer that is used to count down to screensaver activation, so if a screensaver
     *  is not already displayed it will reset the timer and defer the activation. */
    private updateLasKeyPressTime = new Callable("updateLasKeyPressTime", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            return BrsInvalid.Instance;
        },
    });

    /** Allows a channel to tell Roku when the user is signed in or signed out of the channel. */
    private setUserSignedIn = new Callable("setUserSignedIn", {
        signature: {
            args: [new StdlibArgument("signedIn", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, signedIn: BrsBoolean) => {
            return BrsInvalid.Instance;
        },
    });

    /** Set a group of theme attributes for the application. */
    private setTheme = new Callable("setTheme", {
        signature: {
            args: [new StdlibArgument("attributeArray", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, attributeArray: BrsComponent) => {
            return BrsInvalid.Instance;
        },
    });

    /** Set an individual theme attribute for the application. */
    private setThemeAttribute = new Callable("setThemeAttribute", {
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
    private clearThemeAttribute = new Callable("clearThemeAttribute", {
        signature: {
            args: [new StdlibArgument("attributeName", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, attributeName: BrsString) => {
            return BrsInvalid.Instance;
        },
    });

    /** Returns true if a channel with the specified channelID and the minimum version required is installed. */
    private isAppInstalled = new Callable("isAppInstalled", {
        signature: {
            args: [
                new StdlibArgument("channelId", ValueKind.String),
                new StdlibArgument("version", ValueKind.String),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, channelId: BrsString, version: BrsString) => {
            // TODO: Check how to get this info from Electron App.
            return BrsBoolean.False;
        },
    });

    /** Enables or disables automatic Audio Guide and override any manifest setting. */
    private setAutomaticAudioGuideEnabled = new Callable("setAutomaticAudioGuideEnabled", {
        signature: {
            args: [new StdlibArgument("enabled", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, enabled: BrsBoolean) => {
            return BrsInvalid.Instance;
        },
    });
}
