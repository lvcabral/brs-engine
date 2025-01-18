const brs = require("../../bin/brs.node");
const { Interpreter } = brs;
const { FormatJson, ParseJson } = brs.stdlib;
const {
    RoArray,
    RoAssociativeArray,
    RoDateTime,
    BrsBoolean,
    BrsInvalid,
    BrsString,
    Float,
    Int32,
    Int64,
    RoInt,
    Uninitialized,
} = brs.types;

const { allArgs, createMockStreams } = require("../e2e/E2ETests");

let interpreter;
let outputStreams;

async function expectConsoleError(expected, fn) {
    await fn();
    const output = allArgs(outputStreams.stderr.write);
    return expect(output[0]).toMatch(expected);
}

describe("global JSON functions", () => {
    beforeAll(() => {
        outputStreams = createMockStreams();
        interpreter = new Interpreter(outputStreams);
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    describe("FormatJson", () => {
        it("rejects non-convertible types", async () => {
            expectConsoleError(/BRIGHTSCRIPT: ERROR: FormatJSON: /, async () => {
                await expect(FormatJson.call(interpreter, new RoDateTime())).resolves.toEqual(
                    new BrsString("")
                );
            });
        });

        it("returns `null` for non-convertible types (flag 256)", async () => {
            expect(await FormatJson.call(interpreter, new RoDateTime(), new Int32(256))).toEqual(
                new BrsString("null")
            );
        });

        it("returns the type annotation for non-convertible types (flag 512)", async () => {
            expect(await FormatJson.call(interpreter, new RoDateTime(), new Int32(512))).toEqual(
                new BrsString(`"<roDateTime>"`)
            );
        });

        it("rejects nested associative array references", async () => {
            let aa = new RoAssociativeArray([
                { name: new BrsString("foo"), value: new BrsString("bar") },
                { name: new BrsString("lorem"), value: Float.fromString("1.234") },
            ]);
            aa.set(new BrsString("self"), aa);
            expectConsoleError(
                /BRIGHTSCRIPT: ERROR: FormatJSON: Nested object reference/,
                async () => {
                    expect(await FormatJson.call(interpreter, aa)).toEqual(new BrsString(""));
                }
            );
        });

        it("rejects nested array references", async () => {
            let a = new RoArray([new BrsString("bar"), Float.fromString("1.234")]);
            await a.getMethod("push").call(interpreter, a);
            expectConsoleError(
                /BRIGHTSCRIPT: ERROR: FormatJSON: Nested object reference/,
                async () => {
                    expect(await FormatJson.call(interpreter, a)).toEqual(new BrsString(""));
                }
            );
        });

        it("converts BRS invalid to bare null string", async () => {
            expect(await FormatJson.call(interpreter, BrsInvalid.Instance)).toEqual(
                new BrsString("null")
            );
        });

        it("converts BRS false to bare false string", async () => {
            expect(await FormatJson.call(interpreter, BrsBoolean.False)).toEqual(
                new BrsString("false")
            );
        });

        it("converts BRS string to bare (quoted) string", async () => {
            expect(await FormatJson.call(interpreter, new BrsString("ok"))).toEqual(
                new BrsString(`"ok"`)
            );
        });

        it("converts BRS integer to bare integer string", async () => {
            expect(await FormatJson.call(interpreter, Int32.fromString("2147483647"))).toEqual(
                new BrsString("2147483647")
            );
        });

        it("converts boxed BRS types to string representations", async () => {
            expect(await FormatJson.call(interpreter, new RoInt(new Int32(-1)))).toEqual(
                new BrsString("-1")
            );
        });

        it("converts BRS longInteger to bare longInteger string", async () => {
            expect(
                await FormatJson.call(interpreter, Int64.fromString("9223372036854775807"))
            ).toEqual(new BrsString("9223372036854775807"));
        });

        it("converts BRS float to bare float string, within seven significant digits", async () => {
            let actual = await FormatJson.call(
                interpreter,
                Float.fromString("3.141592653589793238462643383279502884197169399375")
            );
            expect(actual).toBeInstanceOf(BrsString);
            expect(Number.parseFloat(actual.toString())).toBeCloseTo(
                Number.parseFloat("3.141592653589793238462643383279502884197169399375"),
                Float.IEEE_FLOAT_SIGFIGS
            );
        });

        it("converts from BRS array", async () => {
            let roArray = new RoArray([
                new BrsBoolean(false),
                Float.fromString("3.14"),
                Int32.fromString("2147483647"),
                Int64.fromString("9223372036854775807"),
                BrsInvalid.Instance,
                new BrsString("ok"),
            ]);
            expect(await FormatJson.call(interpreter, roArray)).toEqual(
                new BrsString(`[false,3.14,2147483647,9223372036854775807,null,"ok"]`)
            );
        });

        it("converts from BRS associative array to key-sorted JSON string", async () => {
            let brsAssociativeArrayDesc = new RoAssociativeArray([
                { name: new BrsString("string"), value: new BrsString("ok") },
                { name: new BrsString("null"), value: BrsInvalid.Instance },
                {
                    name: new BrsString("longinteger"),
                    value: Int64.fromString("9223372036854775807"),
                },
                { name: new BrsString("integer"), value: Int32.fromString("2147483647") },
                { name: new BrsString("float"), value: Float.fromString("3.14") },
                { name: new BrsString("boolean"), value: new BrsBoolean(false) },
            ]);
            let brsAssociativeArrayStrAsc = new BrsString(
                `{"boolean":false,"float":3.14,"integer":2147483647,"longinteger":9223372036854775807,"null":null,"string":"ok"}`
            );
            expect(await FormatJson.call(interpreter, brsAssociativeArrayDesc)).toEqual(
                brsAssociativeArrayStrAsc
            );
        });
    });

    describe("ParseJson", () => {
        it("rejects empty strings with special case message", async () => {
            expectConsoleError(/BRIGHTSCRIPT: ERROR: ParseJSON: Data is empty/, async () => {
                expect(await ParseJson.call(interpreter, new BrsString(""))).toBe(
                    BrsInvalid.Instance
                );
            });
        });

        it("converts bare null string to BRS invalid", async () => {
            expect(await ParseJson.call(interpreter, new BrsString("null"))).toBe(
                BrsInvalid.Instance
            );
        });

        it("converts bare false string to BRS false", async () => {
            expect(await ParseJson.call(interpreter, new BrsString("false"))).toBe(
                BrsBoolean.False
            );
        });

        it("converts bare (quoted) string to BRS string", async () => {
            expect(await ParseJson.call(interpreter, new BrsString(`"ok"`))).toEqual(
                new BrsString("ok")
            );
        });

        it("converts bare integer string to BRS integer", async () => {
            expect(await ParseJson.call(interpreter, new BrsString("2147483647"))).toEqual(
                Int32.fromString("2147483647")
            );
        });

        it("converts bare longInteger string to BRS longInteger", async () => {
            expect(await ParseJson.call(interpreter, new BrsString("9223372036854775807"))).toEqual(
                Int64.fromString("9223372036854775807")
            );
        });

        it("converts bare float string to BRS float, within seven significant digits", async () => {
            let actual = await ParseJson.call(
                interpreter,
                new BrsString("3.141592653589793238462643383279502884197169399375")
            );
            expect(actual).toBeInstanceOf(Float);
            expect(actual.getValue()).toBeCloseTo(
                Number.parseFloat("3.141592653589793238462643383279502884197169399375"),
                Float.IEEE_FLOAT_SIGFIGS
            );
        });

        it("converts to BRS array", async () => {
            let expected = new RoArray([
                new BrsBoolean(false),
                Float.fromString("3.14"),
                Int32.fromString("2147483647"),
                Int64.fromString("9223372036854775807"),
                BrsInvalid.Instance,
                new BrsString("ok"),
            ]);
            let actual = await ParseJson.call(
                interpreter,
                new BrsString(`[false,3.14,2147483647,9223372036854775807,null,"ok"]`)
            );
            expect(actual).toBeInstanceOf(RoArray);
            expect(actual.getElements()).toEqual(expected.getElements());
        });

        it("converts to BRS associative array", async () => {
            let expected = new RoAssociativeArray([
                { name: new BrsString("string"), value: new BrsString("ok") },
                { name: new BrsString("null"), value: BrsInvalid.Instance },
                {
                    name: new BrsString("longinteger"),
                    value: Int64.fromString("9223372036854775807"),
                },
                { name: new BrsString("integer"), value: Int32.fromString("2147483647") },
                { name: new BrsString("float"), value: Float.fromString("3.14") },
                { name: new BrsString("boolean"), value: new BrsBoolean(false) },
            ]);
            let brsAssociativeArrayStrAsc = new BrsString(
                `{"boolean":false,"float":3.14,"integer":2147483647,"longinteger":9223372036854775807,"null":null,"string":"ok"}`
            );
            let actual = await ParseJson.call(interpreter, brsAssociativeArrayStrAsc);
            expect(actual).toBeInstanceOf(RoAssociativeArray);
            actualKeys = actual.getElements();
            expect(actualKeys).toEqual(expected.getElements());
            actualKeys.forEach((key) => {
                expect(actual.get(key)).toEqual(expected.get(key));
            });
        });
    });
});
