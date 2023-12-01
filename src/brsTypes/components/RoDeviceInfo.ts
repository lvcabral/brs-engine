import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoMessagePort, Int32 } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RoAssociativeArray, AAMember } from "./RoAssociativeArray";
import { RoArray } from "./RoArray";

export class RoDeviceInfo extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private port?: RoMessagePort;

    constructor() {
        super("roDeviceInfo");
        this.registerMethods({
            ifDeviceInfo: [
                this.getModel,
                this.getModelDisplayName,
                this.getModelType,
                this.getModelDetails,
                this.getFriendlyName,
                this.getVersion,
                this.getOSVersion,
                this.getDisplayType,
                this.getDisplayMode,
                this.getVideoMode,
                this.getDisplayAspectRatio,
                this.getDisplaySize,
                this.getDisplayProperties,
                this.getSupportedGraphicsResolutions,
                this.getUIResolution,
                this.getGraphicsPlatform,
                this.getSoundEffectsVolume,
                this.getClientTrackingId,
                this.getChannelClientId,
                this.getRIDA,
                this.isRIDADisabled,
                this.isStoreDemoMode,
                this.getCountryCode,
                this.getUserCountryCode,
                this.getPreferredCaptionLanguage,
                this.getTimeZone,
                this.getCurrentLocale,
                this.getClockFormat,
                this.timeSinceLastKeypress,
                this.hasFeature,
                this.getDrmInfoEx,
                this.canDecodeAudio,
                this.getAudioOutputChannel,
                this.canDecodeVideo,
                this.enableCodecCapChangedEvent,
                this.IsAudioGuideEnabled,
                this.getRandomUUID,
                this.getConnectionInfo,
                this.getConnectionType,
                this.getLinkStatus,
                this.getInternetStatus,
                this.enableInternetStatusEvent,
                this.forceInternetStatusCheck,
                this.getIPAddrs,
                this.enableLowGeneralMemoryEvent,
                this.getGeneralMemoryLevel,
                this.getMessagePort,
                this.setMessagePort,
            ],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roDeviceInfo>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Returns the model name for the Roku Streaming Player device running the script. */
    private getModel = new Callable("getModel", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("deviceModel"));
        },
    });

    /** Returns the model display name for the Roku Streaming Player device running the script. */
    private getModelDisplayName = new Callable("getModelDisplayName", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            const model = interpreter.deviceInfo.get("deviceModel");
            const device = interpreter.deviceInfo.get("models").get(model);
            return new BrsString(
                device ? device[0].replace(/ *\([^)]*\) */g, "") : `Roku (${model})`
            );
        },
    });

    /** Returns a string describing what type of device it is. */
    private getModelType = new Callable("getModelType", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            const device = interpreter.deviceInfo
                .get("models")
                .get(interpreter.deviceInfo.get("deviceModel"));
            return new BrsString(device ? device[1] : "STB");
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
                value: new BrsString(interpreter.deviceInfo.get("deviceModel")),
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
            return new BrsString(interpreter.deviceInfo.get("friendlyName"));
        },
    });

    /** Returns the version number of the device's firmware. */
    private getVersion = new Callable("getVersion", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("firmwareVersion"));
        },
    });

    /** Returns an roAssociativeArray containing the major, minor, revision, and build numbers of the Roku OS running on the device. */
    private getOSVersion = new Callable("getOSVersion", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            let result = new Array<AAMember>();
            let firmware = interpreter.deviceInfo.get("firmwareVersion");
            if (firmware.length > 0) {
                const versions = "0123456789ACDEFGHJKLMNPRSTUVWXY";
                result.push({
                    name: new BrsString("major"),
                    value: new BrsString(versions.indexOf(firmware.charAt(2)).toString()),
                });
                result.push({
                    name: new BrsString("minor"),
                    value: new BrsString(firmware.slice(4, 5)),
                });
                result.push({
                    name: new BrsString("revision"),
                    value: new BrsString(firmware.slice(7, 8)),
                });
                result.push({
                    name: new BrsString("build"),
                    value: new BrsString(firmware.slice(8, 12)),
                });
            }
            return new RoAssociativeArray(result);
        },
    });

    /** Checks for the user interface sound effects volume level. */
    private getSoundEffectsVolume = new Callable("getSoundEffectsVolume", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (interpreter: Interpreter) => {
            return new Int32(interpreter.deviceInfo.get("audioVolume"));
        },
    });

    /** Returns a unique identifier of the unit running the script. Deprecated use GetChannelClientId() */
    private getClientTrackingId = new Callable("getClientTrackingId", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("clientId"));
        },
    });

    /** Returns a unique identifier of the unit running the script. */
    private getChannelClientId = new Callable("getChannelClientId", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("clientId"));
        },
    });

    /** Returns a unique identifier for Advertisement tracking. */
    private getRIDA = new Callable("getRIDA", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("RIDA"));
        },
    });

    /** Returns true if the user has disabled RIDA tracking. */
    private isRIDADisabled = new Callable("isRIDADisabled", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.False;
        },
    });

    /** Checks whether the device is in demo mode. */
    private isStoreDemoMode = new Callable("isStoreDemoMode", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.False;
        },
    });

    /** Returns a value that designates the Roku Channel Store associated with a user’s Roku account. */
    private getCountryCode = new Callable("getCountryCode", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("countryCode"));
        },
    });

    /** Returns a value that designates the Roku Channel Store associated with a user’s Roku account. */
    private getUserCountryCode = new Callable("getUserCountryCode", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("countryCode"));
        },
    });

    /** Returns the three-letter ISO 639-2 language terminology code of the preferred caption language set on the Roku device. */
    private getPreferredCaptionLanguage = new Callable("getPreferredCaptionLanguage", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("captionLanguage"));
        },
    });

    /** Returns the user's current system time zone setting. */
    private getTimeZone = new Callable("getTimeZone", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("timeZone"));
        },
    });

    /** Returns  the current locale value based on the user's language setting. */
    private getCurrentLocale = new Callable("getCurrentLocale", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("locale"));
        },
    });

    /** Returns system settings for time format. */
    private getClockFormat = new Callable("getClockFormat", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("clockFormat"));
        },
    });

    /** Returns the text corresponding to the button selection in the Player Info Settings/Display Type page. */
    private getDisplayType = new Callable("getDisplayType", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            let display = interpreter.deviceInfo.get("displayMode");
            let result = "HDTV";
            if (display.slice(0, 3) === "480") {
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
            return new BrsString(interpreter.deviceInfo.get("displayMode"));
        },
    });

    /** Returns the video playback resolution. */
    private getVideoMode = new Callable("getVideoMode", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("displayMode"));
        },
    });

    /** Returns the aspect ration for the display screen. */
    private getDisplayAspectRatio = new Callable("getDisplayAspectRatio", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            let display = interpreter.deviceInfo.get("displayMode");
            let result = "16x9";
            if (display.slice(0, 3) === "480") {
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
            let display = interpreter.deviceInfo.get("displayMode");
            if (display.slice(0, 3) === "480") {
                result.push({ name: new BrsString("h"), value: new Int32(480) });
                result.push({ name: new BrsString("w"), value: new Int32(720) });
            } else if (display.slice(0, 3) === "720") {
                result.push({ name: new BrsString("h"), value: new Int32(720) });
                result.push({ name: new BrsString("w"), value: new Int32(1280) });
            } else {
                result.push({ name: new BrsString("h"), value: new Int32(1080) });
                result.push({ name: new BrsString("w"), value: new Int32(1920) });
            }
            return new RoAssociativeArray(result);
        },
    });

    /** Returns An associative array with the following key/value pairs for the display properties of the screen. */
    private getDisplayProperties = new Callable("getDisplayProperties", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            let result = new Array<AAMember>();
            let display = interpreter.deviceInfo.get("displayMode");
            result.push({ name: new BrsString("DolbyVision"), value: BrsBoolean.False });
            result.push({ name: new BrsString("Hdr10"), value: BrsBoolean.False });
            result.push({ name: new BrsString("Hdr10Plus"), value: BrsBoolean.False });
            result.push({ name: new BrsString("HdrSeamless"), value: BrsBoolean.False });
            result.push({ name: new BrsString("internal"), value: BrsBoolean.True });
            if (display.slice(0, 3) === "480") {
                result.push({ name: new BrsString("height"), value: new Int32(3) });
                result.push({ name: new BrsString("width"), value: new Int32(4) });
            } else if (display.slice(0, 3) === "720") {
                result.push({ name: new BrsString("height"), value: new Int32(9) });
                result.push({ name: new BrsString("width"), value: new Int32(16) });
            } else {
                result.push({ name: new BrsString("height"), value: new Int32(72) });
                result.push({ name: new BrsString("width"), value: new Int32(129) });
            }
            return new RoAssociativeArray(result);
        },
    });

    /** Returns An associative array with the following key/value pairs for the display properties of the screen. */
    private getSupportedGraphicsResolutions = new Callable("getSupportedGraphicsResolutions", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            let result: RoAssociativeArray[] = [];
            let mode = new Array<AAMember>();
            let display = interpreter.deviceInfo.get("displayMode");
            mode.push({ name: new BrsString("name"), value: new BrsString("SD") });
            mode.push({ name: new BrsString("height"), value: new Int32(480) });
            mode.push({ name: new BrsString("width"), value: new Int32(720) });
            mode.push({ name: new BrsString("preferred"), value: BrsBoolean.False });
            if (display.slice(0, 3) === "480") {
                mode.push({ name: new BrsString("ui"), value: BrsBoolean.True });
            } else {
                mode.push({ name: new BrsString("ui"), value: BrsBoolean.False });
            }
            result.push(new RoAssociativeArray(mode));
            mode = new Array<AAMember>();
            mode.push({ name: new BrsString("name"), value: new BrsString("HD") });
            mode.push({ name: new BrsString("height"), value: new Int32(720) });
            mode.push({ name: new BrsString("width"), value: new Int32(1280) });
            mode.push({ name: new BrsString("preferred"), value: BrsBoolean.True });
            if (display.slice(0, 3) === "720") {
                mode.push({ name: new BrsString("ui"), value: BrsBoolean.True });
            } else {
                mode.push({ name: new BrsString("ui"), value: BrsBoolean.False });
            }
            result.push(new RoAssociativeArray(mode));
            mode = new Array<AAMember>();
            mode.push({ name: new BrsString("name"), value: new BrsString("FHD") });
            mode.push({ name: new BrsString("height"), value: new Int32(1080) });
            mode.push({ name: new BrsString("width"), value: new Int32(1920) });
            mode.push({ name: new BrsString("preferred"), value: BrsBoolean.False });
            if (display.slice(0, 4) === "1080") {
                mode.push({ name: new BrsString("ui"), value: BrsBoolean.True });
            } else {
                mode.push({ name: new BrsString("ui"), value: BrsBoolean.False });
            }
            result.push(new RoAssociativeArray(mode));
            return new RoArray(result);
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
            let display = interpreter.deviceInfo.get("displayMode");
            if (display.slice(0, 3) === "480") {
                result.push({ name: new BrsString("height"), value: new Int32(480) });
                result.push({ name: new BrsString("width"), value: new Int32(720) });
            } else if (display.slice(0, 3) === "720") {
                result.push({ name: new BrsString("height"), value: new Int32(720) });
                result.push({ name: new BrsString("width"), value: new Int32(1280) });
            } else {
                result.push({ name: new BrsString("height"), value: new Int32(1080) });
                result.push({ name: new BrsString("width"), value: new Int32(1920) });
            }
            const device = interpreter.deviceInfo
                .get("models")
                .get(interpreter.deviceInfo.get("deviceModel"));
            let model = device ? device[3] : "HD";
            result.push({
                name: new BrsString("name"),
                value: new BrsString(model.toUpperCase()),
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
            const device = interpreter.deviceInfo
                .get("models")
                .get(interpreter.deviceInfo.get("deviceModel"));
            return new BrsString(device ? device[2] : "opengl");
        },
    });

    /** Checks if the current device/firmware supports the passed in feature string. */
    private hasFeature = new Callable("hasFeature", {
        signature: {
            args: [new StdlibArgument("feature", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, feature: BrsString) => {
            return BrsBoolean.from(feature.value.toLocaleLowerCase() === "gaming_hardware");
        },
    });

    /** Checks for the DRM system used by the channel. */
    private getDrmInfoEx = new Callable("getDrmInfoEx", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            const result = new Array<AAMember>();
            return new RoAssociativeArray(result);
        },
    });

    /** Checks if the device can decode and play the specified audio format. */
    private canDecodeAudio = new Callable("canDecodeAudio", {
        signature: {
            args: [new StdlibArgument("options", ValueKind.Dynamic)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, options: RoAssociativeArray) => {
            if (options instanceof RoAssociativeArray) {
                const codecs = interpreter.deviceInfo.get("audioCodecs") as string[];
                const codec = options.get(new BrsString("codec"));
                const result = new Array<AAMember>();
                if (codec instanceof BrsString && codecs.includes(codec.value.toLowerCase())) {
                    result.push({ name: new BrsString("result"), value: BrsBoolean.True });
                } else {
                    result.push({ name: new BrsString("result"), value: BrsBoolean.False });
                    result.push({ name: new BrsString("updated"), value: new BrsString("codec") });
                    const roCodecs = new RoArray(codecs.map((c: string) => new BrsString(c)));
                    result.push({ name: new BrsString("codec"), value: roCodecs });
                }
                return new RoAssociativeArray(result);
            }
            return BrsInvalid.Instance;
        },
    });

    /** Checks for the type of audio output. */
    private getAudioOutputChannel = new Callable("getAudioOutputChannel", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString("Stereo");
        },
    });

    /** Checks if the device can decode and play the specified video format. */
    private canDecodeVideo = new Callable("canDecodeVideo", {
        signature: {
            args: [new StdlibArgument("options", ValueKind.Dynamic)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, options: RoAssociativeArray) => {
            if (options instanceof RoAssociativeArray) {
                const result = new Array<AAMember>();
                result.push({ name: new BrsString("result"), value: BrsBoolean.False });
                result.push({ name: new BrsString("updated"), value: new BrsString("codec") });
                const roCodecs = new RoArray([]);
                result.push({ name: new BrsString("codec"), value: roCodecs });
                return new RoAssociativeArray(result);
            }
            return BrsInvalid.Instance;
        },
    });

    /** Notifies the channel when the audio or video codec changes. */
    private enableCodecCapChangedEvent = new Callable("enableCodecCapChangedEvent", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            return enable;
        },
    });

    /** Checks if the screen reader is enabled. */
    private IsAudioGuideEnabled = new Callable("IsAudioGuideEnabled", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.False;
        },
    });

    /** Checks for the number of seconds passed since the last remote keypress. */
    private timeSinceLastKeypress = new Callable("timeSinceLastKeypress", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (interpreter: Interpreter) => {
            return new Int32((Date.now() - interpreter.lastKeyTime) / 1000);
        },
    });

    /** Returns a randomly generated unique identifier. */
    private getRandomUUID = new Callable("getRandomUUID", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(generateUUID());
        },
    });

    /** Checks whether the device has a WiFi or wired connection, or if it is not connected through any type of network. */
    private getConnectionType = new Callable("getConnectionType", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("connectionType"));
        },
    });

    /** Checks for the information associated with the hardware's connection. */
    private getConnectionInfo = new Callable("getConnectionInfo", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            const result = new Array<AAMember>();
            result.push({
                name: new BrsString("type"),
                value: new BrsString(interpreter.deviceInfo.get("connectionType")),
            });
            const ips = interpreter.deviceInfo.get("localIps") as string[];
            if (ips.length > 0) {
                result.push({
                    name: new BrsString("name"),
                    value: new BrsString(ips[0].split(",")[0]),
                });
                result.push({
                    name: new BrsString("ip"),
                    value: new BrsString(ips[0].split(",")[1]),
                });
            }
            return new RoAssociativeArray(result);
        },
    });

    /** Checks if the device has an active connection. */
    private getLinkStatus = new Callable("getLinkStatus", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            let status = true;
            if (typeof navigator === "object") {
                status = navigator.onLine;
            }
            return BrsBoolean.from(status);
        },
    });

    /** Checks the internet connection status of the device. */
    private getInternetStatus = new Callable("getInternetStatus", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            let status = true;
            if (typeof navigator === "object") {
                status = navigator.onLine;
            }
            return BrsBoolean.from(status);
        },
    });

    /** Notifies the channel when an internet connection status event occurs. */
    private enableInternetStatusEvent = new Callable("enableInternetStatusEvent", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            // Mocked until roDeviceInfoEvent is implemented
            return enable;
        },
    });

    /** Forces a new internet connection check. */
    private forceInternetStatusCheck = new Callable("forceInternetStatusCheck", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.True;
        },
    });

    /** Returns an AA that each key is the name of a network interface and the value is the IP-address of the interface. */
    private getIPAddrs = new Callable("getIPAddrs", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            const ips = interpreter.deviceInfo.get("localIps") as string[];
            const result = new Array<AAMember>();
            ips.forEach(function (iface: string) {
                let name: string = iface.split(",")[0];
                let ip: string = iface.split(",")[1];
                result.push({ name: new BrsString(name), value: new BrsString(ip) });
            });
            return new RoAssociativeArray(result);
        },
    });

    //** Checks the general memory levels of the device. */
    private getGeneralMemoryLevel = new Callable("getGeneralMemoryLevel", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString("normal");
        },
    });

    /** Notifies the channel when a lowGeneralMemoryLevel event occurs. */
    private enableLowGeneralMemoryEvent = new Callable("enableLowGeneralMemoryEvent", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            // Mocked until roDeviceInfoEvent is implemented
            return enable;
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
            return this.port ?? BrsInvalid.Instance;
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
// Helper Functions
function generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0,
            v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
