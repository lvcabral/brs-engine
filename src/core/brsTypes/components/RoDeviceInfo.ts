import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoMessagePort, Int32 } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RoAssociativeArray, AAMember } from "./RoAssociativeArray";
import { RoArray } from "./RoArray";
import { ConnectionInfo, getRokuOSVersion, isPlatform } from "../../common";
import { v4 as uuidv4 } from "uuid";
import * as crypto from "crypto";
/// #if !BROWSER
import { XMLHttpRequest } from "../../polyfill/XMLHttpRequest";
/// #endif

export class RoDeviceInfo extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    readonly captionsModes: string[] = ["Off", "On", "Instant replay"];
    readonly captionsOptions: string[] = [
        "mode",
        "text/font",
        "text/effect",
        "text/size",
        "text/color",
        "text/opacity",
        "background/color",
        "background/opacity",
        "window/color",
        "window/opacity",
        "track",
        "track_composite",
        "track_analog",
        "muted",
    ];
    private captionsMode: BrsString = new BrsString("Off");
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
                this.getVersion, // deprecated
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
                this.getDrmInfo,
                this.getDrmInfoEx,
                this.getCaptionsMode,
                this.setCaptionsMode,
                this.getCaptionsOption,
                this.canDecodeAudio,
                this.getAudioOutputChannel,
                this.getAudioDecodeInfo,
                this.canDecodeVideo,
                this.enableCodecCapChangedEvent,
                this.isAudioGuideEnabled,
                this.enableAudioGuideChangedEvent,
                this.isAutoPlayEnabled, // since OS 13.0
                this.getRandomUUID,
                this.getConnectionInfo,
                this.getConnectionType,
                this.getLinkStatus,
                this.enableLinkStatusEvent,
                this.getInternetStatus,
                this.enableInternetStatusEvent,
                this.forceInternetStatusCheck,
                this.getIPAddrs,
                this.getExternalIp,
                this.getGeneralMemoryLevel,
                this.enableLowGeneralMemoryEvent,
                this.enableAppFocusEvent,
                this.enableScreensaverExitedEvent,
                this.enableValidClockEvent,
                this.getCreationTime, // undocumented
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

    dispose() {
        this.port?.removeReference();
    }

    /** Returns the model name for the Roku Streaming Player device running the script. */
    private readonly getModel = new Callable("getModel", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("deviceModel"));
        },
    });

    /** Returns the model display name for the Roku Streaming Player device running the script. */
    private readonly getModelDisplayName = new Callable("getModelDisplayName", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            const model = interpreter.deviceInfo.get("deviceModel");
            const device = interpreter.deviceInfo?.get("models")?.get(model);
            return new BrsString(
                device ? device[0].replace(/ *\([^)]*\) */g, "") : `Roku (${model})`
            );
        },
    });

    /** Returns a string describing what type of device it is. */
    private readonly getModelType = new Callable("getModelType", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            const device = interpreter.deviceInfo
                ?.get("models")
                ?.get(interpreter.deviceInfo.get("deviceModel"));
            return new BrsString(device ? device[1] : "STB");
        },
    });

    /** Returns device model details. */
    private readonly getModelDetails = new Callable("getModelDetails", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            let result = new Array<AAMember>();
            result.push({ name: new BrsString("Manufacturer"), value: new BrsString("") });
            result.push({
                name: new BrsString("ModelNumber"),
                value: new BrsString(interpreter.deviceInfo.get("deviceModel")),
            });
            result.push({ name: new BrsString("VendorName"), value: new BrsString("Roku") });
            result.push({ name: new BrsString("VendorUSBName"), value: new BrsString("Roku") });
            return new RoAssociativeArray(result);
        },
    });

    /** Returns device model details. */
    private readonly getFriendlyName = new Callable("getFriendlyName", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("friendlyName"));
        },
    });

    /** Returns the version number of the device's firmware. */
    private readonly getVersion = new Callable("getVersion", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("firmwareVersion"));
        },
    });

    /** Returns an roAssociativeArray containing the major, minor, revision, and build numbers of the Roku OS running on the device. */
    private readonly getOSVersion = new Callable("getOSVersion", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            const firmware = interpreter.deviceInfo.get("firmwareVersion");
            let result = new Array<AAMember>();
            if (firmware?.length > 0) {
                const os = getRokuOSVersion(firmware);
                result.push({
                    name: new BrsString("major"),
                    value: new BrsString(os.get("major") ?? "0"),
                });
                result.push({
                    name: new BrsString("minor"),
                    value: new BrsString(os.get("minor") ?? "0"),
                });
                result.push({
                    name: new BrsString("revision"),
                    value: new BrsString(os.get("revision") ?? "0"),
                });
                result.push({
                    name: new BrsString("build"),
                    value: new BrsString(os.get("build") ?? "0"),
                });
            }
            return new RoAssociativeArray(result);
        },
    });

    /** Checks for the user interface sound effects volume level. */
    private readonly getSoundEffectsVolume = new Callable("getSoundEffectsVolume", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (interpreter: Interpreter) => {
            return new Int32(interpreter.deviceInfo.get("audioVolume"));
        },
    });

    /** Returns a unique identifier of the unit running the script. Deprecated use GetChannelClientId() */
    private readonly getClientTrackingId = new Callable("getClientTrackingId", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("clientId"));
        },
    });

    /** Returns a unique identifier of the unit running the script. */
    private readonly getChannelClientId = new Callable("getChannelClientId", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("clientId"));
        },
    });

    /** Returns a unique identifier for Advertisement tracking. */
    private readonly getRIDA = new Callable("getRIDA", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("RIDA"));
        },
    });

    /** Returns true if the user has disabled RIDA tracking. */
    private readonly isRIDADisabled = new Callable("isRIDADisabled", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.True;
        },
    });

    /** Checks whether the device is in demo mode. */
    private readonly isStoreDemoMode = new Callable("isStoreDemoMode", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.False;
        },
    });

    /** Returns a value that designates the Roku Channel Store associated with a user’s Roku account. */
    private readonly getCountryCode = new Callable("getCountryCode", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("countryCode"));
        },
    });

    /** Returns a value that designates the Roku Channel Store associated with a user’s Roku account. */
    private readonly getUserCountryCode = new Callable("getUserCountryCode", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("countryCode"));
        },
    });

    /** Returns the three-letter ISO 639-2 language terminology code of the preferred caption language set on the Roku device. */
    private readonly getPreferredCaptionLanguage = new Callable("getPreferredCaptionLanguage", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("captionLanguage"));
        },
    });

    /** Returns the user's current system time zone setting. */
    private readonly getTimeZone = new Callable("getTimeZone", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("timeZone"));
        },
    });

    /** Returns  the current locale value based on the user's language setting. */
    private readonly getCurrentLocale = new Callable("getCurrentLocale", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("locale"));
        },
    });

    /** Returns system settings for time format. */
    private readonly getClockFormat = new Callable("getClockFormat", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("clockFormat"));
        },
    });

    /** Returns the text corresponding to the button selection in the Player Info Settings/Display Type page. */
    private readonly getDisplayType = new Callable("getDisplayType", {
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
    private readonly getDisplayMode = new Callable("getDisplayMode", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("displayMode"));
        },
    });

    /** Returns the video playback resolution. */
    private readonly getVideoMode = new Callable("getVideoMode", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.deviceInfo.get("displayMode"));
        },
    });

    /** Returns the aspect ration for the display screen. */
    private readonly getDisplayAspectRatio = new Callable("getDisplayAspectRatio", {
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
    private readonly getDisplaySize = new Callable("getDisplaySize", {
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
    private readonly getDisplayProperties = new Callable("getDisplayProperties", {
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
    private readonly getSupportedGraphicsResolutions = new Callable(
        "getSupportedGraphicsResolutions",
        {
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
        }
    );

    /** Returns the display size of a screen as an Associative array containing the screen width and height. */
    private readonly getUIResolution = new Callable("getUIResolution", {
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
                ?.get("models")
                ?.get(interpreter.deviceInfo.get("deviceModel"));
            let model = device ? device[3] : "HD";
            result.push({
                name: new BrsString("name"),
                value: new BrsString(model.toUpperCase()),
            });
            return new RoAssociativeArray(result);
        },
    });

    /** Returns a string specifying the device's graphics platform, either opengl or directfb. */
    private readonly getGraphicsPlatform = new Callable("getGraphicsPlatform", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            const device = interpreter.deviceInfo
                ?.get("models")
                ?.get(interpreter.deviceInfo.get("deviceModel"));
            return new BrsString(device ? device[2] : "opengl");
        },
    });

    /** Checks if the current device/firmware supports the passed in feature string. */
    private readonly hasFeature = new Callable("hasFeature", {
        signature: {
            args: [new StdlibArgument("feature", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, feature: BrsString) => {
            const features = ["gaming_hardware", "usb_hardware", "simulation_engine"];
            const custom = interpreter.deviceInfo.get("customFeatures");
            if (custom instanceof Array && custom.length > 0) {
                features.push(...custom);
            }
            const platform = interpreter.deviceInfo.get("platform");
            if (isPlatform(platform)) {
                for (const [key, value] of Object.entries(platform)) {
                    if (value) {
                        features.push(`platform_${key.slice(2).toLowerCase()}`);
                    }
                }
            }
            return BrsBoolean.from(features.includes(feature.value.toLowerCase()));
        },
    });

    /** Checks for the DRM system used by the app. */
    private readonly getDrmInfo = new Callable("getDrmInfo", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return new RoAssociativeArray([]);
        },
    });

    /** Checks for the DRM system used by the app. */
    private readonly getDrmInfoEx = new Callable("getDrmInfoEx", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return new RoAssociativeArray([]);
        },
    });

    /** Determines whether global captions are turned on or off, or are in instant replay mode. */
    private readonly getCaptionsMode = new Callable("getCaptionsMode", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return this.captionsMode;
        },
    });

    /** Sets the current global setting for the Caption Mode property. */
    private readonly setCaptionsMode = new Callable("setCaptionsMode", {
        signature: {
            args: [new StdlibArgument("mode", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, mode: BrsString) => {
            if (this.captionsModes.includes(mode.value)) {
                this.captionsMode = mode;
                return BrsBoolean.True;
            }
            return BrsBoolean.False;
        },
    });

    /** Checks the current value of the specified global setting property. */
    private readonly getCaptionsOption = new Callable("getCaptionsOption", {
        signature: {
            args: [new StdlibArgument("option", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, option: BrsString) => {
            const opt = option.value.toLowerCase();
            if (!this.captionsOptions.includes(opt)) {
                return new BrsString("");
            }
            if (opt === "mode") {
                return this.captionsMode;
            } else if (opt === "muted") {
                return new BrsString("Unmuted");
            }
            return new BrsString("Default");
        },
    });

    /** Checks if the device can decode and play the specified audio format. */
    private readonly canDecodeAudio = new Callable("canDecodeAudio", {
        signature: {
            args: [new StdlibArgument("options", ValueKind.Dynamic)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, options: RoAssociativeArray) => {
            if (options instanceof RoAssociativeArray) {
                const result = new Array<AAMember>();
                const codecs = interpreter.deviceInfo.get("audioCodecs") as string[];
                const codec = options.get(new BrsString("codec"));
                if (codec instanceof BrsString && codecs?.includes(codec.value.toLowerCase())) {
                    result.push({ name: new BrsString("result"), value: BrsBoolean.True });
                } else {
                    result.push({ name: new BrsString("result"), value: BrsBoolean.False });
                    if (codecs) {
                        result.push({
                            name: new BrsString("updated"),
                            value: new BrsString("codec"),
                        });
                        const roCodecs = new RoArray(codecs.map((c: string) => new BrsString(c)));
                        result.push({ name: new BrsString("codec"), value: roCodecs });
                    }
                }
                return new RoAssociativeArray(result);
            }
            return BrsInvalid.Instance;
        },
    });

    /** Checks for the type of audio output. */
    private readonly getAudioOutputChannel = new Callable("getAudioOutputChannel", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString("Stereo");
        },
    });

    /** Lists each audio decoder supported by the device.*/
    private readonly getAudioDecodeInfo = new Callable("getAudioDecodeInfo", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_interpreter) => {
            // This method is deprecated in Roku
            return new RoAssociativeArray([]);
        },
    });

    /** Checks if the device can decode and play the specified video format. */
    private readonly canDecodeVideo = new Callable("canDecodeVideo", {
        signature: {
            args: [new StdlibArgument("options", ValueKind.Dynamic)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, options: RoAssociativeArray) => {
            if (options instanceof RoAssociativeArray) {
                const formats = interpreter.deviceInfo.get("videoFormats") as Map<string, string[]>;
                const codecs = formats?.get("codecs") ?? [];
                const containers = formats?.get("containers") ?? [];
                const codec = options.get(new BrsString("codec"));
                const container = options.get(new BrsString("container"));
                const result = new Array<AAMember>();
                let canDecode = true;
                let updated = "";
                if (codec instanceof BrsString && !codecs.includes(codec.value.toLowerCase())) {
                    canDecode = false;
                    updated = "codec";
                }
                if (
                    canDecode &&
                    container instanceof BrsString &&
                    !containers.includes(container.value.toLowerCase())
                ) {
                    canDecode = false;
                    updated = "container";
                }
                if (!canDecode) {
                    result.push({ name: new BrsString("updated"), value: new BrsString(updated) });
                    if (updated === "codec") {
                        const valid = new RoArray(codecs.map((c: string) => new BrsString(c)));
                        result.push({ name: new BrsString(updated), value: valid });
                    } else {
                        result.push({ name: new BrsString(updated), value: new BrsString("n.a.") });
                    }
                }
                result.push({ name: new BrsString("result"), value: BrsBoolean.from(canDecode) });
                return new RoAssociativeArray(result);
            }
            return BrsInvalid.Instance;
        },
    });

    /** Notifies the app when the audio or video codec changes. */
    private readonly enableCodecCapChangedEvent = new Callable("enableCodecCapChangedEvent", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            // Mocked until roDeviceInfoEvent is implemented
            return BrsBoolean.False;
        },
    });

    /** Checks if the screen reader is enabled. */
    private readonly isAudioGuideEnabled = new Callable("isAudioGuideEnabled", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.False;
        },
    });

    private readonly enableAudioGuideChangedEvent = new Callable("enableAudioGuideChangedEvent", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            // Mocked until roDeviceInfoEvent is implemented
            return BrsBoolean.False;
        },
    });

    /** Returns a flag indicating whether autoplay is enabled on a device. */
    private readonly isAutoPlayEnabled = new Callable("isAutoPlayEnabled", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.False;
        },
    });

    /** Checks for the number of seconds passed since the last remote keypress. */
    private readonly timeSinceLastKeypress = new Callable("timeSinceLastKeypress", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (interpreter: Interpreter) => {
            return new Int32((Date.now() - interpreter.lastKeyTime) / 1000);
        },
    });

    /** Returns a randomly generated unique identifier. */
    private readonly getRandomUUID = new Callable("getRandomUUID", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(generateUUID());
        },
    });

    /** Checks whether the device has a WiFi or wired connection, or if it is not connected through any type of network. */
    private readonly getConnectionType = new Callable("getConnectionType", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            const connInfo: ConnectionInfo = interpreter.deviceInfo.get("connectionInfo");
            return new BrsString(connInfo.type);
        },
    });

    /** Checks for the information associated with the hardware's connection. */
    private readonly getConnectionInfo = new Callable("getConnectionInfo", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            const connInfo: ConnectionInfo = interpreter.deviceInfo.get("connectionInfo");
            const result = new Array<AAMember>();
            result.push({
                name: new BrsString("active"),
                value: new Int32(1),
            });
            result.push({
                name: new BrsString("default"),
                value: new Int32(1),
            });
            result.push({
                name: new BrsString("type"),
                value: new BrsString(connInfo.type),
            });
            if (connInfo.type === "WiFiConnection" && connInfo.ssid) {
                result.push({
                    name: new BrsString("ssid"),
                    value: new BrsString(connInfo.ssid),
                });
                result.push({
                    name: new BrsString("protocol"),
                    value: new BrsString("IEEE 802.11g"),
                });
                result.push({
                    name: new BrsString("signal"),
                    value: new Int32(-140),
                });
            }
            result.push({
                name: new BrsString("name"),
                value: new BrsString(connInfo.name),
            });
            result.push({
                name: new BrsString("gateway"),
                value: new BrsString(connInfo.gateway),
            });
            const ips = interpreter.deviceInfo.get("localIps") as string[];
            if (ips.length > 0) {
                ips.some((iface: string) => {
                    const name = iface.split(",")[0];
                    const ip = iface.split(",")[1];
                    if (name === connInfo.name) {
                        result.push({
                            name: new BrsString("ip"),
                            value: new BrsString(ip),
                        });
                        return true;
                    }
                    return false;
                });
            }
            result.push({
                name: new BrsString("ipv6"),
                value: new RoArray([]),
            });
            connInfo.dns?.forEach((dns: string, index: number) => {
                result.push({
                    name: new BrsString(`dns.${index}`),
                    value: new BrsString(dns),
                });
            });
            result.push({
                name: new BrsString("quality"),
                value: new BrsString(connInfo.quality),
            });
            result.push({
                name: new BrsString("mac"),
                value: new BrsString("00:00:00:00:00:00"),
            });
            result.push({
                name: new BrsString("expectedThroughput"),
                value: new Int32(129),
            });
            return new RoAssociativeArray(result);
        },
    });

    /** Checks if the device has an active connection. */
    private readonly getLinkStatus = new Callable("getLinkStatus", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            let status = true;
            if (typeof navigator === "object" && typeof navigator.onLine === "boolean") {
                status = navigator.onLine;
            }
            return BrsBoolean.from(status);
        },
    });

    /** Notifies the app when a link status event occurs. */
    private readonly enableLinkStatusEvent = new Callable("enableLinkStatusEvent", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            // Mocked until roDeviceInfoEvent is implemented
            return BrsBoolean.False;
        },
    });

    /** Checks the internet connection status of the device. */
    private readonly getInternetStatus = new Callable("getInternetStatus", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            let status = true;
            if (typeof navigator === "object" && typeof navigator.onLine === "boolean") {
                status = navigator.onLine;
            }
            return BrsBoolean.from(status);
        },
    });

    /** Notifies the app when an internet connection status event occurs. */
    private readonly enableInternetStatusEvent = new Callable("enableInternetStatusEvent", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            // Mocked until roDeviceInfoEvent is implemented
            return BrsBoolean.False;
        },
    });

    /** Forces a new internet connection check. */
    private readonly forceInternetStatusCheck = new Callable("forceInternetStatusCheck", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.True;
        },
    });

    /** Returns an AA that each key is the name of a network interface and the value is the IP-address of the interface. */
    private readonly getIPAddrs = new Callable("getIPAddrs", {
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

    /** Checks the IP address assigned to the device by your internet service provider (ISP). */
    private readonly getExternalIp = new Callable("getExternalIp", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            const url = "https://api.ipify.org";
            try {
                const xhr = new XMLHttpRequest();
                xhr.open("GET", url, false); // Note: synchronous
                xhr.responseType = "text";
                xhr.send();
                if (xhr.status !== 200) {
                    if (interpreter.isDevMode) {
                        interpreter.stderr.write(
                            `warning,[getExternalIp] Error getting ${url}: status ${xhr.status} - ${xhr.statusText}`
                        );
                    }
                    return new BrsString("");
                }
                const ip = xhr.responseText;
                if (interpreter.isValidIp(ip)) {
                    return new BrsString(ip);
                }
            } catch (err: any) {
                if (interpreter.isDevMode) {
                    interpreter.stderr.write(
                        `warning,[getExternalIp] Error getting ${url}: ${err.message}`
                    );
                }
            }
            return new BrsString("");
        },
    });

    //** Checks the general memory levels of the device. */
    private readonly getGeneralMemoryLevel = new Callable("getGeneralMemoryLevel", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            const { heapSizeLimit, usedHeapSize } = interpreter.getMemoryHeapInfo();
            const percent = (usedHeapSize / heapSizeLimit) * 100;
            let level = "normal";
            if (percent > 90) {
                level = "critical";
            } else if (percent > 80) {
                level = "low";
            }
            return new BrsString(level);
        },
    });

    /** Notifies the app when a lowGeneralMemoryLevel event occurs. */
    private readonly enableLowGeneralMemoryEvent = new Callable("enableLowGeneralMemoryEvent", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            // Mocked until roDeviceInfoEvent is implemented
            return BrsBoolean.False;
        },
    });

    /** Notifies the app when a system overlay event is displayed. */
    private readonly enableAppFocusEvent = new Callable("enableAppFocusEvent", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            // Mocked until roDeviceInfoEvent is implemented
            return BrsBoolean.False;
        },
    });

    /** Notifies the app when a screensaver exit event occurs. */
    private readonly enableScreensaverExitedEvent = new Callable("enableScreensaverExitedEvent", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            // Mocked until roDeviceInfoEvent is implemented
            return BrsBoolean.False;
        },
    });

    /** Enables an event to be sent when the system clock becomes valid. */
    private readonly enableValidClockEvent = new Callable("enableValidClockEvent", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            // Mocked until roDeviceInfoEvent is implemented
            return BrsBoolean.False;
        },
    });

    /** Returns the date/time of the device manufacturing (the library build date/time here). */
    private readonly getCreationTime = new Callable("getCreationTime", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(interpreter.creationTime ?? "");
        },
    });

    // ifGetMessagePort ----------------------------------------------------------------------------------

    /** Returns the message port (if any) currently associated with the object */
    private readonly getMessagePort = new Callable("getMessagePort", {
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
    private readonly setMessagePort = new Callable("setMessagePort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, port: RoMessagePort) => {
            port.addReference();
            this.port?.removeReference();
            this.port = port;
            return BrsInvalid.Instance;
        },
    });
}
// Helper Functions
function generateUUID(): string {
    if (!("randomUUID" in crypto)) {
        return uuidv4();
    }
    return crypto.randomUUID();
}
