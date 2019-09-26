const brs = require("brs");
const { Callable, BrsString, BrsInvalid, RoArray, RoAssociativeArray, ValueKind } = brs.types;
const { RunInScope } = require("../../lib/extensions/RunInScope");
const { Interpreter } = require("../../lib/interpreter");
const { Scope } = require("../../lib/interpreter/Environment");
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
        expect(RunInScope.call(interpreter, new BrsString("notADevice:/etc/hosts"))).toBe(
            BrsInvalid.Instance
        );
    });

    it("returns invalid for unreadable files", () => {
        fs.readFileSync.mockImplementation(() => {
            throw new Error("file not found");
        });
        expect(RunInScope.call(interpreter, new BrsString("notADevice:/etc/hosts"))).toBe(
            BrsInvalid.Instance
        );
    });

    it("returns invalid for lexing errors", () => {
        fs.readFileSync.mockImplementation(() => `can't lex this`);
        expect(RunInScope.call(interpreter, new BrsString("pkg:/errors/lex.brs"))).toBe(
            BrsInvalid.Instance
        );
    });

    it("returns invalid for parse errors", () => {
        fs.readFileSync.mockImplementationOnce(() => `if return "parse error" exit while`);
        expect(RunInScope.call(interpreter, new BrsString("pkg:/errors/parse.brs"))).toBe(
            BrsInvalid.Instance
        );
    });

    it("returns invalid for runtime errors", () => {
        fs.readFileSync.mockImplementationOnce(() => `sub main(): _ = {}: _.crash(): end sub`);
        expect(RunInScope.call(interpreter, new BrsString("pkg:/errors/exec.brs"))).toBe(
            BrsInvalid.Instance
        );
    });

    it("returns invalid when provided a not-array component", () => {
        expect(RunInScope.call(interpreter, new RoAssociativeArray([]))).toBe(BrsInvalid.Instance);
    });

    it("returns invalid when provided an empty array of files", () => {
        expect(RunInScope.call(interpreter, new RoArray([]))).toBe(BrsInvalid.Instance);
    });

    it("returns invalid when provided an array with non-strings", () => {
        expect(RunInScope.call(interpreter, new RoArray([BrsInvalid.Instance]))).toBe(
            BrsInvalid.Instance
        );
    });

    it("allows main to be redefined", () => {
        interpreter.environment.define(
            Scope.Module,
            "main",
            new Callable("main", {
                signature: {
                    args: [],
                    returns: ValueKind.Void,
                },
                impl: interpreter => {
                    // just an empty main function - it just needs to exist for this test
                    return BrsInvalid.Instance;
                },
            })
        );

        fs.readFileSync.mockImplementationOnce(
            () => `function main(): return "hello!": end function`
        );

        expect(RunInScope.call(interpreter, new BrsString("pkg:/success/exec.brs"))).toEqual(
            new BrsString("hello!")
        );
    });

    it("can call functions declared in original scope", () => {
        interpreter.environment.define(
            Scope.Module,
            "greet",
            new Callable("greet", {
                signature: {
                    args: [],
                    returns: ValueKind.String,
                },
                impl: interpreter => {
                    return new BrsString("hello!");
                },
            })
        );

        fs.readFileSync.mockImplementationOnce(
            () => `function main(): return greet(): end function`
        );

        expect(RunInScope.call(interpreter, new BrsString("pkg:/success/exec.brs"))).toEqual(
            new BrsString("hello!")
        );
    });
});
