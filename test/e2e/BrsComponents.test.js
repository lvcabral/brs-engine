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
const { execute, createMockStreams, resourceFile, allArgs } = require("./E2ETests");
const lolex = require("lolex");

describe("end to end brightscript functions", () => {
    let outputStreams;
    let clock;
    const OLD_ENV = process.env;

    beforeAll(() => {
        clock = lolex.install({ now: 1547072370937 });
        outputStreams = createMockStreams();
        outputStreams.root = __dirname + "/resources";
    });

    beforeEach(() => {
        process.env = { ...OLD_ENV };
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    afterAll(() => {
        clock.uninstall();
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

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "Full Date: Friday November 12, 2010",
            "No Week Day: November 12, 2010",
            "Short Date: 11/12/10",
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
            "true", // endsWith with position
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
        ]);
    });

    test("components/roInvalid.brs", async () => {
        await execute([resourceFile("components", "roInvalid.brs")], outputStreams);

        expect(allArgs(outputStreams.stderr.write)).toEqual([]);
        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "roInvalid",
            "<Component: roInvalid>",
            "invalid",
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
        process.env.TZ = "PST";
        process.env.LOCALE = "en_US";

        await execute([resourceFile("components", "roDeviceInfo.brs")], outputStreams);
        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "8000X",
            "Roku (8000X)",
            "STB",
            " 2",
            "BrightScript Engine Library",
            " 4",
            "BSC.00E04193A",
            "f51ac698-bc60-4409-aae3-8fc3abc025c4",
            "true",
            "6c5bf3a5-b2a5-4918-824d-7691d5c85364",
            " 36",
            "America/Fortaleza",
            "false",
            "en_US",
            "US",
            "US",
            "eng",
            " 0",
            " 0",
            " 0",
            "true",
            "On",
            "Default",
            "12h",
            "true",
            "true",
            "true",
            "normal",
            "false",
            "true",
            "true",
            "WiredConnection",
            "",
            " 1",
            " 3",
            "HDTV",
            "720p",
            "16x9",
            " 2",
            "720p",
            " 7",
            " 3",
            "true",
            "invalid",
            " 3",
            "opengl",
            "true",
            "Stereo",
            " 0",
            "true",
            " 40",
            "false",
            "true",
        ]);
    });

    test("components/roAppInfo.brs", async () => {
        await execute([resourceFile("components", "roAppInfo.brs")], outputStreams);
        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "dev",
            "true",
            "0.0.1",
            "BRS App",
            "",
            "34c6fceca75e456f25e7e99531e2425c6c1de443",
            "1",
        ]);
    });
});
