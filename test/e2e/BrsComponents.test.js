const { execute } = require("../../lib/");
const BrsError = require("../../lib/Error");

const { createMockStreams, resourceFile, allArgs } = require("./E2ETests");

describe("end to end brightscript functions", () => {
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
});
