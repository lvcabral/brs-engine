const { execute, createMockStreams, resourceFile, allArgs } = require("./E2ETests");

describe("end to end syntax", () => {
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

    test("comments.brs", async () => {
        await execute([resourceFile("comments.brs")], outputStreams);
        expect(outputStreams.stdout.write).not.toBeCalled();
    });

    test("printLiterals.brs", async () => {
        await execute([resourceFile("printLiterals.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "invalid",
            "true",
            "false",
            " 5",
            " 6",
            " 7",
            " 30",
            " 40",
            "hello",
            " 255",
        ]);
    });

    test("arithmetic.brs", async () => {
        await execute([resourceFile("arithmetic.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            " 3",
            " 3",
            " 3",
            " 3", // addition
            " 5",
            " 5",
            " 5",
            " 5", // subtraction
            " 15",
            " 15",
            " 15",
            " 15", // multiplication
            " 2.5",
            " 2",
            " 2.5",
            " 2.5", // division
            " 8",
            " 8",
            " 8",
            " 8", // exponentiation
            " 64",
            " 128",
            " 256",
            " 16",
            " 8",
            " 4",
            "-5", // unary + and -
            " 5",
            "-5",
            "Float",
            " 1",
            "Float",
            " 1",
            "Float",
            " 1",
            "Integer",
            " 1",
            " 10", // boxed operations
            " 4",
            " 21",
            " 2.33333",
            "Integer",
            "roInt",
            "roFloat",
            "true",
            "false",
            "true",
            "-2",
            "-101",
            " 101",
            " 101",
            " 0.7",
            " 2147483648", // integer overflow
            "-2147483649",
            "-16",
        ]);
    });

    test("integer-hex-format.brs", async () => {
        await execute([resourceFile("integer-hex-format.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "3405705229 = 0xCAFEF00D",
            "-889262067 = 0xFFFFFFFFCAFEF00D",
            "150460469257 = 0x2308249009",
            "-255 = 0xFFFFFFFFFFFFFF01",
            "-255 = 0xFFFFFF01",
            "LongInteger",
            "3405705229 = 0xCAFEF00D",
            "Integer",
            "-889262067 = 0xCAFEF00D",
            "LongInteger",
            "4294967296 = 0x100000000",
            " 0",
            "Integer",
            "0 = 0x0",
            " 0",
            "Double",
            "4.29497e+09",
            " 2147483647",
            "LongInteger",
            "4294967296 = 0x100000000",
            " 0",
        ]);
    });

    test("to-str-with-format.brs", async () => {
        await execute([resourceFile("to-str-with-format.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "float1 = 10000.5",
            "float2 = 10000.5",
            "float3 = 10000.45678",
            "float3.toStr() = 10000.5",
            "0.123 = 0.123",
            "0.123.toStr() = 0.123",
            "123.4567 = 123.457",
            "123.4567.toStr() = 123.457",
            "double = 10000.46", // RBI 10000.45703125
            "double.toStr() = 10000.5",
            " 40",
            "40",
            "00040",
            "50",
            "1f",
            "1F",
            "99 red luftballoons",
            "this is a long s",
            "                    short string",
            "A",
            "'A'",
            "3.141590",
            "3.14",
            "3.141590e+00",
            "0000003.14",
            "13",
            "13 13.00",
            "%%%",
            "A",
            "32 is bigger than 16",
            "32 is bigger than 12 and smaller than 64",
            "A",
            "2.000000e+00",
            "2.000000",
            "3.141593",
            "3.141593e+00",
            "3.14159",
            "3",
            "3e+00",
            "3",
            "2.200000",
            "-2.200000",
            "+2.200000",
            "-2.200000",
            "-12.340000 xxx",
            "4294967296 = 0x100000000",
            "00face1",
            " FACE1",
            "FACE1 <",
            "000face1",
            " FACE1",
            "FACE1 <",
            "000face1",
            "3.14",
            "Type Mismatch.",
            "false",
            "false",
            " 0",
            "0",
            "0.0",
            " 0",
            "0",
            "0.0",
            "<Function: UNDEFINED>",
            "Function: UNDEFINED",
            "<Function: main>",
            "Function: main",
            " 0",
            "0",
            "0.0",
            "<Component: roInvalid>",
            "invalid",
            "invalid",
            " 0",
            "0",
            "0.0",
            "test",
            "test",
            "tes",
        ]);
    });

    test("negative-precedence.brs", async () => {
        await execute([resourceFile("negative-precedence.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "0000",
            " 0",
            "foo is not 1",
        ]);
    });

    test("assignment.brs", async () => {
        await execute([resourceFile("assignment.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "new value",
        ]);
    });

    test("assignment-operators.brs", async () => {
        await execute([resourceFile("assignment-operators.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            " 5",
            " 2",
            " 6",
            " 3",
            " 1",
        ]);
    });

    test("optional-chaining-operators.brs", async () => {
        await execute([resourceFile("optional-chaining-operators.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "error 236",
            "invalid",
            "invalid",
            "invalid",
            "invalid",
            "invalid",
            "invalid",
            "invalid",
            "error 244",
        ]);
    });

    test("conditionals.brs", async () => {
        await execute([resourceFile("conditionals.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            " 1",
            " 2",
            " 3",
            " 4",
            " 5",
            " 6",
            " 7",
            " 8",
            // testing if not
            "not false",
            "bar does not equal 'def'",
            "if not with or variation 1",
            "if not with or variation 2",
            "if not with and",
            "if not with two expressions variation 1",
            "if not with two expressions variation 2",
            "if not multiple times",
            "if not with <> operator",
            "foo is not > 1",
            "foo is not < 2",
            "foo is not < 2 and not > 2",
            "#481 fixed",
            " 2",
            " 5",
        ]);
    });

    test("dim.brs", async () => {
        await execute([resourceFile("dim.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            " 4",
            " 5",
            " 5",
            "hello",
            "invalid",
            "invalid",
        ]);
    });

    test("while-loops.brs", async () => {
        await execute([resourceFile("while-loops.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            " 0",
            " 1",
            " 2",
            " 3",
            " 4", // count up
            " 5",
            " 4", // count down with exit
            " 15", // compute 3 * 5 with nested loops
        ]);
    });

    test("for-loops.brs", async () => {
        await execute([resourceFile("for-loops.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            " 0",
            " 2",
            " 4",
            " 6", // count up
            " 8", // i after loop
            " 3",
            " 2",
            " 1",
            " 0", // count down
            " 128", // step non multiple of final
            " 85", // step non multiple of final
            "for loop exit", // exit early
            " 0", // e after loop
            "initial = final", // loop where initial equals final
        ]);
    });

    test("foreach-loops.brs", async () => {
        await execute([resourceFile("foreach-loops.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "orange",
            "lemon",
            "lime",
            "dog eats orange",
            "dog eats lemon",
            "dog eats lime",
            "cat eats orange",
            "cat eats lemon",
            "cat eats lime",
            "bird eats orange",
            "bird eats lemon",
            "bird eats lime",
            "dog likes dog",
            "dog likes cat",
            "dog likes bird",
            "false",
        ]);
    });

    test("continue.brs", async () => {
        await execute([resourceFile("continue.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            " 1",
            " 2",
            " 4",
            " 5",
            " 5",
            " 4",
            " 2",
            " 1",
            "orange",
            "lime",
            " 0",
            " 2",
        ]);
    });

    test("print.brs", async () => {
        await execute([resourceFile("print.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).join("")).toEqual(
            "lorem  1psum\r\n" +
                " 9 is equal to 9\r\n" +
                //   0   0   0   1   1   2   2   2   3   3   4   4   4   5   5
                //   0   4   8   2   6   0   4   8   2   6   0   4   8   2   6
                "column a        column b        column c        column d\r\n" +
                //   0   0   0   1   1   2   2   2   3   3   4   4   4   5   5
                //   0   4   8   2   6   0   4   8   2   6   0   4   8   2   6
                "   I started at col 3    I started at col 25\r\n" +
                "0123 4\r\n" +
                "lorem    ipsum    dolor    sit    amet\r\n" +
                "no newline"
        );
    });

    test("reserved-words.brs", async () => {
        await execute([resourceFile("reserved-words.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "createObject",
            "in",
            "stop",
            "run",
            "then",
            "Hello from line  14",
        ]);
    });

    test("increment.brs", async () => {
        await execute([resourceFile("increment.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            " 6", // var = 5: var++
            " 2", // aa = { foo: 3 }: aa.foo--
            " 14", // arr = [13]: arr[0]++
        ]);
    });

    test("dot-chaining.brs", async () => {
        await execute([resourceFile("dot-chaining.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "removed number '7' from array, remaining 6",
            "removed number '6' from array, remaining 5",
            "promise-like resolved to 'success'",
            "optional chaining works",
            "param test result was: success",
            "literal test result was: success",
        ]);
    });

    test("try-catch.brs", async () => {
        await execute([resourceFile("try-catch.brs")], outputStreams);
        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "[pre_try] a = 5",
            "[in_try] a = 10",
            "[subFunc] a = 10",
            "[thirdLevel]",
            "Error # = 6502",
            "[in_catch] message = subFunc custom error message!",
            "[in_catch] customField = true",
            "[backtrace] = 8",
            "[backtrace] = 25",
            "[backtrace] = 41",
            "[post_try] a = 10",
            "[subFunc] a = 11",
            "Error # = 24",
            `Error message = Type Mismatch. Operator "*" can't be applied to "Integer" and "String".`,
        ]);
    });

    test("goto.brs", async () => {
        await execute([resourceFile("goto.brs")], outputStreams);
        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "counter: 0",
            "goto 10",
            "counter: 1",
            "goto 20",
            "nested: 1 - 1",
            "nested: 1 - 2",
            "back to 10",
            "counter: 2",
        ]);
    });

    test("goto-func-for.brs", async () => {
        await execute([resourceFile("goto-func-for.brs")], outputStreams);
        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "starting goto test",
            "not jumped: 5",
            "not jumped: 4",
            "did jump! 3",
            "not jumped: 2",
            "not jumped: 1",
            "not jumped: 0",
            "not jumped:-1",
            "error: aborting",
            "successful goto test!",
            "finished goto test",
        ]);
    });

    test("goto-foreach.brs", async () => {
        await execute([resourceFile("goto-foreach.brs")], outputStreams);
        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "starting goto test",
            "not jumped: a",
            "not jumped: b",
            "did jump! c",
            "not jumped: d",
            "not jumped: e",
            "not jumped: f",
            "successful goto test!",
            "finished goto test",
        ]);
    });

    test("goto-trycatch.brs", async () => {
        await execute([resourceFile("goto-trycatch.brs")], outputStreams);
        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "start tests",
            "test 1",
            "test 2",
            "test ends here",
        ]);
    });

    test("boxed-boolean.brs", async () => {
        await execute([resourceFile("boxed-boolean.brs")], outputStreams);
        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "true false",
            "one false",
            "one true",
        ]);
    });
});
