const { execute, createMockStreams, resourceFile, allArgs } = require("./E2ETests");

describe("end to end standard libary", () => {
    let outputStreams;

    beforeAll(() => {
        outputStreams = createMockStreams();
        outputStreams.root = ".";
        outputStreams.ext = "./browser/images";
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    test("stdlib/files.brs", async () => {
        await execute([resourceFile("stdlib", "files.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "false",
            "true",
            "true",
            "true",
            "true",
            "true",
            "false",
            "true",
            "false",
            '<Component: roList> =\n(\n    "test_backup.txt"\n)',
            "true",
            "true",
        ]);
    });

    test("stdlib/strings.brs", async () => {
        await execute([resourceFile("stdlib", "strings.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "MIXED CASE",
            "mixed case",
            " 12359",
            "ぇ",
            "Mixed",
            "Case",
            " 10",
            "ed",
            " 7",
            " 10",
            " 3",
            " 3.4",
            " 9.7",
            "-3",
            " 12.34",
            " 0",
            " 255",
            " 170",
            "Mary and Bob",
            " 252",
            "abababab",
            "!!!!!!!!",
            " 1.23457e+12",
        ]);
    });

    test("stdlib/math.brs", async () => {
        await execute([resourceFile("stdlib", "math.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            " 22.1979",
            " 2.85647",
            " 3.34215",
            " 0.463648",
            " 0.707388",
            " 1",
            " 0.999204",
            " 3.5",
            " 17",
            " 17",
            " 204",
            "-2",
            " 7",
            " 1",
            "-1",
            " 10",
            " 10",
            " 11",
            "-10",
            "-11",
            "-11",
            " 10",
            " 10",
            " 11",
            "-10",
            "-11",
            "-10",
            " 122334343434",
            " 2147483647",
            " 2147483647",
            " 2147483647",
            " 2147483647",
            " 2147483647",
            " 2147483647",
            "-2147483648",
            "-2147483648",
            "-2147483648",
            " nan",
        ]);
    });

    test("stdlib/runtime.brs", async () => {
        await execute([resourceFile("stdlib", "runtime.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual(["true"]);
    });

    test("stdlib/json.brs", async () => {
        await execute([resourceFile("stdlib", "json.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "",
            `{"boolean":false,"float":3.14,"integer":2147483647,"longinteger":2147483650,"null":null,"string":"ok"}`,
            [
                "<Component: roAssociativeArray> =",
                "{",
                "    boolean: false",
                "    float: 3.14",
                "    integer: 2147483647",
                "    longinteger: 2147483650",
                "    null: invalid",
                '    string: "ok"',
                "}",
            ].join("\n"),
            "",
            `{"ar":[1,2,3],"di":null,"nx":123,"sa":"abc"}`,
            `{"ar":[1,2,3],"di":"<roDeviceInfo>","nx":123,"sa":"abc"}`,
            " 123",
            "ABC",
            ["<Component: roAssociativeArray> =",
            "{",
            "    X: 456",
            "}"].join("\n"),
            ["<Component: roAssociativeArray> =",
            "{",
            "    X: 456",
            "    x: 123",
            "}"].join("\n"),
        ]);
    });

    test("stdlib/nested-array-formatjson.brs", async () => {
        await execute([resourceFile("stdlib", "nested-array-formatjson.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            `["Array A",["Array B",["Array C"]],["Array C"]]`,
            "",
        ]);
        let errOutput = allArgs(outputStreams.stderr.write).filter((arg) => arg !== "\n");
        expect(errOutput[0].includes("FormatJSON: Nested object reference")).toBeTruthy();
    });

    test("stdlib/run.brs", async () => {
        await execute([resourceFile("stdlib", "run.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "in run.brs",
            "    in runme.brs",
            "returned to run.brs",
            "runme.brs returned:  2",
        ]);
    });

    test("stdlib/global-utilities.brs", async () => {
        await execute([resourceFile("stdlib", "global-utilities.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "<Interface: ifFloat>",
            "<Interface: ifAssociativeArray>",
            "<Interface: ifToStr>",
            "<Interface: ifAssociativeArray>",
            "<Interface: ifStringOps>",
            "<Interface: ifStringOps>",
            "<Interface: ifIntOps>",
            "<Interface: ifToStr>",
            "roAssociativeArray",
            "8000X",
            "true",
        ]);
    });
    test("stdlib/create-object.brs", async () => {
        await execute([resourceFile("stdlib", "create-object.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "false",
            "false",
            " 0",
            " 0",
            " 0",
            " 0",
            " 0",
            " 0",
            " 0",
            " 0",
            "",
            "",
            "<Component: roInvalid>",
            "<Component: roInvalid>",
            "<Component: roScreen>",
            "invalid",
            "<Component: roScreen>",
            "invalid",
            "<Component: roScreen>",
            " 0",
            " 245",
            "invalid",
            " 245",
        ]);
    });
    test("stdlib/type-legacy.brs", async () => {
        await execute([resourceFile("stdlib", "type-legacy.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "Integer         Integer",
            " 1",
            "roInt           roInt",
            " 3",
            "roInteger       Integer",
            " 1",
            "roFloat         Float",
            "roFloat         Double",
            "LongInteger     LongInteger",
            "roString        String",
            "roInvalid       Invalid",
            "roBoolean       Boolean",
        ]);
    });
    test("stdlib/end.brs", async () => {
        await execute([resourceFile("stdlib", "end.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "test the test",
            "testing end...",
        ]);
    });
});
