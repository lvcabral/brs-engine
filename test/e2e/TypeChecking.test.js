const { execute, createMockStreams, resourceFile, allArgs } = require("./E2ETests");

describe("function argument type checking", () => {
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

    it("errors when too few args are passed", async () => {
        await execute([resourceFile("type-checking", "too-few-args.brs")], outputStreams);
        const output = allArgs(outputStreams.stderr.write);
        expect(output[0]).toMatch(/UCase requires at least 1 arguments, but received 0\./);
    });

    it("errors when too many args are passed", async () => {
        await execute([resourceFile("type-checking", "too-many-args.brs")], outputStreams);
        const output = allArgs(outputStreams.stderr.write);
        expect(output[0] ?? "").toMatch(/RebootSystem accepts at most 0 arguments, but received 1\./);
    });

    it("errors when mismatched types are provided as arguments", async () => {
        await execute([resourceFile("type-checking", "arg-type-mismatch.brs")], outputStreams);
        const output = allArgs(outputStreams.stderr.write);
        expect(output[0]).toMatch(/Argument 's' must be of type String, but received Boolean./);
    });

    it("errors when returning a mismatched type from a function", async () => {
        await execute([resourceFile("type-checking", "mismatched-return-type.brs")], outputStreams);
        const output = allArgs(outputStreams.stderr.write);
        expect(output[0]).toMatch(/Type Mismatch./);
    });

    it("errors when assigning a mismatched type ", async () => {
        await execute([resourceFile("type-checking", "assignment-type-mismatch.brs")], outputStreams);
        const output = allArgs(outputStreams.stderr.write);
        expect(output[0]).toMatch(/Type Mismatch./);
    });

    it("coerces function call arguments where possible", async () => {
        await execute([resourceFile("type-checking", "argument-type-coercion.brs")], outputStreams);
        expect(
            allArgs(outputStreams.stdout.write)
                .join("")
                .split("\r\n")
                .filter((s) => !!s)
        ).toEqual([
            "calling 'Function: acceptsinteger' with argument of type 'double' with value: 2.71828",
            "received: 2",
            "calling 'Function: acceptsfloat' with argument of type 'double' with value: 2.71828",
            "received: 2.718280e+00",
            "calling 'Function: acceptsdouble' with argument of type 'double' with value: 2.71828",
            "received: 2.718280e+00",
            "calling 'Function: acceptslongint' with argument of type 'double' with value: 2.71828",
            "received: 2",
            "calling 'Function: acceptsinteger' with argument of type 'float' with value: 3.14159",
            "received: 3",
            "calling 'Function: acceptsfloat' with argument of type 'float' with value: 3.14159",
            "received: 3.141590e+00",
            "calling 'Function: acceptsdouble' with argument of type 'float' with value: 3.14159",
            "received: 3.141590e+00",
            "calling 'Function: acceptslongint' with argument of type 'float' with value: 3.14159",
            "received: 3",
            "calling 'Function: acceptsinteger' with argument of type 'integer' with value: 13",
            "received: 13",
            "calling 'Function: acceptsfloat' with argument of type 'integer' with value: 13",
            "received: 1.300000e+01",
            "calling 'Function: acceptsdouble' with argument of type 'integer' with value: 13",
            "received: 1.300000e+01",
            "calling 'Function: acceptslongint' with argument of type 'integer' with value: 13",
            "received: 13",
            "calling 'Function: acceptsinteger' with argument of type 'longinteger' with value: 2147483647119",
            "received: -881",
            "calling 'Function: acceptsfloat' with argument of type 'longinteger' with value: 2147483647119",
            "received: 2.147484e+12",
            "calling 'Function: acceptsdouble' with argument of type 'longinteger' with value: 2147483647119",
            "received: 2.147484e+12",
            "calling 'Function: acceptslongint' with argument of type 'longinteger' with value: 2147483647119",
            "received: 2147483647119",
        ]);
    });

    it("coerces assignment RHS values where possible", async () => {
        await execute([resourceFile("type-checking", "assignment-type-coercion.brs")], outputStreams);
        expect(
            allArgs(outputStreams.stdout.write)
                .join("")
                .split("\r\n")
                .filter((s) => !!s)
        ).toEqual([
            "assigning RHS of type 'double' with value: 2.71828",
            "integer% =  2",
            "float! =  2.71828",
            "double# =  2.71828",
            "longinteger& =  2",
            "assigning RHS of type 'float' with value: 3.14159",
            "integer% =  3",
            "float! =  3.14159",
            "double# =  3.14159",
            "longinteger& =  3",
            "assigning RHS of type 'integer' with value: 13",
            "integer% =  13",
            "float! =  13",
            "double# =  13",
            "longinteger& =  13",
            "assigning RHS of type 'longinteger' with value: 2147483647119",
            "integer% = -881",
            "float! =  2.14748e+12",
            "double# =  2147483647119",
            "longinteger& =  2147483647119",
        ]);
    });
});
