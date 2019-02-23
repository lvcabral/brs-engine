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

    test("comments.brs", () => {
        return execute([ resourceFile("comments.brs") ], outputStreams).then(() => {
            expect(outputStreams.stdout.write).not.toBeCalled();
        });
    });

    test("printLiterals.brs", () => {
        return execute([ resourceFile("printLiterals.brs") ], outputStreams).then(() => {
            expect(
                allArgs(outputStreams.stdout.write).filter(arg => arg !== "\n")
            ).toEqual([
                "invalid",
                "true",
                "false",
                "5",
                "7",
                "30",
                "40",
                "hello"
            ]);
        });
    });

    test("arithmetic.brs", () => {
        return execute([ resourceFile("arithmetic.brs") ], outputStreams).then(() => {
            expect(
                allArgs(outputStreams.stdout.write).filter(arg => arg !== "\n")
            ).toEqual([
                "3", "3", "3", "3",       // addition
                "5", "5", "5", "5",       // subtraction
                "15", "15", "15", "15",   // multiplication
                "2.5", "2", "2.5", "2.5", // division
                "8", "8", "8", "8",       // exponentiation
            ]);
        });
    });

    test("assignment.brs", () => {
        return execute([ resourceFile("assignment.brs") ], outputStreams).then(() => {
            expect(
                allArgs(outputStreams.stdout.write).filter(arg => arg !== "\n")
            ).toEqual([
                "new value"
            ]);
        });
    });

    test("assignment-operators.brs", () => {
        return execute([ resourceFile("assignment-operators.brs") ], outputStreams).then(() =>{
            expect(
                allArgs(outputStreams.stdout.write).filter(arg => arg !== "\n")
            ).toEqual([
                "5", "2", "6", "2", "16", "2"
            ]);
        });
    });

    test("conditionals.brs", () => {
        return execute([ resourceFile("conditionals.brs") ], outputStreams).then(() => {
            expect(
                allArgs(outputStreams.stdout.write).filter(arg => arg !== "\n")
            ).toEqual([
                "1", "2", "3", "4", "5", "6"
            ]);
        });
    });

    test("while-loops.brs", () => {
        return execute([ resourceFile("while-loops.brs") ], outputStreams).then(() => {
            expect(
                allArgs(outputStreams.stdout.write).filter(arg => arg !== "\n")
            ).toEqual([
                "0", "1", "2", "3", "4", // count up
                "5", "4"                 // count down with exit
            ]);
        });
    });

    test("for-loops.brs", () => {
        return execute([ resourceFile("for-loops.brs") ], outputStreams).then(() => {
            expect(
                allArgs(outputStreams.stdout.write).filter(arg => arg !== "\n")
            ).toEqual([
                "0", "2", "4", "6", // count up
                "8",                // i after loop
                "3", "2", "1", "0", // count down
                "for loop exit",    // exit early
                "0",                // e after loop
                "initial = final"   // loop where initial equals final
            ]);
        });
    });

    test("print.brs", () => {
        return execute([ resourceFile("print.brs") ], outputStreams).then(() => {
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
    });

    test("reserved-words.brs", () => {
        return execute([ resourceFile("reserved-words.brs") ], outputStreams).then(() => {
            expect(
                allArgs(outputStreams.stdout.write).filter(arg => arg !== "\n")
            ).toEqual([
                // note: associative array keys are sorted before iteration
                "createobject", "in", "run", "stop"
            ]);
        });
    });
});
