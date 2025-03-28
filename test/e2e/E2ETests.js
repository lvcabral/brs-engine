const path = require("path");
const stream = require("stream");
const brs = require("../../bin/brs.node");
const { createPayloadFromFiles, executeFile } = brs;

brs.registerCallback(() => {}); // register a callback to avoid display errors

const deviceData = {
    audioCodecs: audioCodecs(),
    videoFormats: videoFormats(),
};

/** Returns the path to a file in `resources/`. */
exports.resourceFile = function (...filenameParts) {
    return path.join("test", "e2e", "resources", ...filenameParts);
};

/**
 * Extracts all arguments from all calls to a Jest mock function.
 * @param jestMock the mock to extract arguments from
 * @returns an array containing every argument from every call to a Jest mock.
 */
exports.allArgs = function (jestMock) {
    return (
        jestMock.mock.calls
            // flatten arguments to `stdout.write` into a single array
            .reduce((allArgs, thisCall) => allArgs.concat(thisCall), [])
    );
};

/** Creates a set of mocked streams, suitable for use in place of `process.stdout` and `process.stderr`. */
exports.createMockStreams = function () {
    const stdout = Object.assign(new stream.PassThrough(), process.stdout);
    const stderr = Object.assign(new stream.PassThrough(), process.stderr);

    return {
        stdout,
        stderr,
        stdoutSpy: jest.spyOn(stdout, "write").mockImplementation(() => {}),
        stderrSpy: jest.spyOn(stderr, "write").mockImplementation(() => {}),
        post: false,
    };
};

/** Executes the specified BrightScript files, capturing their output in the provided streams. */
exports.execute = async function (filenames, options, deepLink) {
    brs.BrsDevice.fileSystem.resetMemoryFS();
    const payload = await createPayloadFromFiles(filenames, deviceData);
    if (deepLink) {
        payload.deepLink = deepLink;
    }
    await executeFile(payload, options);
};

function audioCodecs() {
    return ["mp3", "mpeg", "ogg", "oga", "wav", "aac", "m4a", "flac"];
}

function videoFormats() {
    const codecs = ["mpeg1", "mpeg2", "mpeg4 avc", "vp9"];
    const containers = ["mp4", "m4v", "mov", "mkv", "hls"];
    return new Map([
        ["codecs", codecs],
        ["containers", containers],
    ]);
}
