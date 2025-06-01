const { execute, createMockStreams, resourceFile, allArgs } = require("./E2ETests");
const fakeTimer = require("@sinonjs/fake-timers");

describe("end to end brightscript functions", () => {
    let outputStreams;
    let clock;
    const OLD_ENV = process.env;

    beforeAll(() => {
        outputStreams = createMockStreams();
        outputStreams.root = __dirname + "/resources";
    });

    beforeEach(() => {
        clock = fakeTimer.install({ now: 1547072370937, toFake: ["Date", "performance"] });
        process.env = { ...OLD_ENV };
    });

    afterEach(() => {
        clock.uninstall();
        jest.resetAllMocks();
    });

    afterAll(() => {
        jest.restoreAllMocks();
        process.env = OLD_ENV;
    });

    test("components/roArray.brs", async () => {
        await execute([resourceFile("components", "roArray.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "array length:  4",
            "last element: sit",
            "first element: lorem",
            "can delete elements: true",
            "can empty itself: true",
            "array length:  5",
            "array capacity:  5",
            "no change after push:  5",
            "can empty itself: true",
            "same capacity after clear:  5",
            "camel,duck,elephant",
            "camel,duck",
            "bison,camel,duck,elephant",
            "duck,elephant",
            "camel,duck",
            "ant,bison,camel,duck,elephant",
        ]);
    });

    test("components/roAssociativeArray.brs", async () => {
        await execute([resourceFile("components", "roAssociativeArray.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "AA size:  3",
            "AA keys size:  3",
            "AA items size:  3",
            "can delete elements: true",
            "can look up elements: true",
            "can look up elements (brackets): true",
            "can case insensitive look up elements: true",
            "can check for existence: true",
            "items() example key: bar",
            "items() example value:  5",
            "key is not found if sensitive mode is enabledfalse",
            "key exits with correct casingvalue1",
            "lookup uses mode case toovalue1",
            "lookupCI ignore mode casevalue1",
            "can empty itself: true",
            "saved key: DD",
            "saved key after accessing by dot: dd",
            "saved key after accessing by index: Dd",
            "AA keys size:  1",
        ]);
    });

    test("components/ifEnum.brs", async () => {
        await execute([resourceFile("components", "ifEnum.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "testing roArray ifEnum",
            "isNext Not Empty:true",
            "isEmpty:true",
            "isNext Empty:false",
            "isNext before Reset:true",
            "isNext after Reset:true",
            "a",
            "b",
            "c",
            "c",
            "testing Linked List",
            "isEmpty = true",
            "isNext Empty = false",
            "getIndex() invalid",
            "next() invalid",
            "isEmpty = false",
            "isNext before Reset = false",
            "isNext after ResetIndex() = false",
            "isNext after Reset() = true",
            "a",
            "b",
            "c",
            "d",
            "c",
            "isNext = true",
            "a",
            "b",
            "c",
            "d",
            "testing AA ifEnum",
            "isNext before Reset:true",
            "isNext after Reset:true",
            "a",
            "b",
            "c",
            "d",
            "9",
            "x",
            "isEmpty:false",
            "isNext Empty:false",
            "isNext before Reset:true",
            "isNext after Reset:true",
            "a",
            "b",
            "c",
            "Reset()",
            "a",
            "b",
            "c",
            "d",
            "x",
            "9",
        ]);
    });

    test("components/roByteArray.brs", async () => {
        await execute([resourceFile("components", "roByteArray.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "true",
            "true",
            "true",
            "true",
            "true",
            "true",
            "true",
            " 461707669",
            "0x1b851995",
            "00FFD80100FF",
            "true",
            "00FFD80100FF",
            "count: 0 capacity: 0",
            "count: 1 capacity: 16 diff: 16",
            "count: 17 capacity: 32 diff: 16",
            "count: 33 capacity: 48 diff: 16",
            "count: 49 capacity: 72 diff: 24",
            "count: 73 capacity: 108 diff: 36",
            "count: 109 capacity: 162 diff: 54",
            "count: 163 capacity: 243 diff: 81",
            "count: 244 capacity: 364 diff: 121",
            "count: 365 capacity: 546 diff: 182",
            "count: 547 capacity: 819 diff: 273",
            "count: 820 capacity: 1228 diff: 409",
            "count: 1229 capacity: 1842 diff: 614",
            "count: 1843 capacity: 2763 diff: 921",
            "count: 2764 capacity: 4144 diff: 1381",
            "true",
            "true",
            "true",
            "true",
            "true",
            "true",
            "true",
            "true",
            "true",
            `!"#$%&'()*❤`,
            "can empty itself: true capacity: 13",
            "BA count: 4001 capacity: 4144",
            "BA count: 4 capacity: 4144",
            "count: 0 capacity: 0 resizable: true new",
            "count: 4 capacity: 4 resizable: true fromHexString",
            "count: 4 capacity: 5 resizable: false setResize, 5, false",
            "count: 4 capacity: 7 resizable: false setResize, 7, false",
            "count: 1 capacity: 1 resizable: false bnw.setResize, 1, false",
            "count: 1 capacity: 1 resizable: false bnw.fromHex() 5",
            "count: 1 capacity: 3 resizable: true bnw.setResize, 3, true",
            "count: 7 capacity: 21 resizable: true bnw setup",
            "count: 4 capacity: 7 resizable: false append",
            "count: 5 capacity: 7 resizable: false push",
            "count: 6 capacity: 7 resizable: false push",
            "count: 7 capacity: 7 resizable: false push",
            "count: 7 capacity: 7 resizable: false push",
            "count: 7 capacity: 7 resizable: false unshift",
            "count: 7 capacity: 7 resizable: false append",
            "count: 7 capacity: 7 resizable: false append",
            "count: 2 capacity: 7 resizable: false 5 pop()",
        ]);
    });

    test("components/roDateTime.brs", async () => {
        await execute([resourceFile("components", "roDateTime.brs")], outputStreams);

        const today = new Date(Date.now());
        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            `Today: ${today.getUTCFullYear()}-${today.getUTCMonth() + 1}-${today.getUTCDate()}`,
            "No Param: Friday November 12, 2010",
            "Long Date: Friday November 12, 2010",
            "Short Week Day: Fri November 12, 2010",
            "No Week Day: November 12, 2010",
            "Short Month: Friday Nov 12, 2010",
            "Short Month Short Weekday: Fri Nov 12, 2010",
            "Short Month No Weekday: Nov 12, 2010",
            "Short Date: 11/12/10",
            "Short Date Dashes: 11-12-10",
            "Weekday: Friday",
            "Day of Week:  5",
            "Day of Month:  12",
            "Month:  11",
            "Year:  2010",
            "Hours:  13",
            "Minutes:  14",
            "Seconds:  15",
            "Last Day of Month:  30",
            "Milliseconds:  160",
            "ISO String UTC: 2010-11-12T13:14:15Z",
            "Empty Format: Friday November 12, 2010",
            "Invalid Format: Friday November 12, 2010",
            "------ New asDateStringLoc ------",
            "DateLoc - full: Friday, November 12, 2010",
            "DateLoc - long: November 12, 2010",
            "DateLoc - medium: Nov 12, 2010",
            "DateLoc - short: 11/12/10",
            "DateLoc - custom: 12:November:10",
            "DateLoc - custom: 11.Fri/2010",
            "DateLoc - custom: Before11.Fri/2010",
            "DateLoc - custom: 11.Fri/2010After",
            "DateLoc - EMMANUEL: E 11 ANUEL",
            "DateLoc - EMMANUEL: EMMANUEL",
            "DateLoc - invalid: something",
            "------ New asTimeStringLoc ------",
            "TimeLoc - short: 1:14 pm",
            "TimeLoc - short-h12: 1:14 pm",
            "TimeLoc - short-h24: 13:14",
            "TimeLoc - custom: 1 pm",
            "TimeLoc - custom: 13 pm",
            "TimeLoc - empty: 1:14 pm",
            "TimeLoc - no seconds: 1:14:ss pm",
            "------ New Long Integer support ------",
            "2038-01-19T03:14:07Z",
            "1914-09-25T18:31:44Z",
            "2050-11-01T01:00:00Z",
            " 2147483647",
            " 2550877200",
        ]);
    });

    test("components/roTimespan.brs", async () => {
        await execute([resourceFile("components", "roTimespan.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "can return seconds from date until now:  373447701",
            "can return seconds from date until now:  373447701",
            "can return seconds from date until now:  373447649",
            "can return seconds from date until now:  373444829",
            "can return seconds from date until now:  373426829",
            "can return seconds from date until now:  373426829",
            "can return seconds from date until now:  372649229",
            "can return seconds from date until now:  346383629",
            "can return 2077252342 for date that can't be parsed:  2077252342",
        ]);
    });

    test("components/roRegex.brs", async () => {
        await execute([resourceFile("components", "roRegex.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "HeLlO_123_WoRlD is match of hello_[0-9]*_world: true",
            "goodbye_123_WoRlD isn't match of hello_[0-9]*_world: true",
            "Replacing ',' in 2019,03,26 by '-' on first occurrence: 2019-03,26",
            "Replacing ',' in 2019,03,26 by '-' on all occurrences: 2019-03-26",
            "Split by ',': [ 2019 03 26 ]",
            "First match: [ 123 ]",
            "All matches: [",
            "[ 123 ]",
            "[ 456 ]",
            "[ 789 ]",
            " ]",
            "Matches with groups: [",
            "[ abx, bx ]",
            "[ aby, by ]",
            " ]",
            "${variable}variable",
        ]);
    });

    test("components/roRegistry.brs", () => {
        return execute([resourceFile("components", "roRegistry.brs")], outputStreams).then(() => {
            expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
                "true",
                "true",
                ".value",
                "true",
                `<Component: roList> =\n(\n    "option1"\n    "option2"\n)`,
                "true",
                "true",
                "false",
                `<Component: roAssociativeArray> =\n` +
                    `{\n` +
                    `    option1: ".value"\n` +
                    `    option2: "other"\n` +
                    `}`,
                `<Component: roList> =\n(\n    "Transient"\n)`,
                " 32723",
            ]);
        });
    });

    test("components/roString.brs", async () => {
        await execute([resourceFile("components", "roString.brs")], outputStreams);

        expect(allArgs(outputStreams.stderr.write)).toEqual([]);
        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "hello",
            "bar",
            "bar",
            "foo",
            "true", // comparison
            "false", // comparison
            "false", // comparison
            "true", // comparison
            "true", // comparison
            " 5", // length
            "b", // split("/")[1]
            "%F0%9F%90%B6", // dog emoji, uri-encoded
            "🐶", // uri-encoded dog emoji, decoded
            "true", // isEmpty for empty string
            "false", // isEmpty for filled string
            "true", // startsWith no position
            "true", // startsWith with position
            "true", // endsWith no position
            "true", // endsWith with position,
            "%0 %9 %8 %7 %6 %5 d c b a",
            "%0 a b c d e f %7 %8 %9",
        ]);
    });

    test("components/roXMLElement.brs", () => {
        return execute([resourceFile("components", "roXMLElement.brs")], outputStreams).then(() => {
            expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
                "xmlParser = <Component: roXMLElement>",
                "type(xmlParser) = roXMLElement",
                "parse bad xml string, result = false",
                "parse good xml string, result = true",
                "getName() = tag1",
                `getAttributes() = <Component: roAssociativeArray> =\n` +
                    `{\n` +
                    `    attr1: "0"\n` +
                    `    id: "someId"\n` +
                    `}`,
                "children type = roXMLList",
                `getNamedElementsCi("child1") count =  2`,
                "name of first child  = Child1",
                "mame of second child = CHILD1",
                "<Component: roXMLElement>",
            ]);
        });
    });

    test("components/roIntrinsics.brs", async () => {
        await execute([resourceFile("components", "roIntrinsics.brs")], outputStreams);

        expect(allArgs(outputStreams.stderr.write)).toEqual([]);
        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "Boolean object A true",
            "Boolean object B false",
            "Comparing true = false should be false false",
            "Double value  123.456",
            "Double value * 2  246.912",
            "Float object  789.012",
            "Float object * 10  7890.12",
            "Integer object  23",
            "Integer object times itself  529",
            "Double to string 123.456",
            "Float to string 789.012",
            "Integer to string 23",
            "LongInteger object typeroLongInteger",
            "LongInteger to string 2000111222333",
            "Integer truncated from LongInteger  2147483647",
            "Integer converted from LongInteger -1343537603",
        ]);
    });

    test("components/roInvalid.brs", async () => {
        await execute([resourceFile("components", "roInvalid.brs")], outputStreams);

        expect(allArgs(outputStreams.stderr.write)).toEqual([]);
        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "roInvalid",
            "<Component: roInvalid>",
            "true",
        ]);
    });

    test("components/roPath.brs", async () => {
        await execute([resourceFile("components", "roPath.brs")], outputStreams);
        expect(allArgs(outputStreams.stderr.write)).toEqual([]);
        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "appMain",
            ".brs",
            "appMain.brs",
            "pkg:/source/",
            "pkg:",
            "prefix:pkg:/source/appMain.brs",
            "pkg:/source/appMain.brs:suffix",
            "true",
            "true",
            "false",
            "false",
            "calc",
            ".exe",
            "calc.exe",
            "c:/windows/system32/",
            "c:",
            "baby",
            ".zip",
            "baby.zip",
            "http:/www.google.com/",
            "http:",
            "true",
            "www.google",
            ".com",
            "www.google.com",
            "http:/",
            "http:",
            "false",
            "invalid",
            "invalid",
            "invalid",
            "invalid",
            "invalid",
            "String",
        ]);
    });

    test("components/roDeviceInfo.brs", async () => {
        const currTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
        process.env.LOCALE = "en_US";

        await execute([resourceFile("components", "roDeviceInfo.brs")], outputStreams);
        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "8000X",
            "Roku (8000X)",
            "STB",
            " 5",
            "BrightScript Engine Library",
            " 4",
            "999.99E99999A",
            "f51ac698-bc60-4409-aae3-8fc3abc025c4",
            "true",
            "6c5bf3a5-b2a5-4918-824d-7691d5c85364",
            " 36",
            currTZ,
            "false",
            "true",
            "true",
            "true",
            "false",
            "en_US",
            "US",
            "US",
            "en",
            " 0",
            " 1",
            " 0",
            "true",
            "On",
            "Default",
            "12h",
            "false",
            "false",
            "false",
            "normal",
            "false",
            "true",
            "false",
            "WiredConnection",
            "true",
            " 1",
            "Excellent",
            "HDTV",
            "720p",
            "16x9",
            " 2",
            "720p",
            " 11",
            " 3",
            "true",
            "invalid",
            " 3",
            "opengl",
            "true",
            "false",
            "false",
            "Stereo",
            " 9",
            "true",
            " 50",
            "false",
            "false",
            "false",
            "false",
        ]);
    });

    test("components/roAppInfo.brs", async () => {
        await execute([resourceFile("components", "roAppInfo.brs")], outputStreams);
        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "dev",
            "true",
            "0.0.0",
            "BRS App",
            "",
            "34c6fceca75e456f25e7e99531e2425c6c1de443",
            "0",
        ]);
    });

    test("components/roAppManager.brs", async () => {
        const deepLink = new Map([
            ["contentId", "12345678"],
            ["mediaType", "movie"],
        ]);
        await execute([resourceFile("components", "roAppManager.brs")], outputStreams, deepLink);
        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "Content Id: 12345678",
            "Media Type: movie",
            "Uptime: <Component: roTimespan>",
            "ScreenSaverTimeout: 0",
            "Last Exit Code: EXIT_UNKNOWN",
        ]);
    });

    test("components/roAppMemoryMonitor.brs", async () => {
        await execute([resourceFile("components", "roAppMemoryMonitor.brs")], outputStreams);
        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual(["true", "true", "true"]);
    });

    test("components/roRemoteInfo.brs", async () => {
        await execute([resourceFile("components", "roRemoteInfo.brs")], outputStreams);
        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "--- Remote Info ---",
            "Model:  0",
            "IsAwake: false",
            "--- Remote Features ---",
            "wifi remote? true",
            "bluetooth remote? false",
            "motion remote? false",
            "audio remote? false",
            "voice capture remote? false",
            "find remote remote? false",
            "hasMuteSwitch? false",
            "Mute Switch? true",
            "--- Simulator Only Features ---",
            "Keyboard? false",
            "GamePad? false",
        ]);
    });

    test("components/roEvents.brs", async () => {
        await execute([resourceFile("components", "roEvents.brs")], outputStreams);
        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "roCECStatus.isActiveSource() = true",
            "roHdmiStatus.isConnected() = true",
            "roHdmiStatus.GetHdcpVersion() = 1.4",
            "roHdmiStatus.IsHdcpActive() = true",
            "roChannelStoreEvent",
            `<Component: roArray> =\n` + `[\n` + `]`,
            "<Interface: ifChannelStoreEvent>",
            "roDeviceInfoEvent",
            "roDeviceInfoEvent.isCaptionModeChanged = true",
            "roDeviceInfoEvent.isStatusMessage = false",
            `<Component: roAssociativeArray> =\n` + "{\n" + `    Mode: "Off"\n` + `    Mute: false\n` + `}`,
            "<Interface: ifroDeviceInfoEvent>",
            "Invalid",
        ]);
    });

    test("components/roURLTransfer.brs", async () => {
        await execute([resourceFile("components", "roURLTransfer.brs")], outputStreams);
        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "BrightScript Simulation Engine - Run Roku apps on Browsers and Node.js",
            "Repository: https://github.com/lvcabral/brs-engine",
            "Website:    https://lvcabral.com/brs/",
            "The status was:  201",
            "The target IP was: Valid",
            "The response was: Employee is SW Engineer",
        ]);
    });

    test("components/roSocketAddress.brs", async () => {
        await execute([resourceFile("components", "roSocketAddress.brs")], outputStreams);
        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "stream socket test",
            "------ no address ------",
            "socket address - getHostName()   --> 0.0.0.0",
            "socket address - getPort()       -->  0",
            "socket address - isAddressValid()--> true",
            "------ invalid IP with valid port ------",
            "socket address - getHostName()   --> 192.168.1.256",
            "socket address - getPort()       -->  8080",
            "socket address - isAddressValid()--> false",
            "------ invalid address with valid port ------",
            "socket address - getHostName()   --> @#$$%",
            "socket address - getPort()       -->  999",
            "socket address - isAddressValid()--> false",
            "------ invalid address with invalid port ------",
            "socket address - getHostName()   --> @#$$%",
            "socket address - getPort()       -->  777",
            "socket address - isAddressValid()--> false",
            "------ host address no port ------",
            "socket address - getHostName()   --> roku.com",
            "socket address - getPort()       -->  777",
            "socket address - isAddressValid()--> true",
            "------ host address with port ------",
            "socket address - getHostName()   --> lvcabral.com",
            "socket address - getPort()       -->  3070",
            "socket address - isAddressValid()--> true",
            "------ IP address no port ------",
            "socket address - getHostName()   --> 192.168.1.70",
            "socket address - getPort()       -->  3070",
            "socket address - isAddressValid()--> true",
            "------ IP address with port ------",
            "socket address - getHostName()   --> 192.168.1.30",
            "socket address - getPort()       -->  6502",
            "socket address - isAddressValid()--> true",
            "------ Set valid port ------",
            "socket address - getHostName()   --> 192.168.1.30",
            "socket address - getPort()       -->  8080",
            "socket address - isAddressValid()--> true",
            "------ Set negative port ------",
            "socket address - getHostName()   --> 192.168.1.30",
            "socket address - getPort()       -->  65535",
            "socket address - isAddressValid()--> true",
            "------ Set huge port ------",
            "socket address - getHostName()   --> 192.168.1.30",
            "socket address - getPort()       -->  25398",
            "socket address - isAddressValid()--> true",
            "------ Set valid host name ------",
            "socket address - getHostName()   --> github.com",
            "socket address - getPort()       -->  25398",
            "socket address - isAddressValid()--> true",
            "------ Set invalid host name ------",
            "socket address - getHostName()   --> github.com:8080",
            "socket address - getPort()       -->  25398",
            "socket address - isAddressValid()--> false",
        ]);
    });
});
