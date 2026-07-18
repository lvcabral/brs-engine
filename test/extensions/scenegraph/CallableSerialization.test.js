const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { jsValueOf, brsValueOf, ComponentDefinition, sgRoot } = scenegraph;
const { Interpreter, Lexer, Parser, Callable, RoAssociativeArray, BrsString, isBrsCallable } = core;

/** Simulates the structured/JSON round-trip a value undergoes when sent to a Task thread. */
function transfer(serialized) {
    return JSON.parse(JSON.stringify(serialized));
}

/**
 * Function values stored in a Task component's `m` (e.g. `m.helper.getOptions = function() ...`)
 * must survive the cross-thread copy of `m`: on a device the Task thread's copy keeps them
 * callable. A serialized callable is a name + source location; the receiving thread rebuilds it
 * from the component AST retained on its ComponentDefinition (BrightScript has no lexical
 * closures, so the AST alone reproduces the function).
 */
describe("cross-thread serialization of function values", () => {
    const source = [
        "function makeHelper() as Object",
        "    return {",
        "        getOptions: function() as Object",
        '            return { source: "anon", tag: m.tag }',
        "        end function",
        "    }",
        "end function",
        "",
        "function namedGetter() as Object",
        '    return { source: "named" }',
        "end function",
    ].join("\n");

    let interpreter;
    let statements;
    let helperAA;
    let mPointer;

    beforeEach(() => {
        const lexer = new Lexer();
        const parser = new Parser();
        const scanResults = lexer.scan(source, "pkg:/components/HelperTask.brs");
        statements = parser.parse(scanResults.tokens).statements;

        interpreter = new Interpreter();
        interpreter.exec(statements);

        // Simulate the task-thread side: the component definition retains its parsed scope.
        const def = new ComponentDefinition("pkg:/components/HelperTask.xml");
        def.scopeStatements = statements;
        sgRoot.setNodeDefMap(new Map([["helpertask", def]]));

        mPointer = new RoAssociativeArray([{ name: new BrsString("tag"), value: new BrsString("bound") }]);
        const makeHelper = interpreter.getCallableFunction("makehelper");
        helperAA = interpreter.call(makeHelper, [], mPointer, interpreter.location);
    });

    function callRestored(callable) {
        const result = interpreter.call(callable, [], mPointer, interpreter.location);
        return jsValueOf(result);
    }

    test("an anonymous function round-trips on the same thread via the registry", () => {
        const original = helperAA.get(new BrsString("getOptions"));
        expect(isBrsCallable(original)).toBe(true);

        const restored = brsValueOf(transfer(jsValueOf(original)));
        // Same worker: the anonymous-callable registry returns the very same instance.
        expect(restored).toBe(original);
    });

    test("an anonymous function transferred to another worker is rebuilt from the AST", () => {
        const original = helperAA.get(new BrsString("getOptions"));
        const serialized = transfer(jsValueOf(original));
        expect(serialized._callable_).toMatch(/^\$anon_/);
        expect(serialized._location_.file).toBe("pkg:/components/HelperTask.brs");

        // Another worker mints its own $anon_N ids, so the name misses (or mismatches) the local
        // registry there. Simulate that with an id this worker never issued.
        serialized._callable_ = "$anon_9999999";
        const restored = brsValueOf(serialized);

        expect(restored).not.toBe(original);
        expect(isBrsCallable(restored)).toBe(true);
        // The rebuilt function executes its real body, with `m` bound to the receiver at call time.
        expect(callRestored(restored)).toEqual({ source: "anon", tag: "bound" });
        // The original name is preserved so toStr() output round-trips.
        expect(restored.getName()).toBe("$anon_9999999");
    });

    test("a named function reference is rebuilt from the AST", () => {
        const original = interpreter.getCallableFunction("namedgetter");
        const serialized = transfer(jsValueOf(original));
        expect(serialized._callable_).toBe("namedGetter");
        expect(serialized._location_).toBeDefined();

        const restored = brsValueOf(serialized);
        expect(isBrsCallable(restored)).toBe(true);
        expect(callRestored(restored)).toEqual({ source: "named" });
    });

    test("an unresolvable function falls back to a stub returning uninitialized", () => {
        const restored = brsValueOf({ _callable_: "vanished" });
        expect(isBrsCallable(restored)).toBe(true);
        const result = restored.call(interpreter);
        expect(result.toString()).toBe("<UNINITIALIZED>");
    });

    test("a built-in callable still serializes as a bare name (no location)", () => {
        const builtIn = new Callable("ucase", {
            signature: { args: [], returns: 0 },
            impl: () => {},
        });
        const serialized = jsValueOf(builtIn);
        expect(serialized._callable_).toBe("ucase");
        expect(serialized._location_).toBeUndefined();
    });
});
