const { execute } = require("../../lib/");
const path = require("path");

const { createMockStreams, resourceFile, allArgs } = require("./E2ETests");

describe("end to end conditional compilation", () => {
    let outputStreams;

    beforeEach(() => {
        outputStreams = createMockStreams();
    });

    test("conditional-compilation/conditionals.brs", () => {
        return execute(
            [ resourceFile("conditional-compilation", "conditionals.brs") ],
            Object.assign(
                outputStreams,
                { root: path.join(process.cwd(), "test", "e2e", "resources", "conditional-compilation") }
            )
        ).then(() => {
            expect(
                allArgs(outputStreams.stdout.write).filter(arg => arg !== "\n")
            ).toEqual([
                "I'm ipsum!"
            ]);
        });
    });

    describe("(with sterr captured)", () => {
        test("conditional-compilation/compile-error.brs", (done) => {
            // make console.error empty so we don't clutter test output
            let stderr = jest.spyOn(console, "error").mockImplementation(() => {});

            return execute([ resourceFile("conditional-compilation", "compile-error.brs") ], outputStreams)
                .then(() => {
                    stderr.mockRestore()
                    done.fail("execute() should have rejected");
                })
                .catch(() => {
                    expect(
                        allArgs(stderr).filter(arg => arg !== "\n")
                    ).toEqual([
                        expect.stringContaining("I'm a compile-time error!")
                    ]);

                    stderr.mockRestore()
                    done();
                });
        });
    });
});
