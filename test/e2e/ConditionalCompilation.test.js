const { execute } = require("../../lib/");
const BrsError = require("../../lib/Error");

const { createMockStreams, resourceFile, allArgs } = require("./E2ETests");

describe("end to end conditional compilation", () => {
    let outputStreams;
    let originalNodeEnv;

    beforeAll(() => {
        originalNodeEnv = process.env.NODE_ENV;
        // switch NODE_ENV to not-test, to ensure errors get logged
        process.env.NODE_ENV = "jest";
        // but make console.error empty so we don't clutter test output
        stderr = jest.spyOn(console, "error").mockImplementation(() => {});
        outputStreams = createMockStreams();
    });

    afterEach(() => {
        stderr.mockClear();
        BrsError.reset();
    });

    afterAll(() => {
        stderr.mockRestore()
        process.env.NODE_ENV = originalNodeEnv;
    });

    test("conditional-compilation/conditionals.brs", () => {
        return execute([ resourceFile("conditional-compilation", "conditionals.brs") ], outputStreams).then(() => {
            expect(BrsError.found()).toBe(false);
            expect(
                allArgs(outputStreams.stdout.write).filter(arg => arg !== "\n")
            ).toEqual([
                "I'm ipsum!"
            ]);
        });
    });

    test("conditional-compilation/compile-error.brs", () => {
        return execute([ resourceFile("conditional-compilation", "compile-error.brs") ], outputStreams).catch((err) => {
            expect(BrsError.found()).toBe(true);
            expect(
                allArgs(stderr).filter(arg => arg !== "\n")
            ).toEqual([
                `[Line 2] I'm a compile-time error!`
            ]);
        });
    });
});
