const fs = require("fs");
const { execute } = require("../../lib/");
const BrsError = require("../../lib/Error");

const { createMockStreams, resourceFile, allArgs } = require("./E2ETests");

describe("end to end iterables", () => {
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

    test("arrays.brs", () => {
        return execute(resourceFile("arrays.brs"), outputStreams).then(() => {
            expect(
                allArgs(outputStreams.stdout.write).filter(arg => arg !== "\n")
            ).toEqual([
                "1", "4", "9", // squared values, via for-each
                "27"           // two-dimensional index
            ]);
        });
    });
});