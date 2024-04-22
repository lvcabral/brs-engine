const {execute, createMockStreams, resourceFile, allArgs } = require("./E2ETests");

describe("function argument type checking", () => {
    let outputStreams, stderr;

    beforeAll(() => {
        outputStreams = createMockStreams();
        stderr = outputStreams.stderrSpy;
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("errors when too few args are passed", () => {
        return execute([resourceFile("type-checking", "too-few-args.brs")], outputStreams).catch(
            () => {
                const output = allArgs(stderr);
                expect(output[0]).toMatch(/UCase requires at least 1 arguments, but received 0\./);
            }
        );
    });

    it("errors when too many args are passed", () => {
        return execute([resourceFile("type-checking", "too-many-args.brs")], outputStreams).catch(
            () => {
                const output = allArgs(stderr);
                expect(output[0]).toMatch(
                    /RebootSystem accepts at most 0 arguments, but received 1\./
                );
            }
        );
    });

    it("errors when mismatched types are provided as arguments", () => {
        return execute(
            [resourceFile("type-checking", "arg-type-mismatch.brs")],
            outputStreams
        ).catch(() => {
            const output = allArgs(stderr);
            expect(output[0]).toMatch(/Argument 's' must be of type String, but received Boolean./);
        });
    });

    it("errors when returning a mismatched type from a function", () => {
        return execute(
            [resourceFile("type-checking", "mismatched-return-type.brs")],
            outputStreams
        ).catch(() => {
            const output = allArgs(stderr);
            expect(output[0]).toMatch(
                /Attempting to return value of type Integer, but function returnsString declares return value of type String/
            );
        });
    });

    it("errors when assigning a mismatched type ", () => {
        return execute(
            [resourceFile("type-checking", "assignment-type-mismatch.brs")],
            outputStreams
        ).catch(() => {
            const output = allArgs(stderr);
            expect(output[0]).toMatch(
                /Attempting to assign incorrect value to statically-typed variable/
            );
        });
    });

    it.skip("coerces function call arguments where possible", async () => {
        await execute([resourceFile("type-checking", "argument-type-coercion.brs")], outputStreams);
        expect(
            allArgs(outputStreams.stdout.write)
                .join("")
                .split("\n")
                .filter((s) => !!s)
        ).toEqual([
            "calling '[Function acceptsInteger]' with argument of type 'double' with value: 2.71828",
            "received: 2",
            "calling '[Function acceptsFloat]' with argument of type 'double' with value: 2.71828",
            "received: 2.71828",
            "calling '[Function acceptsDouble]' with argument of type 'double' with value: 2.71828",
            "received: 2.71828",
            "calling '[Function acceptsLongInt]' with argument of type 'double' with value: 2.71828",
            "received: 2",
            "calling '[Function acceptsInteger]' with argument of type 'float' with value: 3.14159",
            "received: 3",
            "calling '[Function acceptsFloat]' with argument of type 'float' with value: 3.14159",
            "received: 3.14159",
            "calling '[Function acceptsDouble]' with argument of type 'float' with value: 3.14159",
            "received: 3.14159",
            "calling '[Function acceptsLongInt]' with argument of type 'float' with value: 3.14159",
            "received: 3",
            "calling '[Function acceptsInteger]' with argument of type 'integer' with value: 13",
            "received: 13",
            "calling '[Function acceptsFloat]' with argument of type 'integer' with value: 13",
            "received: 13",
            "calling '[Function acceptsDouble]' with argument of type 'integer' with value: 13",
            "received: 13",
            "calling '[Function acceptsLongInt]' with argument of type 'integer' with value: 13",
            "received: 13",
            "calling '[Function acceptsInteger]' with argument of type 'longinteger' with value: 2147483647119",
            "received: -881",
            "calling '[Function acceptsFloat]' with argument of type 'longinteger' with value: 2147483647119",
            "received: 2147484000000",
            "calling '[Function acceptsDouble]' with argument of type 'longinteger' with value: 2147483647119",
            "received: 2147483647119",
            "calling '[Function acceptsLongInt]' with argument of type 'longinteger' with value: 2147483647119",
            "received: 2147483647119",
        ]);
    });

    it.skip("coerces assignment RHS values where possible", async () => {
        await execute(
            [resourceFile("type-checking", "assignment-type-coercion.brs")],
            outputStreams
        );
        expect(
            allArgs(outputStreams.stdout.write)
                .join("")
                .split("\n")
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
            "float! =  2147484000000",
            "double# =  2147483647119",
            "longinteger& =  2147483647119",
        ]);
    });
});
