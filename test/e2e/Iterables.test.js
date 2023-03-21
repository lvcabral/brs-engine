const { execute } = require("../../lib/");

const { createMockStreams, resourceFile, allArgs } = require("./E2ETests");

describe("end to end iterables", () => {
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

    test("arrays.brs", async () => {
        await execute([resourceFile("arrays.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
            "1",
            "4",
            "9", // squared values, via for-each
            "27", // two-dimensional index
            "16", // 2 ^ 4
            "foo bar", // oneDimensional[0] += " bar"
        ]);
    });

    test("associative-arrays.brs", async () => {
        await execute([resourceFile("associative-arrays.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).filter((arg) => arg !== "\n")).toEqual([
            // iterate through keys
            "has-second-layer",
            "level",
            "secondLayer",

            // twoDimensional.secondLayer.level
            "2",

            // after adding a third layer, twoDimensional.secondLayer.thirdLayer.level
            "3",

            // modify twoDimensional.secondLayer.level to sanity-check *= and friends
            "6",

            // add `false` via expression to `empty`
            "false",
        ]);
    });
});
