const { execute } = require("../../lib/");
const { createMockStreams, resourceFile, allArgs } = require("./E2ETests");
const lolex = require("lolex")

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
        clock.uninstall()
        jest.restoreAllMocks();
    });

    test("components/roArray.brs", () => {
        return execute([ resourceFile("components", "roArray.brs") ], outputStreams).then(() => {
            expect(
                allArgs(outputStreams.stdout.write).filter(arg => arg !== "\n")
            ).toEqual([
                "array length: ", "4",
                "last element: ", "sit",
                "first element: ", "lorem",
                "can delete elements: ", "true",
                "can empty itself: ", "true"
            ]);
        });
    });

    test("components/roAssociativeArray.brs", () => {
        return execute([ resourceFile("components", "roAssociativeArray.brs") ], outputStreams).then(() => {
            expect(
                allArgs(outputStreams.stdout.write).filter(arg => arg !== "\n")
            ).toEqual([
                "AA size: ", "3",
                "AA keys size: ", "3",
                "AA items size: ", "3",
                "can delete elements: ", "true",
                "can look up elements: ", "true",
                "can check for existence: ", "true",
                "can empty itself: ", "true"
            ]);
        });
    });

    test("components/roTimespan.brs", () => {
        return execute([ resourceFile("components", "roTimespan.brs") ], outputStreams).then(() => {
            expect(
                allArgs(outputStreams.stdout.write).filter(arg => arg !== "\n")
            ).toEqual([
                "can return seconds from date until now: ",  "373447701",
                "can return 2077252342 for date that can't be parsed: ", "2077252342"
            ]);
        });
    });
});
