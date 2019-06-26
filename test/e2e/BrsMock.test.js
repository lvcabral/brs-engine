const { execute } = require("../../lib");
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

    test("mocks.brs", async () => {
        await execute([resourceFile("mocks.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).filter(arg => arg !== "\n")).toEqual([
            "marking mock timespan",
            "mocked timespan should return 8: ",
            "8",
            "create object regex:",
            "roRegex",
            "mock object regex:",
            "roSGNode",
            "mock poster name:",
            "poster",
            "mocked node id:",
            "node-id",
            "mocked node name:",
            "node-name",
            "mocked node child index:",
            "333",
            "second mock node id is not mutated by first mock:",
            "id",
            "second mock node name is not mutated by first mock:",
            "name",
        ]);
    });
});
