const { execute } = require("../../lib/");

const { createMockStreams, resourceFile, allArgs } = require("./E2ETests");

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
        await execute([ resourceFile("function", "arguments.brs") ], outputStreams);

        expect(
            allArgs(outputStreams.stdout.write).filter(arg => arg !== "\n")
        ).toEqual([
            "noArgsFunc",
            "requiredArgsFunc:", "1", "2",
            "typedArgsFunc:", "2.5", "3", "false",
            "optionalArgsFunc:", "-5", "2", "-10"
        ]);
    });

    test("function/return.brs", async () => {
        await execute([ resourceFile("function", "return.brs") ], outputStreams);

        expect(
            allArgs(outputStreams.stdout.write).filter(arg => arg !== "\n")
        ).toEqual([
            "staticReturn",
            "conditionalReturn:", "5",
            "conditionalReturn:", "invalid",
            "forLoopReturn:", "2",
            "whileLoopReturn:", "3"
        ]);
    });

    test("function/expressions.brs", async () => {
        await execute([ resourceFile("function", "expressions.brs") ], outputStreams);

        expect(
            allArgs(outputStreams.stdout.write).filter(arg => arg !== "\n")
        ).toEqual([
            "anonymous function",
            "immediately-invoked function expression (IIFE)",
            "pre-callback",
            "callback:", "14",
            "post-callback"
        ]);
    });

    test("function/m-pointer.brs", async () => {
        await execute([ resourceFile("function", "m-pointer.brs") ], outputStreams);

        expect(
            allArgs(outputStreams.stdout.write).filter(arg => arg !== "\n")
        ).toEqual([
            "carpenter.safetyGlassesOn = ", "true",
            "m.houseAge = ", "old"
        ]);
    });

    test("function/scoping.brs", async () => {
        await execute([ resourceFile("function", "scoping.brs") ], outputStreams);

        expect(
            allArgs(outputStreams.stdout.write).filter(arg => arg !== "\n")
        ).toEqual([
            "Global: ", "true",
            "Module: ", "true",
            "Function: ", "false"
        ]);
    });
});
