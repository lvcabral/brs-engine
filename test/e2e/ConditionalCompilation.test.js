const { execute } = require("../../lib/");
const BrsError = require("../../lib/Error");
const path = require("path");

const { createMockStreams, resourceFile, allArgs } = require("./E2ETests");

describe("end to end conditional compilation", () => {
    let outputStreams;

    beforeEach(() => {
        outputStreams = createMockStreams();
    });

    afterEach(() => {
        BrsError.reset();
    });

    test("conditional-compilation/conditionals.brs", () => {
        return execute(
            [ resourceFile("conditional-compilation", "conditionals.brs") ],
            Object.assign(
                outputStreams,
                { root: path.join(process.cwd(), "test", "e2e", "resources", "conditional-compilation") }
            )
        ).then(() => {
            expect(BrsError.found()).toBe(false);
            expect(
                allArgs(outputStreams.stdout.write).filter(arg => arg !== "\n")
            ).toEqual([
                "I'm ipsum!"
            ]);
        });
    });

    describe("(with sterr captured)", () => {
        test("conditional-compilation/compile-error.brs", (done) => {
            let originalNodeEnv = process.env.NODE_ENV;
            // switch NODE_ENV to not-test, to ensure errors get logged
            process.env.NODE_ENV = "jest";
            // but make console.error empty so we don't clutter test output
            let stderr = jest.spyOn(console, "error").mockImplementation(() => {});

            return execute([ resourceFile("conditional-compilation", "compile-error.brs") ], outputStreams)
                .then(() => {
                    stderr.mockRestore()
                    process.env.NODE_ENV = originalNodeEnv;
                    done.fail("execute() should have rejected");
                })
                .catch(() => {
                    expect(BrsError.found()).toBe(true);
                    expect(
                        allArgs(stderr).filter(arg => arg !== "\n")
                    ).toEqual([
                        `[Line 2] I'm a compile-time error!`
                    ]);

                    stderr.mockRestore()
                    process.env.NODE_ENV = originalNodeEnv;
                    done();
                });
        });
    });
});
