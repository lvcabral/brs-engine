const path = require("path");
const { execute, createMockStreams, resourceFile, allArgs } = require("./E2ETests");

describe("ComponentLibrary", () => {
    let outputStreams;

    beforeAll(() => {
        outputStreams = createMockStreams();
        outputStreams.root = path.join(__dirname, "resources", "component-library");
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    afterAll(() => {
        vi.restoreAllMocks();
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
            // The namespace is the library manifest's sg_component_libs_provided ("MyComponentLib"),
            // not the node id ("MyLib").
            "[Bar::init]",
            "bar subtype: MyComponentLib:Bar",
            "bar message: Hello from MyComponentLib:Bar",
        ]);
    });

    test("loads a library created and configured at runtime", async () => {
        await execute([resourceFile("component-library", "source", "runtime.brs")], outputStreams);

        const output = allArgs(outputStreams.stdout.write)
            .map((arg) => arg.trimEnd())
            .filter((arg) => arg !== "" && !arg.startsWith("[sg]"));

        expect(output).toEqual([
            // ComponentLibrary created via CreateObject; loading triggers once the uri is set.
            "after set id: none",
            "after set uri: loading",
            "runtime loadStatus changed: ready",
            "[Bar::init]",
            "runtime bar subtype: MyComponentLib:Bar",
        ]);
    });
    test("loads a library configured with only a uri and advances a fallback chain", async () => {
        await execute([resourceFile("component-library", "source", "urionly.brs")], outputStreams);

        const output = allArgs(outputStreams.stdout.write)
            .map((arg) => arg.trimEnd())
            .filter((arg) => arg !== "" && !arg.startsWith("[sg]"));

        expect(output).toEqual([
            // No id is set: the uri alone starts the load, and "failed" lets the app try the next uri.
            "after set uri: loading",
            "uri-only loadStatus changed: failed",
            "after set uri: loading",
            "uri-only loadStatus changed: ready",
            "[Bar::init]",
            "uri-only bar subtype: MyComponentLib:Bar",
        ]);
    });
});
