const brs = require("../../bin/brs.node");
const { BrsString, BrsInvalid, Int32, RoArray, RoAssociativeArray } = brs.types;
const { Run } = brs.stdlib;
const { Interpreter } = brs;
const fs = require("fs");

jest.mock("fs");

describe("global Run function", () => {
    let interpreter;
    brs.registerCallback(() => {}); // register a callback to avoid display errors

    beforeEach(() => {
        interpreter = new Interpreter({ root: process.cwd() });
    });

    afterEach(() => {
        fs.readFileSync.mockRestore();
    });

    it("returns invalid for unrecognized devices", async () => {
        expect(await Run.call(interpreter, new BrsString("notADevice:/etc/hosts"))).toBe(
            BrsInvalid.Instance
        );
    });

    it("returns invalid for unreadable files", async () => {
        fs.readFileSync.mockImplementation(() => {
            throw new Error("file not found");
        });
        expect(await Run.call(interpreter, new BrsString("notADevice:/etc/hosts"))).toBe(
            BrsInvalid.Instance
        );
    });

    it("returns invalid for lexing errors", async () => {
        fs.readFileSync.mockImplementation(() => `can't lex this`);
        expect(await Run.call(interpreter, new BrsString("pkg:/errors/lex.brs"))).toBe(
            BrsInvalid.Instance
        );
    });

    it("returns invalid for parse errors", async () => {
        fs.readFileSync.mockImplementationOnce(() => `if return "parse error" exit while`);
        expect(await Run.call(interpreter, new BrsString("pkg:/errors/parse.brs"))).toBe(
            BrsInvalid.Instance
        );
    });

    it("returns invalid for runtime errors", async () => {
        fs.readFileSync.mockImplementationOnce(() => `sub main(): _ = {}: _.crash(): end sub`);
        expect(await Run.call(interpreter, new BrsString("pkg:/errors/exec.brs"))).toBe(
            BrsInvalid.Instance
        );
    });

    it("returns invalid when provided a not-array component", async () => {
        expect(await Run.call(interpreter, new RoAssociativeArray([]))).toBe(BrsInvalid.Instance);
    });

    it("returns invalid when provided an empty array of files", async () => {
        expect(await Run.call(interpreter, new RoArray([]))).toBe(BrsInvalid.Instance);
    });

    it("returns invalid when provided an array with non-strings", async () => {
        expect(await Run.call(interpreter, new RoArray([BrsInvalid.Instance]))).toBe(
            BrsInvalid.Instance
        );
    });

    it("returns whatever the executed file returns", async () => {
        fs.existsSync.mockImplementationOnce(() => true);
        fs.readFileSync.mockImplementationOnce(
            () => `function main(): return "I'm a return value!": end function`
        );
        expect(await Run.call(interpreter, new BrsString("pkg:/success/exec.brs"))).toEqual(
            new BrsString("I'm a return value!")
        );
    });

    it("returns whatever the executed set of files return", async () => {
        fs.existsSync.mockImplementationOnce(() => true).mockImplementationOnce(() => true);
        fs.readFileSync
            .mockImplementationOnce(() => `function main(): return greet(): end function`)
            .mockImplementationOnce(() => `function greet(): return "hello!": end function`);

        expect(
            await Run.call(
                interpreter,
                new RoArray([
                    new BrsString("pkg:/success/exec.brs"),
                    new BrsString("pkg:/success/greet.brs"),
                ])
            )
        ).toEqual(new BrsString("hello!"));
    });

    describe("args", () => {
        it("accepts one argument", async () => {
            fs.existsSync.mockImplementationOnce(() => true);
            fs.readFileSync.mockImplementationOnce(
                () => `function main(i as integer): return i: end function`
            );
            expect(
                await Run.call(
                    interpreter,
                    new BrsString("pkg:/success/identity.brs"),
                    new Int32(5)
                )
            ).toEqual(new Int32(5));
        });

        it("accepts two arguments", async () => {
            fs.existsSync.mockImplementationOnce(() => true);
            fs.readFileSync.mockImplementationOnce(
                () => `function main(a as integer, b as integer): return a + b: end function`
            );
            expect(
                await Run.call(
                    interpreter,
                    new BrsString("pkg:/success/identity.brs"),
                    new Int32(5),
                    new Int32(3)
                )
            ).toEqual(new Int32(8));
        });

        it("returns invalid for type errors", async () => {
            fs.readFileSync.mockImplementationOnce(
                () => `function main(i as integer): return i: end function`
            );
            expect(
                await Run.call(
                    interpreter,
                    new BrsString("pkg:/success/identity.brs"),
                    new BrsString("not an integer")
                )
            ).toEqual(BrsInvalid.Instance);
        });
    });
});
