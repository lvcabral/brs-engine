const { execute } = require("../../lib/");
const BrsError = require("../../lib/Error");

const { createMockStreams, resourceFile, allArgs } = require("./E2ETests");

describe("end to end standard libary", () => {
    let outputStreams;

    beforeAll(() => {
        outputStreams = createMockStreams();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    test("stdlib/strings.brs", () => {
        return execute(resourceFile("stdlib", "strings.brs"), outputStreams).then(() => {
            expect(
                allArgs(outputStreams.stdout.write).filter(arg => arg !== "\n")
            ).toEqual([
                "MIXED CASE",
                "mixed case",
                "12359",
                "ぇ",
                "Mixed",
                "Case",
                "10",
                "ed",
                "7",
                "10",
                " 3.4",
                "-3",
                "12.34"
            ]);
        });
    });

    test("stdlib/math.brs", () => {
        return execute(resourceFile("stdlib", "math.brs"), outputStreams).then(() => {
            expect(
                allArgs(outputStreams.stdout.write).filter(arg => arg !== "\n")
            ).toEqual([
                "22.19795",
                "2.85647",
                "3.342155",
                "0.4636476",
                "0.7073883",
                "0.9999997",
                "0.999204"
            ]);
        });
    })
});
