const { execute } = require("../../lib/");

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

    test("multi-file/test1.brs and multi-file/test1.brs", () => {
        let resourceFiles = [
            resourceFile("multi-file", "test1.brs"),
            resourceFile("multi-file", "test2.brs")
        ];
        return execute(resourceFiles, outputStreams).then(() => {
            expect(
                allArgs(outputStreams.stdout.write).filter(arg => arg !== "\n")
            ).toEqual([
                "function in same file: from sameFileFunc()",
                "function in different file: from differentFileFunc()",
                "function with dependency: from dependentFunc() with help from: from dependencyFunc()"
            ]);
        });
    });
});