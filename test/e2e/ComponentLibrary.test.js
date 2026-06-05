const path = require("path");
const { execute, createMockStreams, resourceFile, allArgs } = require("./E2ETests");

describe("ComponentLibrary", () => {
    let outputStreams;

    beforeAll(() => {
        outputStreams = createMockStreams();
        outputStreams.root = path.join(__dirname, "resources", "component-library");
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    test("loads a component library and resolves its namespaced components", async () => {
        await execute([resourceFile("component-library", "source", "main.brs")], outputStreams);

        // Filter out the engine's "[sg]" diagnostic lines and keep only the app's own output.
        const output = allArgs(outputStreams.stdout.write)
            .map((arg) => arg.trimEnd())
            .filter((arg) => arg !== "" && !arg.startsWith("[sg]"));

        expect(output).toEqual([
            // loadStatus is "loading" at scene init; the "ready" transition is deferred to the
            // first render frame so the observeField() callback is notified.
            "init loadStatus: loading",
            "loadStatus changed: ready",
            "[MyLib:Bar::init]",
            "bar subtype: MyLib:Bar",
            "bar message: Hello from MyLib:Bar",
        ]);
    });

    test("loads a library created and configured at runtime", async () => {
        await execute([resourceFile("component-library", "source", "runtime.brs")], outputStreams);

        const output = allArgs(outputStreams.stdout.write)
            .map((arg) => arg.trimEnd())
            .filter((arg) => arg !== "" && !arg.startsWith("[sg]"));

        expect(output).toEqual([
            // ComponentLibrary created via CreateObject; loading triggers once both id and uri are set.
            "after set id: none",
            "after set uri: loading",
            "runtime loadStatus changed: ready",
            "[MyLib:Bar::init]",
            "runtime bar subtype: RuntimeLib:Bar",
        ]);
    });
});
