const { Environment, Scope } = require("../../lib/interpreter/Environment");
const brs = require("brs");
const { Lexeme } = brs.lexer;
const { BrsString, RoAssociativeArray, Int32, BrsInvalid } = brs.types;

const { token, identifier } = require("../parser/ParserTests");

describe("Environment", () => {
    let env;
    let lineNumber;

    /** Creates an identifier with the given text. */
    let identifier = text => ({ kind: Lexeme.Identifier, text: text, line: lineNumber++ });

    beforeEach(() => {
        env = new Environment();
        lineNumber = 0;
    });

    it("gets and sets from Function scope", () => {
        let val = new BrsString("functionScope");
        env.define(Scope.Function, "foo", val);

        expect(env.get(identifier("foo"))).toBe(val);
    });

    it("gets and sets from Module scope", () => {
        let val = new BrsString("moduleScope");
        env.define(Scope.Module, "foo", val);

        expect(env.get(identifier("foo"))).toBe(val);
    });

    it("gets and sets from Module scope", () => {
        let val = new BrsString("globalScope");
        env.define(Scope.Global, "foo", val);

        expect(env.get(identifier("foo"))).toBe(val);
    });

    it("gets and sets an m pointer", () => {
        let newM = new RoAssociativeArray([{ name: new BrsString("id"), value: new Int32(1738) }]);
        env.setM(newM);

        expect(env.get(identifier("m"))).toBe(newM);
    });

    it("gets and sets from Mock scope", () => {
        let val = new BrsString("mockScope");
        env.define(Scope.Mock, "_brs_", val);

        expect(env.get(identifier("_brs_"))).toBe(val);
    });

    it("gets the current line number", () => {
        let lineNum = {
            kind: Lexeme.Identifier,
            text: "line_num",
            isReserved: true,
            location: {
                file: "does-not-exist.brs",
                start: {
                    line: 13,
                    column: 0,
                },
                end: {
                    line: 13,
                    column: 9,
                },
            },
        };

        expect(env.get(lineNum)).toEqual(new Int32(13));
    });

    it("checks all sources for existence", () => {
        let foo = new BrsString("function scope");
        let bar = new BrsString("module scope");
        let baz = new BrsString("global scope");
        let rah = new BrsString("mock scope");

        env.define(Scope.Function, "foo", foo);
        env.define(Scope.Module, "bar", bar);
        env.define(Scope.Global, "baz", baz);
        env.define(Scope.Mock, "rah", rah);

        expect(env.has(identifier("m"))).toBe(true);

        expect(env.has(identifier("foo"))).toBe(true);
        expect(env.has(identifier("bar"))).toBe(true);
        expect(env.has(identifier("baz"))).toBe(true);
        expect(env.has(identifier("rah"))).toBe(true);
    });

    it("removes only from Function scope", () => {
        let foo = new BrsString("function scope");
        let bar = new BrsString("module scope");
        let baz = new BrsString("global scope");
        let rah = new BrsString("mock scope");

        env.define(Scope.Function, "foo", foo);
        env.define(Scope.Module, "bar", bar);
        env.define(Scope.Global, "baz", baz);
        env.define(Scope.Mock, "rah", rah);

        env.remove("foo");
        env.remove("bar");
        env.remove("baz");
        env.remove("rah");

        expect(env.has(identifier("foo"))).toBe(false);
        expect(env.has(identifier("bar"))).toBe(true);
        expect(env.has(identifier("baz"))).toBe(true);
        expect(env.has(identifier("rah"))).toBe(true);
    });

    it("creates sub-environments without Function-scoped variables", () => {
        env.define(Scope.Function, "funcScoped", new BrsString("funcScoped"));
        env.define(Scope.Module, "moduleScoped", new BrsString("module-scoped"));
        env.define(Scope.Global, "globalScoped", new BrsString("global-scoped"));
        env.define(Scope.Mock, "mockScoped", new BrsString("mock-scoped"));
        env.setM(new RoAssociativeArray([{ name: new BrsString("id"), value: new Int32(679) }]));

        let subEnv = env.createSubEnvironment();

        expect(subEnv.has(identifier("funcScoped"))).toBe(false);
        expect(subEnv.has(identifier("moduleScoped"))).toBe(true);
        expect(subEnv.has(identifier("globalScoped"))).toBe(true);
        expect(subEnv.has(identifier("m"))).toBe(true);
        expect(subEnv.has(identifier("mockScoped"))).toBe(true);
    });

    it("gets & sets mock objects on the mock scope", () => {
        let obj = new RoAssociativeArray([]);
        env.setMock("mock1", obj);

        result = env.getMock("mock1");
        expect(result).toBe(obj);
    });

    it("returns instance of BrsInvalid if mock is not found", () => {
        result = env.getMock("no-mock-to-be-found");
        expect(result).toBeTruthy();
        expect(result).toBeInstanceOf(BrsInvalid);
    });
});
