const { execute } = require("../../lib");
const { createMockStreams, resourceFile, allArgs } = require("./E2ETests");

describe("GetStackTrace", () => {
    let outputStreams;

    beforeAll(() => {
        outputStreams = createMockStreams();
        outputStreams.root = __dirname + "/resources";
    });

    test("components/stack-trace/main.brs", async () => {
        await execute(
            [
                resourceFile("components", "stack-trace", "@external", "package", "utils.brs"),
                resourceFile("components", "stack-trace", "print.brs"),
                resourceFile("components", "stack-trace", "main.brs"),
            ],
            outputStreams
        );

        expect(
            allArgs(outputStreams.stdout.write)
                .filter((arg) => arg !== "\n")
                .map((line) => line.replace(process.cwd(), ""))
        ).toEqual([
            "--- stack ---",
            "test/e2e/resources/components/stack-trace/print.brs:2:12",
            "test/e2e/resources/components/stack-trace/print.brs:2:4",
            "test/e2e/resources/components/stack-trace/main.brs:6:4",
            "test/e2e/resources/components/stack-trace/@external/package/utils.brs:2:4",
            "test/e2e/resources/components/stack-trace/main.brs:2:4",
            "--- stack ---",
            "test/e2e/resources/components/stack-trace/print.brs:4:12",
            "--- stack ---",
            "test/e2e/resources/components/stack-trace/print.brs:6:12",
            "test/e2e/resources/components/stack-trace/print.brs:6:4",
            "test/e2e/resources/components/stack-trace/main.brs:6:4",
            "test/e2e/resources/components/stack-trace/main.brs:2:4",
            "--- stack ---",
            "test/e2e/resources/components/stack-trace/main.brs:6:4",
            "test/e2e/resources/components/stack-trace/main.brs:2:4",
        ]);
    });
});
