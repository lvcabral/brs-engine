const brs = require("brs");
const { BrsString, BrsInvalid, Int32, RoArray, RoAssociativeArray } = brs.types;
const { Run } = require("../../lib/stdlib");
const { Interpreter } = require("../../lib/interpreter");
const fs = require("fs");

jest.mock("fs");

describe("global Run function", () => {
    let interpreter;

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    afterEach(() => {
        fs.readFileSync.mockRestore();
    });

    it("returns invalid for unrecognized devices", () => {
        expect(Run.call(interpreter, new BrsString("notADevice:/etc/hosts"))).toBe(
            BrsInvalid.Instance
        );
    });

    it("returns invalid for unreadable files", () => {
        fs.readFileSync.mockImplementation(() => {
            throw new Error("file not found");
        });
        expect(Run.call(interpreter, new BrsString("notADevice:/etc/hosts"))).toBe(
            BrsInvalid.Instance
        );
    });

    it("returns invalid for lexing errors", () => {
        fs.readFileSync.mockImplementation(() => `can't lex this`);
        expect(Run.call(interpreter, new BrsString("pkg:/errors/lex.brs"))).toBe(
            BrsInvalid.Instance
        );
    });

    it("returns invalid for parse errors", () => {
        fs.readFileSync.mockImplementationOnce(() => `if return "parse error" exit while`);
        expect(Run.call(interpreter, new BrsString("pkg:/errors/parse.brs"))).toBe(
            BrsInvalid.Instance
        );
    });

    it("returns invalid for runtime errors", () => {
        fs.readFileSync.mockImplementationOnce(() => `sub main(): _ = {}: _.crash(): end sub`);
        expect(Run.call(interpreter, new BrsString("pkg:/errors/exec.brs"))).toBe(
            BrsInvalid.Instance
        );
    });

    it("returns invalid when provided a not-array component", () => {
        expect(Run.call(interpreter, new RoAssociativeArray([]))).toBe(BrsInvalid.Instance);
    });

    it("returns invalid when provided an empty array of files", () => {
        expect(Run.call(interpreter, new RoArray([]))).toBe(BrsInvalid.Instance);
    });

    it("returns invalid when provided an array with non-strings", () => {
        expect(Run.call(interpreter, new RoArray([BrsInvalid.Instance]))).toBe(BrsInvalid.Instance);
    });

    it("returns whatever the executed file returns", () => {
        fs.readFileSync.mockImplementationOnce(
            () => `function main(): return "I'm a return value!": end function`
        );
        expect(Run.call(interpreter, new BrsString("pkg:/success/exec.brs"))).toEqual(
            new BrsString("I'm a return value!")
        );
    });

    it("returns whatever the executed set of files return", () => {
        fs.readFileSync
            .mockImplementationOnce(() => `function main(): return greet(): end function`)
            .mockImplementationOnce(() => `function greet(): return "hello!": end function`);

        expect(
            Run.call(
                interpreter,
                new RoArray([
                    new BrsString("pkg:/success/exec.brs"),
                    new BrsString("pkg:/success/greet.brs"),
                ])
            )
        ).toEqual(new BrsString("hello!"));
    });

    describe("args", () => {
        it("accepts one argument", () => {
            fs.readFileSync.mockImplementationOnce(
                () => `function main(i as integer): return i: end function`
            );
            expect(
                Run.call(interpreter, new BrsString("pkg:/success/identity.brs"), new Int32(5))
            ).toEqual(new Int32(5));
        });

        it("accepts two arguments", () => {
            fs.readFileSync.mockImplementationOnce(
                () => `function main(a as integer, b as integer): return a + b: end function`
            );
            expect(
                Run.call(
                    interpreter,
                    new BrsString("pkg:/success/identity.brs"),
                    new Int32(5),
                    new Int32(3)
                )
            ).toEqual(new Int32(8));
        });

        it("returns invalid for type errors", () => {
            fs.readFileSync.mockImplementationOnce(
                () => `function main(i as integer): return i: end function`
            );
            expect(
                Run.call(
                    interpreter,
                    new BrsString("pkg:/success/identity.brs"),
                    new BrsString("not an integer")
                )
            ).toEqual(BrsInvalid.Instance);
        });
    });
});
