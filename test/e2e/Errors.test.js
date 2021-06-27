const { execute } = require("../../lib");
const { createMockStreams, resourceFile, allArgs } = require("./E2ETests");

describe("Runtime errors", () => {
    let outputStreams;

    beforeAll(() => {
        outputStreams = createMockStreams();
        outputStreams.root = __dirname + "/resources";
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
            errOutput[0].includes("Attempting to retrieve property from non-iterable value")
        ).toBeTruthy();
    });

    test("components/errors/indexed-get.brs", async () => {
        await execute([resourceFile("components", "errors", "indexed-get.brs")], outputStreams);

        let errOutput = allArgs(outputStreams.stderr.write).filter((arg) => arg !== "\n");
        expect(
            errOutput[0].includes("Attempting to retrieve property from non-iterable value")
        ).toBeTruthy();
    });

    test("components/errors/illegal-index.brs", async () => {
        await execute([resourceFile("components", "errors", "illegal-index.brs")], outputStreams);

        let errOutput = allArgs(outputStreams.stderr.write).filter((arg) => arg !== "\n");
        expect(
            errOutput[0].includes(
                "Attempting to retrieve property from iterable with illegal index type"
            )
        ).toBeTruthy();
    });
});
