const { execute, createMockStreams, resourceFile, allArgs } = require("./E2ETests");

describe("end to end standard library", () => {
    let outputStreams;

    beforeAll(() => {
        outputStreams = createMockStreams();
        outputStreams.root = ".";
        outputStreams.ext = "./packages/browser/images";
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    afterAll(() => {
        vi.restoreAllMocks();
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
            '<Component: roList> =\n(\n    "bslCore.brs"\n    "bslDefender.brs"\n)',
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
            " 128516",
            "😄",
            "Mixed",
            "Case",
            "",
            " 10",
            "ed",
            "",
            " 7",
            " 10",
            " 3",
            " 3.4",
            " 9.7",
            " 2166136261",
            "-3",
            " 12.34",
            " 0",
            " 255",
            " 170",
            "Mary and Bob",
            "Apple and Grape",
            "a,,,,^4,a,,,,{4}",
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
            `"\\u20AC"`,
            `"€"`,
            " 123",
            "ABC",
            ["<Component: roAssociativeArray> =", "{", "    X: 456", "}"].join("\n"),
            ["<Component: roAssociativeArray> =", "{", "    X: 456", "    x: 123", "}"].join("\n"),
            " 2147483647",
            "-2147483648",
            " 2147483648",
            "-2147483649",
            " 9223372036854775807            LongInteger",
            "-9223372036854775808            LongInteger",
            " 3.40282e+38    Float",
            " 1.12346        Float",
            " 11.1235        Float",
            " 111.124        Float",
            " 1111.12        Float",
            " 1.1234567      Double",
            " 11.1234567     Double",
            " 111.1234567    Double",
            " 1111.1234567   Double",
            " 1e+308         Double",
            "<Component: roInvalid>          roInvalid",
            " 2000           Float",
            "invalid",
            "invalid",
            "-1.12345678",
            "-1.12346",
            "-1.12345678",
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
            "<Interface: ifArray>",
            "<Interface: ifList>",
            "<Interface: ifToStr>",
            "<Interface: ifBoolean>",
            "invalid",
            "<Interface: ifAssociativeArray>",
            "<Interface: ifArray>",
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
            "registry        String          roString",
            "aa-reg          String          roString",
            "upper-reg       String          roString",
            "left-reg        String          roString",
            "value           String          String",
            "upper           String          roString",
            "left            String          roString",
            "aa-val          roString        String",
            "aa-upper        String          roString",
            "aa-left         String          roString",
            "aa-box          roString        roString",
            "upper-box       String          roString",
            "left-box        String          roString",
            "arr-reg         String          roString",
            "arr-upper       String          roString",
            "arr-set         String          roString",
            "var-after       Integer         roInteger       roInteger",
            "json-after      Integer         Integer         roInteger",
            "str-after       String          roString        roString",
        ]);
    });
    test("stdlib/type-legacy-store.brs", async () => {
        await execute([resourceFile("stdlib", "type-legacy-store.brs")], outputStreams);

        // Device trace: test/simulator/probes/type-legacy-probe/device-trace.txt
        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "inv-before|Invalid|Invalid",
            "inv-after-arr|Invalid|Invalid|roInvalid",
            "inv-after-aa|Invalid|Invalid|Invalid",
            "inv-fresh-var|Invalid|Invalid",
            "bool-expr-before|Boolean|Boolean|Boolean",
            "bool-expr-after|Boolean|Boolean|Boolean|roBoolean|roBoolean",
            "bool-lit-var|Boolean|Boolean",
            "json-arr|Integer|Float|String",
            "json-slice|Integer|Float|String",
            "lit-arr|roInteger|roFloat|roString",
            "lit-slice|roInteger|roFloat|roString",
            "json-aa|Integer|Integer",
            "json-aa-items|Integer|Integer",
            "lit-aa|roInteger|Integer",
            "lit-aa-items|roInteger|Integer",
            "split|roString|roString",
            "tokenize|roString|roString",
            "aa-keys|roString|roString",
            "push-expr|roInteger|Integer",
            "append-lit|roInteger|Integer",
            "append-json|Integer|Integer",
            "list-tail|roInteger|Integer|Integer",
            "list-head|roString|String|roString",
            "list-set|Integer|Integer",
            "xml-addhead|z|b|3",
            "xml-addtail|z|y|4",
            "xml-set|Integer|Integer",
            "xml-push|roInteger|Integer",
            "aa-set-expr|roInteger|roInteger|roInteger|Integer",
            "aa-set-lit|roInteger|Integer",
            "aa-set-json|roInteger|Integer",
            "arr-set-num|Integer|Integer|Integer|Integer",
            "arr-push-json|roInteger|Integer",
            "arr-unshift-expr|roInteger|Integer",
            "list-add|roInteger|roInteger|Integer",
            "list-set-expr|Integer|Integer",
            "bool-lit-in|roBoolean|roBoolean|roBoolean",
            "bool-store|roBoolean|roBoolean|Boolean|Boolean",
            "bool-json|Boolean|Boolean",
            "inv-store|roInvalid|Invalid|Invalid|roInvalid|Invalid",
            "inv-json|Invalid|Invalid",
            "inv-after-all|Invalid|Invalid",
            "regex-split|roString|roString",
            "box-split|roString|roString",
            "aa-keys-json|roString|roString",
            'readmulti-keys|{"a":"1","b":"2"}',
            'readmulti-split|{"a":"1","b":"2"}',
            "read-split|2",
            "xml-attr|T|T|1",
            "aa-index|1|1",
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
