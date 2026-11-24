const brs = require("../../../packages/node/bin/brs.node");

const { deindent } = require("../ParserTests");

// Device-confirmed by test/simulator/probes/loop-exit-scope-probe.
const exitFor = "Exit For is not inside a For loop. (compile error &ha5)";
const continueFor = "Continue For is not inside a For loop (compile error &h8d)";
const exitWhile = "Exit While is not inside a While. (compile error &haf)";
const continueWhile = "Continue While is not inside a While (compile error &h8e)";

function parseErrors(source) {
    const { tokens } = brs.Lexer.scan(deindent(source));
    return new brs.Parser().parse(tokens).errors.map((error) => error.message);
}

describe("parser loop exit scope", () => {
    it.each([
        ["exit for", exitFor],
        ["continue for", continueFor],
        ["exit while", exitWhile],
        ["continue while", continueWhile],
    ])("rejects `%s` outside any loop", (statement, message) => {
        expect(
            parseErrors(`
                sub main()
                    ${statement}
                end sub
            `)
        ).toEqual([message]);
    });

    it("rejects `exit while` and `continue while` inside a for loop with no enclosing while", () => {
        expect(
            parseErrors(`
                sub main()
                    for i = 1 to 2
                        exit while
                        continue while
                    end for
                end sub
            `)
        ).toEqual([exitWhile, continueWhile]);
    });

    it("rejects `exit for` and `continue for` inside a while loop with no enclosing for", () => {
        expect(
            parseErrors(`
                sub main()
                    while true
                        exit for
                        continue for
                    end while
                end sub
            `)
        ).toEqual([exitFor, continueFor]);
    });

    it("accepts a loop exit for an outer loop of the other kind", () => {
        expect(
            parseErrors(`
                sub main()
                    for i = 1 to 2
                        while true
                            exit for
                            continue for
                        end while
                    end for
                    while true
                        for each v in [1, 2]
                            exit while
                            continue while
                        end for
                    end while
                end sub
            `)
        ).toEqual([]);
    });

    it("accepts `exit for` inside a for each loop", () => {
        expect(
            parseErrors(`
                sub main()
                    for each v in [1, 2]
                        exit for
                    end for
                end sub
            `)
        ).toEqual([]);
    });

    it("starts a function body outside any loop and restores the loop after it", () => {
        expect(
            parseErrors(`
                sub main()
                    for i = 1 to 2
                        f = function()
                            exit for
                        end function
                        exit for
                    end for
                end sub
            `)
        ).toEqual([exitFor]);
    });
});
