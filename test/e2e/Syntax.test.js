const { execute } = require("../../lib/");

const { createMockStreams, resourceFile, allArgs } = require("./E2ETests");

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

        expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
            "invalid",
            "true",
            "false",
            "5",
            "6",
            "7",
            "30",
            "40",
            "hello",
            "255",
        ]);
    });

    test("arithmetic.brs", async () => {
        await execute([resourceFile("arithmetic.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
            "3",
            "3",
            "3",
            "3", // addition
            "5",
            "5",
            "5",
            "5", // subtraction
            "15",
            "15",
            "15",
            "15", // multiplication
            "2.5",
            "2",
            "2.5",
            "2.5", // division
            "8",
            "8",
            "8",
            "8", // exponentiation
            "64",
            "128",
            "256",
            "16",
            "8",
            "4",
            "-5", // unary + and -
            "5",
            "-5",
        ]);
    });

    test("assignment.brs", async () => {
        await execute([resourceFile("assignment.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
            "new value",
        ]);
    });

    test("assignment-operators.brs", async () => {
        await execute([resourceFile("assignment-operators.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
            "5",
            "2",
            "6",
            "3",
            "1",
        ]);
    });

    test("conditionals.brs", async () => {
        await execute([resourceFile("conditionals.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
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
        ]);
    });

    test("dim.brs", async () => {
        await execute([resourceFile("dim.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
            "4",
            "5",
            "5",
            "hello",
            "invalid",
            "invalid",
        ]);
    });

    test("while-loops.brs", async () => {
        await execute([resourceFile("while-loops.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
            "0",
            "1",
            "2",
            "3",
            "4", // count up
            "5",
            "4", // count down with exit
            "15", // compute 3 * 5 with nested loops
        ]);
    });

    test("for-loops.brs", async () => {
        await execute([resourceFile("for-loops.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
            "0",
            "2",
            "4",
            "6", // count up
            "8", // i after loop
            "3",
            "2",
            "1",
            "0", // count down
            "128", // step non multiple of final
            "85", // step non multiple of final
            "for loop exit", // exit early
            "0", // e after loop
            "initial = final", // loop where initial equals final
        ]);
    });

    test("print.brs", async () => {
        await execute([resourceFile("print.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).join("")).toEqual(
            "lorem 1psum\n" +
                "9  is equal to 9\n" +
                //   0   0   0   1   1   2   2   2   3   3   4   4   4   5   5
                //   0   4   8   2   6   0   4   8   2   6   0   4   8   2   6
                "column a        column b        column c        column d\n" +
                //   0   0   0   1   1   2   2   2   3   3   4   4   4   5   5
                //   0   4   8   2   6   0   4   8   2   6   0   4   8   2   6
                "   I started at col 3    I started at col 25\n" +
                "01234\n" +
                "lorem    ipsum    dolor    sit    amet\n" +
                "no newline"
        );
    });

    test("reserved-words.brs", async () => {
        await execute([resourceFile("reserved-words.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
            // note: associative array keys are sorted before iteration
            "createObject",
            "in",
            "run",
            "stop",
            "then",
            "Hello from line ",
            "14",
        ]);
    });

    test("increment.brs", async () => {
        await execute([resourceFile("increment.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
            "6", // var = 5: var++
            "2", // aa = { foo: 3 }: aa.foo--
            "14", // arr = [13]: arr[0]++
        ]);
    });

    test("dot-chaining.brs", async () => {
        await execute([resourceFile("dot-chaining.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
            "removed number '3' from array, remaining 2",
            "promise-like resolved to 'foo'",
            "optional chaining works",
        ]);
    });
});
