const path = require("path");
const stream = require("stream");

/** Returns the path to a file in `resources/`. */
exports.resourceFile = function(...filenameParts) {
    return path.join(__dirname, "resources", ...filenameParts);
};

/**
 * Extracts all arguments from all calls to a Jest mock function.
 * @param jestMock the mock to extract arguments from
 * @returns an array containing every argument from every call to a Jest mock.
 */
exports.allArgs = function(jestMock) {
    return (
        jestMock.mock.calls
            // flatten arguments to `stdout.write` into a single array
            .reduce((allArgs, thisCall) => allArgs.concat(thisCall), [])
    );
};

/** Creates a set of mocked streams, suitable for use in place of `process.stdout` and `process.stderr`. */
exports.createMockStreams = function() {
    const stdout = Object.assign(new stream.PassThrough(), process.stdout);
    const stderr = Object.assign(new stream.PassThrough(), process.stderr);
    jest.spyOn(stdout, "write").mockImplementation(() => {});
    jest.spyOn(stderr, "write").mockImplementation(() => {});

    return { stdout, stderr };
};
