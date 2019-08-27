import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoMessagePort, Int32 } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { deviceInfo } from "../..";
import { RoAssociativeArray, AAMember } from "./RoAssociativeArray";

export class RoDeviceInfo extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private port?: RoMessagePort;
    private model: Array<string>;

    constructor() {
        super("roDeviceInfo");
        this.model = deviceInfo.get("models").get(deviceInfo.get("deviceModel"));
        this.registerMethods([
            this.getModel,
            this.getModelDisplayName,
            this.getModelType,
            this.getModelDetails,
            this.getFriendlyName,
            this.getVersion,
            this.getDisplayType,
            this.getDisplayMode,
            this.getDisplayAspectRatio,
            this.getDisplaySize,
            // this.getDisplayProperties,
            // this.getSupportedGraphicsResolutions,
            this.getUIResolution,
            this.getGraphicsPlatform,
            this.getChannelClientId,
            this.getCountryCode,
            this.getUserCountryCode,
            this.getTimeZone,
            this.getCurrentLocale,
            this.getClockFormat,
            // this.timeSinceLastKeypress,
            // this.hasFeature,
            this.getRandomUUID,
            // this.getGeneralMemoryLevel,
            // this.getIPAddrs,
            this.getMessagePort,
            this.setMessagePort,
        ]);
    }

    toString(parent?: BrsType): string {
        return "<Component: roDeviceInfo>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    getValue() {
        return deviceInfo;
    }

    /** Returns the model name for the Roku Streaming Player device running the script. */
    private getModel = new Callable("getModel", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(deviceInfo.get("deviceModel"));
        },
    });

    /** Returns the model display name for the Roku Streaming Player device running the script. */
    private getModelDisplayName = new Callable("getModelDisplayName", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(this.model[0]);
        },
    });

    /** Returns a string describing what type of device it is. */
    private getModelType = new Callable("getModelType", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(this.model[1]);
        },
    });

    /** Returns device model details. */
    private getModelDetails = new Callable("getModelDetails", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            let result = new Array<AAMember>();
            result.push({ name: new BrsString("VendorName"), value: new BrsString("Roku") });
            result.push({
                name: new BrsString("ModelNumber"),
                value: new BrsString(deviceInfo.get("deviceModel")),
            });
            return new RoAssociativeArray(result);
        },
    });

    /** Returns device model details. */
    private getFriendlyName = new Callable("getFriendlyName", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString("Roku Draw2D Emulator");
        },
    });

    /** Returns device model details. */
    private getVersion = new Callable("getVersion", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString("049.00E00000E");
        },
    });

    /** Returns a unique identifier of the unit running the script. */
    private getChannelClientId = new Callable("getChannelClientId", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(deviceInfo.get("clientId"));
        },
    });

    /** Returns a value that designates the Roku Channel Store associated with a user’s Roku account. */
    private getCountryCode = new Callable("getCountryCode", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(deviceInfo.get("countryCode"));
        },
    });

    /** Returns a value that designates the Roku Channel Store associated with a user’s Roku account. */
    private getUserCountryCode = new Callable("getUserCountryCode", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(deviceInfo.get("countryCode"));
        },
    });

    /** Returns the user's current system time zone setting. */
    private getTimeZone = new Callable("getTimeZone", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(deviceInfo.get("timeZone"));
        },
    });

    /** Returns  the current locale value based on the user's language setting. */
    private getCurrentLocale = new Callable("getCurrentLocale", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(deviceInfo.get("locale"));
        },
    });

    /** Returns system settings for time format. */
    private getClockFormat = new Callable("getClockFormat", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(deviceInfo.get("clockFormat"));
        },
    });

    /** Returns the text corresponding to the button selection in the Player Info Settings/Display Type page. */
    private getDisplayType = new Callable("getDisplayType", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            let display = deviceInfo.get("displayMode");
            let result = "HDTV";
            if (display.substr(0, 3) === "480") {
                result = "4:3 standard";
            }
            return new BrsString(result);
        },
    });

    /** Returns the configured graphics layer resolution. */
    private getDisplayMode = new Callable("getDisplayMode", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(deviceInfo.get("displayMode"));
        },
    });

    /** Returns the aspect ration for the display screen. */
    private getDisplayAspectRatio = new Callable("getDisplayAspectRatio", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            let display = deviceInfo.get("displayMode");
            let result = "16x9";
            if (display.substr(0, 3) === "480") {
                result = "4x3";
            }
            return new BrsString(result);
        },
    });

    /** Returns the display size of a screen as an Associative array containing the screen width and height. */
    private getDisplaySize = new Callable("getDisplaySize", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            let result = new Array<AAMember>();
            let display = deviceInfo.get("displayMode");
            if (display.substr(0, 3) === "480") {
                result.push({ name: new BrsString("h"), value: new Int32(480) });
                result.push({ name: new BrsString("w"), value: new Int32(720) });
            } else if (display.substr(0, 3) === "720") {
                result.push({ name: new BrsString("h"), value: new Int32(720) });
                result.push({ name: new BrsString("w"), value: new Int32(1280) });
            } else {
                result.push({ name: new BrsString("h"), value: new Int32(1080) });
                result.push({ name: new BrsString("w"), value: new Int32(1920) });
            }
            return new RoAssociativeArray(result);
        },
    });

    /** Returns the display size of a screen as an Associative array containing the screen width and height. */
    private getUIResolution = new Callable("getUIResolution", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            let result = new Array<AAMember>();
            let display = deviceInfo.get("displayMode");
            if (display.substr(0, 3) === "480") {
                result.push({ name: new BrsString("height"), value: new Int32(480) });
                result.push({ name: new BrsString("width"), value: new Int32(720) });
            } else if (display.substr(0, 3) === "720") {
                result.push({ name: new BrsString("height"), value: new Int32(720) });
                result.push({ name: new BrsString("width"), value: new Int32(1280) });
            } else {
                result.push({ name: new BrsString("height"), value: new Int32(1080) });
                result.push({ name: new BrsString("width"), value: new Int32(1920) });
            }
            result.push({
                name: new BrsString("name"),
                value: new BrsString(this.model[3].toUpperCase()),
            });
            return new RoAssociativeArray(result);
        },
    });

    /** Returns a string specifying the device's graphics platform, either opengl or directfb. */
    private getGraphicsPlatform = new Callable("getGraphicsPlatform", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(this.model[2]);
        },
    });

    /** Returns a randomly generated unique identifier.. */
    private getRandomUUID = new Callable("getRandomUUID", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(generateUUID());
        },
    });

    // ifGetMessagePort ----------------------------------------------------------------------------------

    /** Returns the message port (if any) currently associated with the object */
    private getMessagePort = new Callable("getMessagePort", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.port === undefined ? BrsInvalid.Instance : this.port;
        },
    });

    // ifSetMessagePort ----------------------------------------------------------------------------------

    /** Sets the roMessagePort to be used for all events from the screen */
    private setMessagePort = new Callable("setMessagePort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, port: RoMessagePort) => {
            this.port = port;
            return BrsInvalid.Instance;
        },
    });
}

function generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        var r = (Math.random() * 16) | 0,
            v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
