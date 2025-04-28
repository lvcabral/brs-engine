const path = require("path");
const { execute, createMockStreams, resourceFile, allArgs } = require("./E2ETests");

describe("end to end conditional compilation", () => {
    let outputStreams;

    beforeEach(() => {
        outputStreams = createMockStreams();
    });

    test("conditional-compilation/conditionals.brs", async () => {
        await execute(
            [
                resourceFile("conditional-compilation", "manifest"),
                resourceFile("conditional-compilation", "conditionals.brs"),
            ],
            outputStreams
        );

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual(["I'm ipsum!"]);
    });

    describe("(with sterr captured)", () => {
        test("conditional-compilation/compile-error.brs", async () => {
            await execute(
                [
                    resourceFile("conditional-compilation", "manifest"),
                    resourceFile("conditional-compilation", "compile-error.brs"),
                ],
                outputStreams
            ).catch((err) => {
                expect(err.message.trimEnd()).toMatch(/I'm a compile-time error!/);
            });
        });
    });
});
