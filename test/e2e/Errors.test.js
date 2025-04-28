const { execute, createMockStreams, resourceFile, allArgs } = require("./E2ETests");

describe("Runtime errors", () => {
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

    test("components/errors/dotted-get.brs", async () => {
        await execute([resourceFile("components", "errors", "dotted-get.brs")], outputStreams);

        let errOutput = allArgs(outputStreams.stderr.write).filter((arg) => arg !== "\n");
        expect(
            errOutput[0].includes(
                "'Dot' Operator attempted with invalid BrightScript Component or interface reference."
            )
        ).toBeTruthy();
    });

    test("components/errors/indexed-get.brs", async () => {
        await execute([resourceFile("components", "errors", "indexed-get.brs")], outputStreams);

        let errOutput = allArgs(outputStreams.stderr.write).filter((arg) => arg !== "\n");
        expect(
            errOutput[0].includes(
                "'Dot' Operator attempted with invalid BrightScript Component or interface reference."
            )
        ).toBeTruthy();
    });

    test("components/errors/illegal-index.brs", async () => {
        await execute([resourceFile("components", "errors", "illegal-index.brs")], outputStreams);

        let errOutput = allArgs(outputStreams.stderr.write).filter((arg) => arg !== "\n");
        expect(errOutput[0].includes("Attempt to use a non-numeric array index not allowed.")).toBeTruthy();
    });
});
