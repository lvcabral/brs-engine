import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoMessagePort, Int32, FlexObject, toAssociativeArray, BrsEvent, Int64 } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RoDeviceInfoEvent } from "../events/RoDeviceInfoEvent";
import { RoAssociativeArray } from "./RoAssociativeArray";
import { RoArray } from "./RoArray";
import { CaptionOptions, ConnectionInfo, getRokuOSVersion, parseCaptionMode, Platform } from "../../common";
import { IfSetMessagePort, IfGetMessagePort } from "../interfaces/IfMessagePort";
import { getExternalIp } from "../../interpreter/Network";
import { v4 as uuidv4 } from "uuid";
import * as crypto from "crypto";
import { BrsDevice } from "../../device/BrsDevice";

export class RoDeviceInfo extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly deviceModel: string;
    private readonly modelType: string;
    private readonly firmware: string;
    private readonly displayMode: string;
    private readonly displayModeName: string;
    private readonly displayResolution: { h: number; w: number };
    private readonly displayAspectRatio: string;
    private captionsMessageSent: boolean = false;
    private port?: RoMessagePort;

    constructor() {
        super("roDeviceInfo");
        this.deviceModel = BrsDevice.deviceInfo.deviceModel;
        const device = BrsDevice.deviceInfo.models?.get(this.deviceModel);
        this.modelType = device ? device[1] : "STB";
        this.firmware = BrsDevice.deviceInfo.firmwareVersion;
        this.displayMode = BrsDevice.deviceInfo.displayMode;
        this.displayAspectRatio = "16x9";
        this.displayResolution = { h: 720, w: 1280 };
        this.displayModeName = "HD";
        if (this.displayMode.startsWith("480")) {
            this.displayResolution = { h: 480, w: 720 };
            this.displayAspectRatio = "4x3";
            this.displayModeName = "SD";
        } else if (this.displayMode.startsWith("1080")) {
            this.displayResolution = { h: 1080, w: 1920 };
            this.displayModeName = "FHD";
        }
        const setPortIface = new IfSetMessagePort(this, this.getNewEvents.bind(this));
        const getPortIface = new IfGetMessagePort(this);
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
                this.getGraphicsFeatures, // since OS 14.0
                this.getSoundEffectsVolume,
                this.getDeviceUniqueId, // deprecated
                this.getClientTrackingId, // deprecated
                this.getChannelClientId,
                this.getAdvertisingId, // deprecated
                this.getRIDA,
                this.IsAdIdTrackingDisabled, // deprecated
                this.isRIDADisabled,
                this.isStoreDemoMode,
                this.getCountryCode,
                this.getUserCountryCode,
                this.getPreferredCaptionLanguage,
                this.getTimeZone,
                this.getCurrentLocale,
                this.getClockFormat,
                this.getUptimeMillisecondsAsLong, // since OS 15.1
                this.timeSinceLastKeypress,
                this.hasFeature,
                this.getDrmInfo, // deprecated
                this.getDrmInfoEx,
                this.getCaptionsMode,
                this.setCaptionsMode,
                this.getCaptionsOption,
                this.canDecodeAudio,
                this.getAudioOutputChannel,
                this.getAudioDecodeInfo, // deprecated
                this.getVideoDecodeInfo, // deprecated
                this.canDecodeVideo,
                this.isAudioGuideEnabled,
                this.isAutoPlayEnabled, // since OS 13.0
                this.IsAutoAdjustRefreshRateEnabled, // since OS 15.0
                this.getRandomUUID,
                this.getConnectionInfo,
                this.getConnectionType,
                this.getLinkStatus,
                this.getInternetStatus,
                this.forceInternetStatusCheck,
                this.getIPAddrs,
                this.getExternalIp,
                this.getGeneralMemoryLevel,
                this.enableLinkStatusEvent,
                this.enableInternetStatusEvent,
                this.enableCodecCapChangedEvent,
                this.enableAudioGuideChangedEvent,
                this.enableLowGeneralMemoryEvent,
                this.enableAppFocusEvent,
                this.enableScreensaverExitedEvent,
                this.enableValidClockEvent,
                this.isClockValid, // internal for Roku, added for completeness
                this.getCreationTime, // undocumented
                setPortIface.setMessagePort,
                getPortIface.getMessagePort,
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
        this.port?.unregisterCallback(this.getComponentName());
    }

    // DeviceInfo Event -------------------------------------------------------------------------------

    private getNewEvents() {
        const events: BrsEvent[] = [];
        if (!this.captionsMessageSent) {
            events.push(new RoDeviceInfoEvent({ Mode: BrsDevice.deviceInfo.captionMode, Mute: false }));
            this.captionsMessageSent = true;
            // TODO: Generate a new event when the captions mode changes
        }
        return events;
    }

    /** Returns the model name for the Roku Streaming Player device running the script. */
    private readonly getModel = new Callable("getModel", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.deviceModel);
        },
    });

    /** Returns the model display name for the Roku Streaming Player device running the script. */
    private readonly getModelDisplayName = new Callable("getModelDisplayName", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            const model = this.deviceModel;
            const device = BrsDevice.deviceInfo.models?.get(model);
            return new BrsString(device ? device[0].replace(/ *\([^)]*\) */g, "") : `Roku (${model})`);
        },
    });

    /** Returns a string describing what type of device it is. */
    private readonly getModelType = new Callable("getModelType", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.modelType);
        },
    });

    /** Returns device model details. */
    private readonly getModelDetails = new Callable("getModelDetails", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return toAssociativeArray({
                Manufacturer: "",
                ModelNumber: this.deviceModel,
                VendorName: "Roku",
                VendorUSBName: "Roku",
                SerialNumber: BrsDevice.deviceInfo.serialNumber,
            });
        },
    });

    /** Returns device model details. */
    private readonly getFriendlyName = new Callable("getFriendlyName", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(BrsDevice.deviceInfo.friendlyName);
        },
    });

    /** Returns the version number of the device's firmware. */
    private readonly getVersion = new Callable("getVersion", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            BrsDevice.stderr.write(
                `warning,BRIGHTSCRIPT: WARNING: roDeviceInfo.GetVersion: This function is deprecated`
            );
            return new BrsString("999.99E99999A");
        },
    });

    /** Returns an roAssociativeArray containing the major, minor, revision, and build numbers of the Roku OS running on the device. */
    private readonly getOSVersion = new Callable("getOSVersion", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            const result = { major: "0", minor: "0", revision: "0", build: "0" };
            if (this.firmware?.length > 0) {
                const os = getRokuOSVersion(this.firmware);
                result.major = os.get("major") ?? "0";
                result.minor = os.get("minor") ?? "0";
                result.revision = os.get("revision") ?? "0";
                result.build = os.get("build") ?? "0";
            }
            return toAssociativeArray(result);
        },
    });

    /** Checks for the user interface sound effects volume level. */
    private readonly getSoundEffectsVolume = new Callable("getSoundEffectsVolume", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(BrsDevice.deviceInfo.audioVolume);
        },
    });

    /** Returns a unique identifier of the unit running the script. Deprecated use GetChannelClientId() */
    private readonly getDeviceUniqueId = new Callable("getDeviceUniqueId", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            BrsDevice.stderr.write(
                `warning,BRIGHTSCRIPT: WARNING: roDeviceInfo.GetDeviceUniqueId: This function is deprecated`
            );
            return new BrsString("000000000000");
        },
    });

    /** Returns a unique identifier of the unit running the script. Deprecated use GetChannelClientId() */
    private readonly getClientTrackingId = new Callable("getClientTrackingId", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            BrsDevice.stderr.write(
                `warning,BRIGHTSCRIPT: WARNING: roDeviceInfo.GetClientTrackingId: This function is deprecated`
            );
            return new BrsString(BrsDevice.deviceInfo.clientId);
        },
    });

    /** Returns a unique identifier of the unit running the script. */
    private readonly getChannelClientId = new Callable("getChannelClientId", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(BrsDevice.deviceInfo.clientId);
        },
    });

    /** Returns a unique identifier for Advertisement tracking. */
    private readonly getAdvertisingId = new Callable("getAdvertisingId", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            BrsDevice.stderr.write(
                `warning,BRIGHTSCRIPT: WARNING: roDeviceInfo.GetAdvertisingId: This function is deprecated`
            );
            return new BrsString(BrsDevice.deviceInfo.RIDA);
        },
    });

    /** Returns a unique identifier for Advertisement tracking. */
    private readonly getRIDA = new Callable("getRIDA", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(BrsDevice.deviceInfo.RIDA);
        },
    });

    /** Returns true if the user has disabled Ad Id tracking by selecting "Limit ad tracking" from the Roku Settings menu. */
    private readonly IsAdIdTrackingDisabled = new Callable("IsAdIdTrackingDisabled", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            BrsDevice.stderr.write(
                `warning,BRIGHTSCRIPT: WARNING: roDeviceInfo.IsAdIdTrackingDisabled: This function is deprecated`
            );
            return BrsBoolean.True;
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
        impl: (_: Interpreter) => {
            return new BrsString(BrsDevice.deviceInfo.countryCode);
        },
    });

    /** Returns a value that designates the Roku Channel Store associated with a user’s Roku account. */
    private readonly getUserCountryCode = new Callable("getUserCountryCode", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(BrsDevice.deviceInfo.countryCode);
        },
    });

    /** Returns the three-letter ISO 639-2 language terminology code of the preferred caption language set on the Roku device. */
    private readonly getPreferredCaptionLanguage = new Callable("getPreferredCaptionLanguage", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(BrsDevice.deviceInfo.captionLanguage);
        },
    });

    /** Returns the user's current system time zone setting. */
    private readonly getTimeZone = new Callable("getTimeZone", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(BrsDevice.deviceInfo.timeZone);
        },
    });

    /** Returns  the current locale value based on the user's language setting. */
    private readonly getCurrentLocale = new Callable("getCurrentLocale", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(BrsDevice.deviceInfo.locale);
        },
    });

    /** Returns system settings for time format. */
    private readonly getClockFormat = new Callable("getClockFormat", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(BrsDevice.deviceInfo.clockFormat);
        },
    });

    /** Returns system settings for time format. */
    private readonly getUptimeMillisecondsAsLong = new Callable("getUptimeMillisecondsAsLong", {
        signature: {
            args: [],
            returns: ValueKind.Int64,
        },
        impl: (_: Interpreter) => {
            const startTime = BrsDevice.deviceInfo.startTime;
            return new Int64((Date.now() - startTime) / 1000);
        },
    });

    /** Returns the text corresponding to the button selection in the Player Info Settings/Display Type page. */
    private readonly getDisplayType = new Callable("getDisplayType", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            let result = "HDTV";
            if (this.displayModeName === "SD") {
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
        impl: (_: Interpreter) => {
            return new BrsString(this.displayMode);
        },
    });

    /** Returns the video playback resolution. */
    private readonly getVideoMode = new Callable("getVideoMode", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.displayMode);
        },
    });

    /** Returns the aspect ration for the display screen. */
    private readonly getDisplayAspectRatio = new Callable("getDisplayAspectRatio", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.displayAspectRatio);
        },
    });

    /** Returns the display size of a screen as an Associative array containing the screen width and height. */
    private readonly getDisplaySize = new Callable("getDisplaySize", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return toAssociativeArray(this.displayResolution);
        },
    });

    /** Returns An associative array with the following key/value pairs for the display properties of the screen. */
    private readonly getDisplayProperties = new Callable("getDisplayProperties", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            const props: FlexObject = {
                ALLM: false, // Auto Low Latency Mode
                DolbyVision: false,
                Hdr10: false,
                Hdr10Plus: false,
                HdrSeamless: false,
                HLG: false, // Hybrid Log-Gamma
                headless: false,
                internal: false,
                VRR: false, // Variable Refresh Rate
                height: 72,
                width: 129,
            };
            if (this.modelType === "TV") {
                props.internal = true;
                props.visible = BrsDevice.displayEnabled;
            }
            return toAssociativeArray(props);
        },
    });

    /** Returns An associative array with the following key/value pairs for the display properties of the screen. */
    private readonly getSupportedGraphicsResolutions = new Callable("getSupportedGraphicsResolutions", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            let result: RoAssociativeArray[] = [];
            let display = this.displayModeName;
            let mode = {
                name: "SD",
                height: 480,
                width: 720,
                preferred: false,
                ui: display === "SD",
            };
            result.push(toAssociativeArray(mode));
            mode = {
                name: "HD",
                height: 720,
                width: 1280,
                preferred: false,
                ui: display === "HD",
            };
            result.push(toAssociativeArray(mode));
            mode = {
                name: "FHD",
                height: 1080,
                width: 1920,
                preferred: true,
                ui: display === "FHD",
            };
            result.push(toAssociativeArray(mode));
            return new RoArray(result);
        },
    });

    /** Returns the display size of a screen as an Associative array containing the screen width and height. */
    private readonly getUIResolution = new Callable("getUIResolution", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            const uiRes = {
                height: this.displayResolution.h,
                width: this.displayResolution.w,
                name: this.displayModeName,
            };
            return toAssociativeArray(uiRes);
        },
    });

    /** Checks the graphics features supported by the device. */
    private readonly getGraphicsFeatures = new Callable("getGraphicsFeatures", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            const graphicsFeatures = {
                full_rotation: true,
                astc_supported: false,
            };
            return toAssociativeArray(graphicsFeatures);
        },
    });

    /** Returns a string specifying the device's graphics platform, either opengl or directfb. */
    private readonly getGraphicsPlatform = new Callable("getGraphicsPlatform", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            const device = BrsDevice.deviceInfo.models?.get(this.deviceModel);
            return new BrsString(device ? device[2] : "opengl");
        },
    });

    /** Checks if the current device/firmware supports the passed in feature string. */
    private readonly hasFeature = new Callable("hasFeature", {
        signature: {
            args: [new StdlibArgument("feature", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, feature: BrsString) => {
            const features = ["gaming_hardware", "usb_hardware", "simulation_engine"];
            const custom = BrsDevice.deviceInfo.customFeatures;
            if (Array.isArray(custom) && custom.length > 0) {
                features.push(...custom);
            }
            for (const [key, value] of Object.entries(Platform)) {
                if (value) {
                    features.push(`platform_${key.slice(2).toLowerCase()}`);
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
            BrsDevice.stderr.write(
                `warning,BRIGHTSCRIPT: WARNING: roDeviceInfo.GetDrmInfo: This function is deprecated`
            );
            return toAssociativeArray({ PlayReady: " " });
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
            return new BrsString(BrsDevice.deviceInfo.captionMode);
        },
    });

    /** Sets the current global setting for the Caption Mode property. */
    private readonly setCaptionsMode = new Callable("setCaptionsMode", {
        signature: {
            args: [new StdlibArgument("mode", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, mode: BrsString) => {
            const newMode = parseCaptionMode(mode.value);
            if (newMode) {
                if (mode.value === "When mute" && this.modelType !== "TV") {
                    // Only scenario when the return is false
                    return BrsBoolean.False;
                }
                BrsDevice.deviceInfo.captionMode = newMode;
                this.port?.pushMessage(new RoDeviceInfoEvent({ Mode: newMode, Mute: false }));
                postMessage({ captionMode: newMode });
            }
            // Roku always returns true, even when get an invalid mode
            return BrsBoolean.True;
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
            if (opt === "mode") {
                return new BrsString(BrsDevice.deviceInfo.captionMode);
            } else if (opt === "muted") {
                return new BrsString("Unmuted");
            } else if (!CaptionOptions.has(opt)) {
                return new BrsString("");
            }
            const styleOption = BrsDevice.deviceInfo.captionStyle.find((s) => s.id === opt);
            return new BrsString(styleOption?.style ?? "Default");
        },
    });

    /** Checks if the device can decode and play the specified audio format. */
    private readonly canDecodeAudio = new Callable("canDecodeAudio", {
        signature: {
            args: [new StdlibArgument("options", ValueKind.Dynamic)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, options: RoAssociativeArray) => {
            if (options instanceof RoAssociativeArray) {
                const decode: FlexObject = {};
                const codecs = BrsDevice.deviceInfo.audioCodecs as string[];
                const codec = options.get(new BrsString("codec"));
                if (codec instanceof BrsString && codecs?.includes(codec.value.toLowerCase())) {
                    decode.result = true;
                } else {
                    decode.result = false;
                    if (codecs) {
                        decode.updated = "codec";
                        decode.codec = new RoArray(codecs.map((c: string) => new BrsString(c)));
                    }
                }
                return toAssociativeArray(decode);
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
        impl: (_: Interpreter) => {
            // This method is deprecated in Roku
            return toAssociativeArray({
                AAC: "2:0:0:0:",
                ALAC: "6:0:0:0:",
                FLAC: "6:0:0:0:",
                LPCM: "2:0:0:1:",
                MPEG: "2:0:0:0:",
                OPUS: "6:0:0:0:",
                VORBIS: "6:0:0:0:",
                WMA: "6:0:0:0:",
                WMAPRO: "8:0:0:0:",
            });
        },
    });

    /** Lists each video decoder supported by the device.*/
    private readonly getVideoDecodeInfo = new Callable("getVideoDecodeInfo", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            // This method is deprecated in Roku
            return toAssociativeArray({ H264: "", MPEG2: "", MPEG4: "" });
        },
    });

    /** Checks if the device can decode and play the specified video format. */
    private readonly canDecodeVideo = new Callable("canDecodeVideo", {
        signature: {
            args: [new StdlibArgument("options", ValueKind.Dynamic)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, options: RoAssociativeArray) => {
            if (options instanceof RoAssociativeArray) {
                const formats = BrsDevice.deviceInfo.videoFormats;
                const codecs = formats?.get("codecs") ?? [];
                const containers = formats?.get("containers") ?? [];
                const codec = options.get(new BrsString("codec"));
                const container = options.get(new BrsString("container"));
                const decode: FlexObject = {};
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
                    decode.updated = updated;
                    if (updated === "codec") {
                        decode.updated = new RoArray(codecs.map((c: string) => new BrsString(c)));
                    } else {
                        decode.updated = "n.a.";
                    }
                }
                decode.result = canDecode;
                return toAssociativeArray(decode);
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

    /** Returns whether the Auto Adjust Display Refresh Rate setting is enabled on a device */
    private readonly IsAutoAdjustRefreshRateEnabled = new Callable("isAutoAdjustRefreshRateEnabled", {
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
        impl: (_: Interpreter) => {
            return new Int32((Date.now() - BrsDevice.lastKeyTime) / 1000);
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
        impl: (_: Interpreter) => {
            const connInfo: ConnectionInfo = BrsDevice.deviceInfo.connectionInfo;
            return new BrsString(connInfo.type);
        },
    });

    /** Checks for the information associated with the hardware's connection. */
    private readonly getConnectionInfo = new Callable("getConnectionInfo", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            const connInfo: ConnectionInfo = BrsDevice.deviceInfo.connectionInfo;
            const result: FlexObject = {
                active: 1,
                default: 1,
                type: connInfo.type,
                name: connInfo.name,
                gateway: connInfo.gateway,
                quality: connInfo.quality,
            };
            if (connInfo.type === "WiFiConnection" && connInfo.ssid) {
                result.ssid = connInfo.ssid;
                result.protocol = "IEEE 802.11g";
                result.signal = -140;
            }
            const ips = BrsDevice.deviceInfo.localIps;
            if (ips.length > 0) {
                ips.some((iface: string) => {
                    if (iface.split(",")[0] === connInfo.name) {
                        result.ip = iface.split(",")[1];
                        return true;
                    }
                    return false;
                });
            }
            result.ipv6 = new RoArray([]);
            if (connInfo.dns) {
                for (const [index, dns] of connInfo.dns.entries()) {
                    result[`dns.${index}`] = dns;
                }
            }
            result.mac = "00:00:00:00:00:00";
            result.expectedThroughput = 129;
            return toAssociativeArray(result);
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
        impl: (_: Interpreter) => {
            const result: FlexObject = {};
            for (const iface of BrsDevice.deviceInfo.localIps) {
                result[iface.split(",")[0]] = iface.split(",")[1];
            }
            return toAssociativeArray(result);
        },
    });

    /** Checks the IP address assigned to the device by your internet service provider (ISP). */
    private readonly getExternalIp = new Callable("getExternalIp", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            let ip = "";
            try {
                ip = getExternalIp();
            } catch (err: any) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`warning,${err.message}`);
                }
            }
            return new BrsString(ip);
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

    /** Checks if the device's system clock is valid. */
    private readonly isClockValid = new Callable("isClockValid", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.True;
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
}
// Helper Functions
function generateUUID(): string {
    if (!("randomUUID" in crypto)) {
        return uuidv4();
    }
    return crypto.randomUUID();
}
