const { execute } = require("../../lib/");
const BrsError = require("../../lib/Error");

const { createMockStreams, resourceFile, allArgs } = require("./E2ETests");

describe("function argument type checking", () => {
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

    it("errors when too few args are passed", () => {
        return execute([ resourceFile("type-checking", "too-few-args.brs") ], outputStreams).catch(() => {
            const output = allArgs(stderr);
            expect(output[0]).toMatch(/UCase requires at least 1 arguments, but received 0\./);
        });
    });

    it("errors when too many args are passed", () => {
        return execute([ resourceFile("type-checking", "too-many-args.brs") ], outputStreams).catch(() => {
            const output = allArgs(stderr);
            expect(output[0]).toMatch(/RebootSystem accepts at most 0 arguments, but received 1\./);
        });
    });

    it("errors when mismatched types are provided as arguments", () => {
        return execute([ resourceFile("type-checking", "arg-type-mismatch.brs") ], outputStreams).catch(() => {
            const output = allArgs(stderr);
            expect(output[0]).toMatch(
                /Argument 's' must be of type String, but received Boolean./
            );
        });
    });


    it("errors when returning a mismatched type from a function", () => {
        return execute([ resourceFile("type-checking", "mismatched-return-type.brs") ], outputStreams).catch(() => {
            const output = allArgs(stderr);
            expect(output[0]).toMatch(
                /\[Line .\] Attempting to return value of type Integer, but function returnsString declares return value of type String/
            );
        });

    });
});
