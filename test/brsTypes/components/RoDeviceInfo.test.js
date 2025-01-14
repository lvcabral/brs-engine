// Mock the resolvedOptions method of Intl.DateTimeFormat
global.Intl.DateTimeFormat = jest.fn().mockImplementation(() => {
    return {
        resolvedOptions: () => {
            return {
                timeZone: "America/Fortaleza",
            };
        },
    };
});
const brs = require("../../../bin/brs.node");
const { Interpreter } = brs;
const { RoDeviceInfo, RoAssociativeArray, RoArray, BrsBoolean, BrsString, Int32 } = brs.types;

describe("RoDeviceInfo", () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        process.env = { ...OLD_ENV };
        interpreter = new Interpreter();
    });

    afterAll(() => {
        process.env = OLD_ENV;
    });

    describe("comparisons", () => {
        it("is equal to nothing", async () => {
            let a = new RoDeviceInfo(interpreter);
            expect(a.equalTo(a)).toBe(BrsBoolean.False);
        });
    });

    describe("stringification", () => {
        it("lists stringified value", async () => {
            let deviceInfo = new RoDeviceInfo(interpreter);
            expect(deviceInfo.toString()).toEqual(`<Component: roDeviceInfo>`);
        });
    });

    describe("methods", () => {
        beforeEach(() => {
            interpreter = new Interpreter();
        });

        describe("getModel", () => {
            it("should return a fake model number", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getModel");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(new BrsString("8000X"));
            });
        });
        describe("getModelDisplayName", () => {
            it("should return a fake model display name", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getModelDisplayName");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(new BrsString("Roku (8000X)"));
            });
        });
        describe("getModelType", () => {
            it("should return a fake model type", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getModelType");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(new BrsString("STB"));
            });
        });
        describe("getModelDetails", () => {
            it("should return a fake model's details", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getModelDetails");

                let aa = await method.call(interpreter);

                expect(method).toBeTruthy();
                expect(aa.get(new BrsString("Manufacturer"))).toEqual(new BrsString(""));
                expect(aa.get(new BrsString("VendorName"))).toEqual(new BrsString("Roku"));
            });
        });
        describe("getFriendlyName", () => {
            it("should return a fake friendly name ", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getFriendlyName");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(
                    new BrsString("BrightScript Engine Library")
                );
            });
        });
        describe("getOSVersion", () => {
            it("should return a fake OS version", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getOSVersion");

                let aa = await method.call(interpreter);
                let items = aa.getMethod("items");
                let result = await items.call(interpreter);

                expect(method).toBeTruthy();
                expect(items).toBeTruthy();
                expect(result.elements.length).toEqual(4);
            });
        });
        describe("getVersion", () => {
            it("should return a fake version number", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getVersion");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(new BrsString("48F.04E12221A"));
            });
        });
        describe("getRIDA", () => {
            it("should return a fake RIDA", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getRIDA");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(
                    new BrsString("f51ac698-bc60-4409-aae3-8fc3abc025c4")
                );
            });
        });
        describe("isRIDADisabled", () => {
            it("should return true when disabling RIDA", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("isRIDADisabled");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(BrsBoolean.True);
            });
        });
        describe("getChannelClientId", () => {
            it("should get fake channel client id", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getChannelClientId");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(
                    new BrsString("6c5bf3a5-b2a5-4918-824d-7691d5c85364")
                );
            });
        });
        describe("getUserCountryCode", () => {
            it("should return a user's country code from local environment", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getUserCountryCode");

                process.env.LOCALE = "en_US";

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(new BrsString("US"));
            });
        });
        describe("getRandomUUID", () => {
            it("should return a random UUID", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getRandomUUID");

                let uuid = await method.call(interpreter);
                expect(method).toBeTruthy();
                expect(uuid).toBeTruthy();
            });
        });
        describe("getTimeZone", () => {
            it("should return current time zone from local environment", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getTimeZone");

                process.env.TZ = "PST";

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(new BrsString("America/Fortaleza"));
            });
        });
        describe("hasFeature", () => {
            it("should return false when feature is not available", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("hasFeature");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter, new BrsString("soundbar_hardware"))).toEqual(
                    BrsBoolean.False
                );
            });
        });
        describe("hasFeature", () => {
            it("should return true when running under the brs-engine", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("hasFeature");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter, new BrsString("simulation_engine"))).toEqual(
                    BrsBoolean.True
                );
            });
        });
        describe("getCurrentLocale", () => {
            it("should locale settings from local environment", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getCurrentLocale");

                process.env.LOCALE = "en_US";

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(new BrsString("en_US"));
            });
        });
        describe("getCountryCode", () => {
            it("should return country code from local environment", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getCountryCode");

                process.env.LOCALE = "en_US";

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(new BrsString("US"));
            });
        });
        describe("getPreferredCaptionLanguage", () => {
            it("should return preferred caption language", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getPreferredCaptionLanguage");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(new BrsString("eng"));
            });
        });
        describe("timeSinceLastKeyPress", () => {
            it("should return time since last key press value", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("timeSinceLastKeyPress");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(new Int32(0));
            });
        });
        describe("getDrmInfo", () => {
            it("should return fake drm info", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getDrmInfo");

                let aa = await method.call(interpreter);
                let items = aa.getMethod("items");
                let result = await items.call(interpreter);

                expect(method).toBeTruthy();
                expect(items).toBeTruthy();
                expect(result.elements).toEqual(new RoArray([]).elements);
            });
        });
        describe("getDrmInfoEx", () => {
            it("should return fake drm info ex", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getDrmInfoEx");

                let aa = await method.call(interpreter);
                let items = aa.getMethod("items");
                let result = await items.call(interpreter);

                expect(method).toBeTruthy();
                expect(items).toBeTruthy();
                expect(result.elements).toEqual(new RoArray([]).elements);
            });
        });
        describe("getCaptionsMode", () => {
            it("should fake captions mode setting to On", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getCaptionsMode");
                let setCapMethod = deviceInfo.getMethod("setCaptionsMode");

                await setCapMethod.call(interpreter, new BrsString("On"));

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(new BrsString("On"));
            });
        });
        describe("setCaptionsMode", () => {
            it("should set a valid caption mode and return true", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("setCaptionsMode");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter, new BrsString("Instant replay"))).toEqual(
                    BrsBoolean.True
                );
            });
        });
        describe("setCaptionsMode", () => {
            it("should set an invalid caption mode and return true", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("setCaptionsMode");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter, new BrsString(""))).toEqual(BrsBoolean.True);
            });
        });
        describe("getCaptionsOption", () => {
            it("should return 'Default' for any Captions Option", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getCaptionsOption");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter, new BrsString("text/color"))).toEqual(
                    new BrsString("Default")
                );
            });
        });
        describe("getCaptionsOption", () => {
            it("should return empty string for any invalid Captions Option", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getCaptionsOption");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter, new BrsString("foobar"))).toEqual(
                    new BrsString("")
                );
            });
        });
        describe("getClockFormat", () => {
            it("should return fake clock format", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getClockFormat");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(new BrsString("12h"));
            });
        });
        describe("enableAppFocusEvent", () => {
            it("should notify that event notification has not been enabled", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("enableAppFocusEvent");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter, BrsBoolean.True)).toEqual(BrsBoolean.False);
            });
        });
        describe("enableScreensaverExitedEvent", () => {
            it("should not enable screensaver exited event", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("enableScreensaverExitedEvent");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter, BrsBoolean.True)).toEqual(BrsBoolean.False);
            });
        });
        describe("enableLowGeneralMemoryEvent", () => {
            it("should not enable low memory event", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("enableLowGeneralMemoryEvent");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter, BrsBoolean.True)).toEqual(BrsBoolean.False);
            });
        });
        describe("enableValidClockEvent", () => {
            it("should not enable low memory event", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("enableValidClockEvent");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter, BrsBoolean.True)).toEqual(BrsBoolean.False);
            });
        });
        describe("getGeneralMemoryLevel", () => {
            it("return general memory level", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getGeneralMemoryLevel");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(new BrsString("normal"));
            });
        });
        describe("isStoreDemoMode", () => {
            it("should enable store demo mode to true", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("isStoreDemoMode");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(BrsBoolean.False);
            });
        });
        describe("getLinkStatus", () => {
            it("should enable link status to true", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getLinkStatus");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(BrsBoolean.True);
            });
        });
        describe("enableLinkStatusEvent", () => {
            it("should return false as the Link Status Event is not supported", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("enableLinkStatusEvent");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter, BrsBoolean.True)).toEqual(BrsBoolean.False);
            });
        });
        describe("getConnectionType", () => {
            it("should return a fake connection type", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getConnectionType");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(new BrsString("WiredConnection"));
            });
        });
        describe("getExternalIp", () => {
            it("should return a fake external ip address", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getExternalIp");

                expect(method).toBeTruthy();
                let result = await method.call(interpreter);
                expect(result).toBeInstanceOf(BrsString);
                expect(interpreter.isValidIp(result.value)).toBe(true);
            });
        });
        describe("getIPAddrs", () => {
            it("should return a model number", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getIPAddrs");

                let aa = await method.call(interpreter);
                let items = aa.getMethod("items");
                let result = await items.call(interpreter);

                expect(method).toBeTruthy();
                expect(items).toBeTruthy();
                expect(result.elements.length).toBeGreaterThan(0);
            });
        });
        describe("getConnectionInfo", () => {
            it("should return connection info map", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getConnectionInfo");

                let aa = await method.call(interpreter);
                let items = aa.getMethod("items");
                let result = await items.call(interpreter);

                expect(method).toBeTruthy();
                expect(items).toBeTruthy();
                expect(result.elements.length).toBeGreaterThan(9);
            });
        });
        describe("getDisplayType", () => {
            it("should return fake display type", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getDisplayType");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(new BrsString("HDTV"));
            });
        });
        describe("getDisplayMode", () => {
            it("should return fake display mode", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getDisplayMode");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(new BrsString("720p"));
            });
        });
        describe("getDisplayAspectRatio", () => {
            it("should return a model number", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getDisplayAspectRatio");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(new BrsString("16x9"));
            });
        });
        describe("getDisplaySize", () => {
            it("should return fake display size", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getDisplaySize");
                let aa = await method.call(interpreter);
                let items = aa.getMethod("items");
                let result = await items.call(interpreter);

                expect(method).toBeTruthy();
                expect(items).toBeTruthy();
                expect(result.elements.length).toEqual(2);
            });
        });
        describe("getVideoMode", () => {
            it("should return a fake video mode spec.", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getVideoMode");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(new BrsString("720p"));
            });
        });
        describe("getDisplayProperties", () => {
            it("should return fake display width and height", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getDisplayProperties");

                let aa = await method.call(interpreter);
                let items = aa.getMethod("items");
                let result = await items.call(interpreter);

                expect(method).toBeTruthy();
                expect(items).toBeTruthy();
                expect(result.elements.length).toEqual(11);
            });
        });
        describe("getSupportedGraphicsResolutions", () => {
            it("should return fake supported gfx resolution info.", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getSupportedGraphicsResolutions");
                let array = await method.call(interpreter);

                expect(array).toBeTruthy();
                expect(array.elements.length).toEqual(3);
            });
        });
        describe("canDecodeVideo", () => {
            it("return fake decoded video info", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("canDecodeVideo");
                let config = new RoAssociativeArray([
                    { name: new BrsString("codec"), value: new BrsString("") },
                ]);
                let aa = await method.call(interpreter, config);
                expect(method).toBeTruthy();
                expect(aa.get(new BrsString("result"))).toEqual(BrsBoolean.False);
            });
        });
        describe("getUIResolution", () => {
            it("should return fake ui resolution info.", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getUIResolution");
                let aa = await method.call(interpreter);
                let items = aa.getMethod("items");
                let result = await items.call(interpreter);

                expect(method).toBeTruthy();
                expect(items).toBeTruthy();
                expect(result.elements.length).toEqual(3);
            });
        });

        describe("getGraphicsPlatform", () => {
            it("should return fake gfx platform name", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getGraphicsPlatform");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(new BrsString("opengl"));
            });
        });
        describe("getModel", () => {
            it("should return a model number", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getModel");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(new BrsString("8000X"));
            });
        });
        describe("enableCodecCapChangedEvent", () => {
            it("should not enable codec cap changed event", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("enableCodecCapChangedEvent");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter, BrsBoolean.True)).toEqual(BrsBoolean.False);
            });
        });
        describe("getAudioOutputChannel", () => {
            it("should return fake audio output channel", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getAudioOutputChannel");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(new BrsString("Stereo"));
            });
        });
        describe("getSoundEffectsVolume", () => {
            it("should return a default sound effect volume", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("getSoundEffectsVolume");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(new Int32(40));
            });
        });
        describe("isAudioGuideEnabled", () => {
            it("should check that audio guide is disabled", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("isAudioGuideEnabled");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(BrsBoolean.False);
            });
        });
        describe("enableAudioGuideChangedEvent", () => {
            it("should return false as enabling audio guide change event is not supported", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("enableAudioGuideChangedEvent");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter, BrsBoolean.True)).toEqual(BrsBoolean.False);
            });
        });
        describe("isAutoPlayEnabled", () => {
            it("should return false as auto play is not supported", async () => {
                let deviceInfo = new RoDeviceInfo(interpreter);
                let method = deviceInfo.getMethod("isAutoPlayEnabled");

                expect(method).toBeTruthy();
                expect(await method.call(interpreter)).toEqual(BrsBoolean.False);
            });
        });
    });
});
