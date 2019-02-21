const { execute } = require("../../lib/");

const { createMockStreams, resourceFile, allArgs } = require("./E2ETests");

describe("function argument type checking", () => {
    let outputStreams;

    beforeAll(() => {
        // make console.error empty so we don't clutter test output
        stderr = jest.spyOn(console, "error").mockImplementation(() => {});
        outputStreams = createMockStreams();
    });

    afterEach(() => {
        stderr.mockClear();
    });

    afterAll(() => {
        stderr.mockRestore()
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
                /Attempting to return value of type Integer, but function returnsString declares return value of type String/
            );
        });

    });
});
