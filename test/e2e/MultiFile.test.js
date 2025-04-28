const { createMockStreams, resourceFile, allArgs, execute } = require("./E2ETests");

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

    test("multi-file/test1.brs and multi-file/test1.brs", async () => {
        let resourceFiles = [resourceFile("multi-file", "test1.brs"), resourceFile("multi-file", "test2.brs")];

        await execute(resourceFiles, outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "function in same file: from sameFileFunc()",
            "function in different file: from differentFileFunc()",
            "function with dependency: from dependentFunc() with help from: from dependencyFunc()",
        ]);
    });
});
