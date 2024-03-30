const { execute } = require("../../lib/");
const { createMockStreams, resourceFile, allArgs } = require("./E2ETests");
const lolex = require("lolex");

describe("end to end brightscript functions", () => {
    let outputStreams;
    let clock;

    beforeAll(() => {
        clock = lolex.install({ now: 1547072370937 });
        outputStreams = createMockStreams();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    afterAll(() => {
        clock.uninstall();
        jest.restoreAllMocks();
    });

    test("components/roArray.brs", async () => {
        await execute([resourceFile("components", "roArray.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
            "array length: ",
            "4",
            "join array items: ",
            "lorem,ipsum,dolor,sit",
            "sort array items: ",
            "dolor,ipsum,lorem,sit",
            "last element: ",
            "sit",
            "first element: ",
            "dolor",
            "can delete elements: ",
            "true",
            "can empty itself: ",
            "true",
        ]);
    });

    test("components/roAssociativeArray.brs", async () => {
        await execute([resourceFile("components", "roAssociativeArray.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
            "AA size: ",
            "3",
            "AA keys size: ",
            "3",
            "AA items size: ",
            "3",
            "can delete elements: ",
            "true",
            "can look up elements: ",
            "true",
            "can look up elements (brackets): ",
            "true",
            "can case insensitive look up elements: ",
            "true",
            "can check for existence: ",
            "true",
            "items() example key: ",
            "bar",
            "items() example value: ",
            "5",
            "key is not found if sensitive mode is enabled",
            "false",
            "key exits with correct casing",
            "value1",
            "lookup uses mode case too",
            "value1",
            "lookupCI ignore mode case",
            "value1",
            "can empty itself: ",
            "true",
            "saved key: ",
            "DD",
            "saved key after accessing by dot: ",
            "dd",
            "saved key after accessing by index: ",
            "Dd",
            "AA keys size: ",
            "1",
        ]);
    });

    test("components/ifEnum.brs", async () => {
        await execute([resourceFile("components", "ifEnum.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
            "testing roArray ifEnum",
            "isNext Not Empty:",
            " ",
            "true",
            "isEmpty:",
            " ",
            "true",
            "isNext Empty:",
            " ",
            "false",
            "isNext before Reset:",
            " ",
            "true",
            "isNext after Reset:",
            " ",
            "true",
            "a",
            "b",
            "c",
            "c",
            "testing Linked List",
            "isEmpty = ",
            " ",
            "true",
            "isNext Empty = ",
            " ",
            "false",
            "getIndex() ",
            " ",
            "invalid",
            "next() ",
            " ",
            "invalid",
            "isEmpty = ",
            " ",
            "false",
            "isNext before Reset = ",
            " ",
            "false",
            "isNext after ResetIndex() = ",
            " ",
            "false",
            "isNext after Reset() = ",
            " ",
            "true",
            "a",
            "b",
            "c",
            "d",
            "c",
            "isNext = ",
            " ",
            "true",
            "a",
            "b",
            "c",
            "d",
            "testing AA ifEnum",
            "isNext before Reset:",
            " ",
            "true",
            "isNext after Reset:",
            " ",
            "true",
            "a",
            "b",
            "c",
            "d",
            "9",
            "x",
            "isEmpty:",
            " ",
            "false",
            "isNext Empty:",
            " ",
            "false",
            "isNext before Reset:",
            " ",
            "true",
            "isNext after Reset:",
            " ",
            "true",
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

    test("components/roDateTime.brs", async () => {
        await execute([resourceFile("components", "roDateTime.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
            "Full Date: ",
            "Friday November 12, 2010",
            "No Week Day: ",
            "November 12, 2010",
            "Short Date: ",
            "11/12/10",
            "Weekday: ",
            "Friday",
            "Day of Week: ",
            "5",
            "Day of Month: ",
            "12",
            "Month: ",
            "11",
            "Year: ",
            "2010",
            "Hours: ",
            "13",
            "Minutes: ",
            "14",
            "Seconds: ",
            "15",
            "Last Day of Month: ",
            "30",
            "Milliseconds: ",
            "160",
            "ISO String UTC: ",
            "2010-11-12T13:14:15Z",
        ]);
    });

    test("components/roTimespan.brs", async () => {
        await execute([resourceFile("components", "roTimespan.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
            "can return seconds from date until now: ",
            "373447701",
            "can return seconds from date until now: ",
            "373447701",
            "can return seconds from date until now: ",
            "373447649",
            "can return seconds from date until now: ",
            "373444829",
            "can return seconds from date until now: ",
            "373426829",
            "can return seconds from date until now: ",
            "373426829",
            "can return seconds from date until now: ",
            "372649229",
            "can return seconds from date until now: ",
            "346383629",
            "can return 2077252342 for date that can't be parsed: ",
            "2077252342",
        ]);
    });

    test("components/roRegex.brs", async () => {
        await execute([resourceFile("components", "roRegex.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
            "HeLlO_123_WoRlD is match of hello_[0-9]*_world: ",
            "true",
            "goodbye_123_WoRlD isn't match of hello_[0-9]*_world: ",
            "true",
            "Replacing ',' in 2019,03,26 by '-' on first occurrence: ",
            "2019-03,26",
            "Replacing ',' in 2019,03,26 by '-' on all occurrences: ",
            "2019-03-26",
            "Split by ',': [ ",
            "2019",
            " ",
            "03",
            " ",
            "26",
            " ]",
            "First match: [ ",
            "123",
            " ]",
            "All matches: [ ",
            "[ ",
            "123",
            " ]",
            "[ ",
            "456",
            " ]",
            "[ ",
            "789",
            " ]",
            " ]",
            "Matches with groups: [ ",
            "[ ",
            "abx",
            ", ",
            "bx",
            " ]",
            "[ ",
            "aby",
            ", ",
            "by",
            " ]",
            " ]",
        ]);
    });

    test("components/roString.brs", async () => {
        await execute([resourceFile("components", "roString.brs")], outputStreams);

        expect(allArgs(outputStreams.stderr.write)).toEqual([]);
        expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
            "hello",
            "bar",
            "bar",
            "true", // comparison
            "5", // length
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
            expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
                "xmlParser = ",
                "<Component: roXMLElement>",
                "type(xmlParser) = ",
                "roXMLElement",
                "parse bad xml string, result = ",
                "false",
                "parse good xml string, result = ",
                "true",
                "getName() = ",
                "tag1",
                "getAttributes() = ",
                `<Component: roAssociativeArray> =\n` +
                    `{\n` +
                    `    id: "someId"\n` +
                    `    attr1: "0"\n` +
                    `}`,
                'getNamedElementsCi("child1") count = ',
                "2",
                "name of first child  = ",
                "Child1",
                "mame of second child = ",
                "CHILD1",
            ]);
        });
    });

    test("components/customComponent.brs", async () => {
        await execute([resourceFile("components", "customComponent.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
            "node.baseBoolField: ",
            "false",
            "node.baseIntField: ",
            "0",
            "node.normalBoolField: ",
            "true",
            "node.advancedStringField: ",
            "advancedField!",
            "node.advancedIntField: ",
            "12345",
            "node child count is: ",
            "6",
            "child id is: ",
            "normalLabel",
            "otherNode child count is: ",
            "3",
            "anotherNode child count is: ",
            "1",
            "baseRectangle width: ",
            "100",
            "baseRectangle height: ",
            "200",
        ]);
    });

    test("components/componentExtension.brs", async () => {
        await execute([resourceFile("components", "componentExtension.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
            "BaseChild init",
            "BaseComponent init",
            "ExtendedComponent start",
            "ExtendedChild init",
            "ExtendedComponent init",
            "ExtendedComponent start",
            "true", //m.top.isSubtype("ExtendedComponent")
            "true", //m.top.isSubtype("BaseComponent")
            "true", //m.top.isSubtype("Node")
            "false", // m.top.isSubtype("OtherComponent")
            "BaseComponent", //m.top.parentSubtype("ExtendedComponent")
            "Node", //m.top.parentSubtype("BaseComponent")
        ]);
    });

    test("components/roIntrinsics.brs", async () => {
        await execute([resourceFile("components", "roIntrinsics.brs")], outputStreams);

        expect(allArgs(outputStreams.stderr.write)).toEqual([]);
        expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
            "Boolean object A ",
            "true",
            "Boolean object B ",
            "false",
            "Comparing true = false should be false ",
            "false",
            "Double value ",
            "123.456",
            "Double value * 2 ",
            "246.912",
            "Float object ",
            "789.012",
            "Float object * 10 ",
            "7890.12",
            "Integer object ",
            "23",
            "Integer object times itself ",
            "529",
            "Double to string ",
            "123.456",
            "Float to string ",
            "789.012",
            "Integer to string ",
            "23",
            "LongInteger object type",
            "roLongInteger",
            "LongInteger to string ",
            "2000111222333",
        ]);
    });

    test("components/roInvalid.brs", async () => {
        await execute([resourceFile("components", "roInvalid.brs")], outputStreams);

        expect(allArgs(outputStreams.stderr.write)).toEqual([]);
        expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
            "roInvalid",
            "<Component: roInvalid>",
            "invalid",
            "true",
        ]);
    });

    test("components/roPath.brs", async () => {
        await execute([resourceFile("components", "roPath.brs")], outputStreams);
        expect(allArgs(outputStreams.stderr.write)).toEqual([]);
        expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
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
            "baby.",
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
});
