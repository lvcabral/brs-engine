const BrsTypes = require("../../lib/brsTypes");
const { UCase, LCase } = require("../../lib/stdlib");
const { Interpreter } = require("../../lib/interpreter");

describe("Callable", () => {
    it("is less than nothing", () => {
        const brsValues = [
            new BrsTypes.Int32(1),
            new BrsTypes.Int64(2),
            new BrsTypes.Float(1.5),
            new BrsTypes.Double(2.5),
            new BrsTypes.BrsString("i'm super valid"),
            BrsTypes.BrsBoolean.False,
            BrsTypes.BrsInvalid.Instance,
            LCase,
        ];

        brsValues.forEach((other) => expect(UCase.lessThan(other)).toBe(BrsTypes.BrsBoolean.False));
    });

    it("is greater than nothing", () => {
        const brsValues = [
            new BrsTypes.Int32(1),
            new BrsTypes.Int64(2),
            new BrsTypes.Float(1.5),
            new BrsTypes.Double(2.5),
            new BrsTypes.BrsString("i'm super valid"),
            BrsTypes.BrsBoolean.False,
            BrsTypes.BrsInvalid.Instance,
            LCase,
        ];

        brsValues.forEach((other) =>
            expect(UCase.greaterThan(other)).toBe(BrsTypes.BrsBoolean.False)
        );
    });

    it("is only equal to other identical functions", () => {
        const notEqual = [
            new BrsTypes.Int32(1),
            new BrsTypes.Int64(2),
            new BrsTypes.Float(1.5),
            new BrsTypes.Double(2.5),
            new BrsTypes.BrsString("i'm super valid"),
            BrsTypes.BrsBoolean.False,
            BrsTypes.BrsInvalid.Instance,
            LCase,
        ];

        notEqual.forEach((other) => expect(UCase.equalTo(other)).toBe(BrsTypes.BrsBoolean.False));

        expect(UCase.equalTo(UCase)).toBe(BrsTypes.BrsBoolean.True);
    });

    describe("type checking", () => {
        it("detects calls with too few arguments", () => {
            const hasArgs = new BrsTypes.Callable("acceptsArgs", {
                signature: {
                    args: [new BrsTypes.StdlibArgument("foo", BrsTypes.ValueKind.String)],
                    returns: BrsTypes.String,
                },
                impl: () => {},
            });

            expect(
                hasArgs.getAllSignatureMismatches([]).map((mm) => mm.mismatches)[0]
            ).toContainEqual({
                reason: BrsTypes.MismatchReason.TooFewArguments,
                expected: "1",
                received: "0",
            });
        });

        it("detects calls with too many arguments", () => {
            const noArgs = new BrsTypes.Callable("acceptsArgs", {
                signature: {
                    args: [],
                    returns: BrsTypes.String,
                },
                impl: () => {},
            });

            expect(
                noArgs
                    .getAllSignatureMismatches([new BrsTypes.BrsString("foo")])
                    .map((mm) => mm.mismatches)[0]
            ).toContainEqual({
                reason: BrsTypes.MismatchReason.TooManyArguments,
                expected: "0",
                received: "1",
            });
        });

        it("allows optional arguments to be excluded", () => {
            const hasArgs = new BrsTypes.Callable("acceptsOptionalArgs", {
                signature: {
                    args: [
                        new BrsTypes.StdlibArgument(
                            "foo",
                            BrsTypes.ValueKind.String,
                            new BrsTypes.BrsString("defaultFoo")
                        ),
                    ],
                    returns: BrsTypes.String,
                },
                impl: () => {},
            });

            expect(hasArgs.getAllSignatureMismatches([]).map((mm) => mm.mismatches)[0]).toEqual([]);
        });

        it("detects argument mismatches", () => {
            const hasArgs = new BrsTypes.Callable("acceptsString", {
                signature: {
                    args: [new BrsTypes.StdlibArgument("foo", BrsTypes.ValueKind.String)],
                    returns: BrsTypes.String,
                },
                impl: () => {},
            });

            expect(
                hasArgs
                    .getAllSignatureMismatches([BrsTypes.BrsBoolean.False])
                    .map((mm) => mm.mismatches)[0]
            ).toContainEqual({
                reason: BrsTypes.MismatchReason.ArgumentTypeMismatch,
                expected: "String",
                received: "Boolean",
                argName: "foo",
            });
        });

        it("doesn't mutate args while checking for argument mismatches", () => {
            let func = new BrsTypes.Callable(
                "acceptsIntOrFloat",
                {
                    signature: {
                        args: [
                            new BrsTypes.StdlibArgument("input", BrsTypes.ValueKind.Int32),
                            new BrsTypes.StdlibArgument("something_else", BrsTypes.ValueKind.Int32),
                        ],
                        returns: BrsTypes.Int32,
                    },
                    impl: (_interpreter, input) => input,
                },
                {
                    signature: {
                        args: [
                            new BrsTypes.StdlibArgument("input", BrsTypes.ValueKind.Float),
                            new BrsTypes.StdlibArgument(
                                "something_else",
                                BrsTypes.ValueKind.Boolean
                            ),
                        ],
                        returns: BrsTypes.Float,
                    },
                    impl: (_interpreter, input) => input,
                }
            );

            let pi = new BrsTypes.Float(3.1415927);
            let result = func.call(new Interpreter(), pi, BrsTypes.BrsBoolean.False);

            // mutation between checks would cause `input` to be the integer 3 - make sure that doesn't happen
            expect(result).toEqual(pi);
        });

        describe("coercion", () => {
            describe("into integer", () => {
                let fn = new BrsTypes.Callable("acceptsInt", {
                    signature: {
                        args: [new BrsTypes.StdlibArgument("input", BrsTypes.ValueKind.Int32)],
                        returns: BrsTypes.ValueKind.Int32,
                    },
                    impl: (_interpreter, input) => input,
                });

                test.each([
                    // pairs of [type, input, coerced_value]
                    ["integer", new BrsTypes.Int32(-5), new BrsTypes.Int32(-5)],
                    ["float", new BrsTypes.Float(3.14159), new BrsTypes.Int32(3)],
                    ["double", new BrsTypes.Double(2.71828), new BrsTypes.Int32(2)],
                    ["longinteger", new BrsTypes.Int64(2147483647119), new BrsTypes.Int32(-881)],
                ])("from %s to integer", (_type, input, output) => {
                    expect(fn.call(new Interpreter(), input)).toEqual(output);
                });
            });

            describe("into float", () => {
                let fn = new BrsTypes.Callable("acceptsFloat", {
                    signature: {
                        args: [new BrsTypes.StdlibArgument("input", BrsTypes.ValueKind.Float)],
                        returns: BrsTypes.ValueKind.Float,
                    },
                    impl: (_interpreter, input) => input,
                });

                test.each([
                    // pairs of [type, input, coerced_value]
                    ["integer", new BrsTypes.Int32(-5), new BrsTypes.Float(-5)],
                    ["float", new BrsTypes.Float(3.14159), new BrsTypes.Float(3.14159)],
                    ["double", new BrsTypes.Double(2.71828), new BrsTypes.Float(2.71828)],
                    [
                        "longinteger",
                        new BrsTypes.Int64(2147483647119),
                        new BrsTypes.Float(2147483647119),
                    ],
                ])("from %s to float", (_type, input, output) => {
                    expect(fn.call(new Interpreter(), input)).toEqual(output);
                });
            });

            describe("into double", () => {
                let fn = new BrsTypes.Callable("acceptsDouble", {
                    signature: {
                        args: [new BrsTypes.StdlibArgument("input", BrsTypes.ValueKind.Double)],
                        returns: BrsTypes.ValueKind.Double,
                    },
                    impl: (_interpreter, input) => input,
                });

                test.each([
                    // pairs of [type, input, coerced_value]
                    ["integer", new BrsTypes.Int32(-5), new BrsTypes.Double(-5)],
                    ["float", new BrsTypes.Float(3.14159), new BrsTypes.Double(3.14159)],
                    ["double", new BrsTypes.Double(2.71828), new BrsTypes.Double(2.71828)],
                    [
                        "longinteger",
                        new BrsTypes.Int64(2147483647119),
                        new BrsTypes.Double(2147483647119),
                    ],
                ])("from %s to double", (_type, input, output) => {
                    expect(fn.call(new Interpreter(), input)).toEqual(output);
                });
            });

            describe("into longinteger", () => {
                let fn = new BrsTypes.Callable("acceptsLongInteger", {
                    signature: {
                        args: [new BrsTypes.StdlibArgument("input", BrsTypes.ValueKind.Int64)],
                        returns: BrsTypes.ValueKind.Int64,
                    },
                    impl: (_interpreter, input) => input,
                });

                test.each([
                    // pairs of [type, input, coerced_value]
                    ["integer", new BrsTypes.Int32(-5), new BrsTypes.Int64(-5)],
                    ["float", new BrsTypes.Float(3.14159), new BrsTypes.Int64(3)],
                    ["double", new BrsTypes.Double(2.71828), new BrsTypes.Int64(2)],
                    [
                        "longinteger",
                        new BrsTypes.Int64(2147483647119),
                        new BrsTypes.Int64(2147483647119),
                    ],
                ])("from %s to longinteger", (_type, input, output) => {
                    expect(fn.call(new Interpreter(), input)).toEqual(output);
                });
            });
        });

        it("allows any type for dynamic and object", () => {
            const hasArgs = new BrsTypes.Callable("acceptsAnything", {
                signature: {
                    args: [
                        new BrsTypes.StdlibArgument("foo", BrsTypes.ValueKind.Dynamic),
                        new BrsTypes.StdlibArgument("bar", BrsTypes.ValueKind.Object),
                    ],
                    returns: BrsTypes.String,
                },
                impl: () => {},
            });

            expect(
                hasArgs
                    .getAllSignatureMismatches([
                        BrsTypes.BrsBoolean.False,
                        BrsTypes.BrsInvalid.Instance,
                    ])
                    .map((mm) => mm.mismatches)[0]
            ).toEqual([]);
        });
    });
});
