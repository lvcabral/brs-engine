const { execute, createMockStreams, resourceFile, allArgs } = require("./E2ETests");

describe("end to end functions", () => {
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

    test("function/arguments.brs", async () => {
        await execute([resourceFile("function", "arguments.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "noArgsFunc",
            "requiredArgsFunc:",
            " 1",
            " 2",
            "typedArgsFunc:",
            " 2.5",
            " 3",
            "false",
            "optionalArgsFunc:",
            "-5",
            " 2",
            "-10",
        ]);
    });

    test("function/return.brs", async () => {
        await execute([resourceFile("function", "return.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "staticReturn",
            "conditionalReturn:",
            " 5",
            "conditionalReturn:",
            "invalid",
            "forLoopReturn:",
            " 2",
            "whileLoopReturn:",
            " 3",
            "boxedReturnType:",
            "roFloat 3.14159",
            "invalidAsObject:",
            "roInvalid<Component: roInvalid>",
        ]);
    });

    test("function/expressions.brs", async () => {
        await execute([resourceFile("function", "expressions.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "anonymous function",
            "immediately-invoked function expression (IIFE)",
            "pre-callback",
            "callback:",
            " 14",
            "post-callback",
        ]);
    });

    test("function/m-pointer.brs", async () => {
        await execute([resourceFile("function", "m-pointer.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "carpenter.safetyGlassesOn = true",
            "m.houseAge = old",
        ]);
    });

    test("function/m-pointer-global.brs", async () => {
        await execute([resourceFile("function", "m-pointer-global.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "old: value 1",
            "new: value 2",
            "glb: value 2",
            "old: invalid",
            "new: value 4",
            "glb: value 3",
        ]);
    });

    test("function/m-pointer-func.brs", async () => {
        await execute([resourceFile("function", "m-pointer-func.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "not root",
            "root",
            "bar",
            "bar",
            "invalid",
            "Log: getText = Test Succeeded! 1",
            "Log: getText = Test Succeeded! 2",
            "Log: getText = Test Succeeded! 3",
        ]);
    });

    test("function/m-pointer-reassign.brs", async () => {
        await execute([resourceFile("function", "m-pointer-reassign.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "bar",
            " 2",
            "bar",
            "abc",
            " 2",
            "abcdef",
            "invalid",
            "bar",
        ]);
    });

    test("function/scoping.brs", async () => {
        await execute([resourceFile("function", "scoping.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "Global: true",
            "Module: true",
            "Function: false",
        ]);
    });

    test("function/casing.brs", async () => {
        await execute([resourceFile("function", "casing.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "but I'm only interested in...",
        ]);
    });
});
