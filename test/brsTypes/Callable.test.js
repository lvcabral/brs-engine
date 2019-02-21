const BrsTypes = require("../../lib/brsTypes");
const { UCase, LCase } = require("../../lib/stdlib");

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
            LCase
        ];

        brsValues.forEach(other =>
            expect(UCase.lessThan(other)).toBe(BrsTypes.BrsBoolean.False)
        );
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
            LCase
        ];

        brsValues.forEach(other =>
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
            LCase
        ];

        notEqual.forEach(other =>
            expect(UCase.equalTo(other)).toBe(BrsTypes.BrsBoolean.False)
        );

        expect(UCase.equalTo(UCase)).toBe(BrsTypes.BrsBoolean.True);
    });

    describe("type checking", () => {
        it("detects calls with too few arguments", () => {
            const hasArgs = new BrsTypes.Callable(
                "acceptsArgs",
                {
                    signature: {
                        args: [ new BrsTypes.StdlibArgument("foo", BrsTypes.ValueKind.String) ],
                        returns: BrsTypes.String
                    },
                    impl: () => {}
                }
            );

            expect(
                hasArgs.getAllSignatureMismatches([]).map(mm => mm.mismatches)[0]
            ).toContainEqual(
                {
                    reason: BrsTypes.MismatchReason.TooFewArguments,
                    expected: "1",
                    received: "0"
                }
            );
        });

        it("detects calls with too many arguments", () => {
            const noArgs = new BrsTypes.Callable(
                "acceptsArgs",
                {
                    signature: {
                        args: [],
                        returns: BrsTypes.String
                    },
                    impl: () => {}
                }
            );

            expect(
                noArgs.getAllSignatureMismatches([
                    new BrsTypes.BrsString("foo")
                ]).map(mm => mm.mismatches)[0]
            ).toContainEqual(
                {
                    reason: BrsTypes.MismatchReason.TooManyArguments,
                    expected: "0",
                    received: "1"
                }
            );
        });

        it("allows optional arguments to be excluded", () => {
            const hasArgs = new BrsTypes.Callable(
                "acceptsOptionalArgs",
                {
                    signature: {
                        args: [
                            new BrsTypes.StdlibArgument(
                                "foo",
                                BrsTypes.ValueKind.String,
                                new BrsTypes.BrsString("defaultFoo")
                            )
                        ],
                        returns: BrsTypes.String
                    },
                    impl: () => {}
                }
            );

            expect(
                hasArgs.getAllSignatureMismatches([]).map(mm => mm.mismatches)[0]
            ).toEqual([]);
        });

        it("detects argument mismatches", () => {
            const hasArgs = new BrsTypes.Callable(
                "acceptsString",
                {
                    signature: {
                        args: [ new BrsTypes.StdlibArgument("foo", BrsTypes.ValueKind.String) ],
                        returns: BrsTypes.String
                    },
                    impl: () => {}
                }
            );

            expect(
                hasArgs.getAllSignatureMismatches([
                    BrsTypes.BrsBoolean.False
                ]).map(mm => mm.mismatches)[0]
            ).toContainEqual(
                {
                    reason: BrsTypes.MismatchReason.ArgumentTypeMismatch,
                    expected: "String",
                    received: "Boolean",
                    argName: "foo"
                }
            );
        });

        it("allows any type for dynamic and object", () => {
            const hasArgs = new BrsTypes.Callable(
                "acceptsAnything",
                {
                    signature: {
                        args: [
                            new BrsTypes.StdlibArgument("foo", BrsTypes.ValueKind.Dynamic),
                            new BrsTypes.StdlibArgument("bar", BrsTypes.ValueKind.Object)
                        ],
                        returns: BrsTypes.String
                    },
                    impl: () => {}
                }
            );

            expect(
                hasArgs.getAllSignatureMismatches([
                    BrsTypes.BrsBoolean.False,
                    BrsTypes.BrsInvalid.Instance
                ]).map(mm => mm.mismatches)[0]
            ).toEqual([]);
        });
    });
});
