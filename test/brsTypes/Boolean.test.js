const BrsTypes = require("../../lib/brsTypes");

describe("Boolean", () => {
    test("true equals true", () => {
        const notTrue = [
            new BrsTypes.Int32(0),
            new BrsTypes.Int64(0),
            new BrsTypes.Float(0.5),
            new BrsTypes.Double(0.5),
            new BrsTypes.BrsString("i'm not a boolean"),
            BrsTypes.BrsBoolean.False,
            BrsTypes.BrsInvalid.Instance,
        ];

        notTrue.forEach((other) =>
            expect(BrsTypes.BrsBoolean.True.equalTo(other)).toBe(BrsTypes.BrsBoolean.False)
        );

        expect(BrsTypes.BrsBoolean.True.equalTo(BrsTypes.BrsBoolean.True)).toBe(
            BrsTypes.BrsBoolean.True
        );
    });

    test("false equals false", () => {
        const notFalse = [
            new BrsTypes.Int32(-1),
            new BrsTypes.Int64(2),
            new BrsTypes.Float(1.5),
            new BrsTypes.Double(2.5),
            new BrsTypes.BrsString("i'm not a boolean"),
            BrsTypes.BrsBoolean.True,
            BrsTypes.BrsInvalid.Instance,
        ];

        notFalse.forEach((other) =>
            expect(BrsTypes.BrsBoolean.False.equalTo(other)).toBe(BrsTypes.BrsBoolean.False)
        );

        expect(BrsTypes.BrsBoolean.False.equalTo(BrsTypes.BrsBoolean.False)).toBe(
            BrsTypes.BrsBoolean.True
        );
    });

    test("true and false are less than nothing", () => {
        const allTypes = [
            new BrsTypes.Int32(1),
            new BrsTypes.Int64(2),
            new BrsTypes.Float(1.5),
            new BrsTypes.Double(2.5),
            new BrsTypes.BrsString("i'm super valid"),
            BrsTypes.BrsBoolean.False,
            BrsTypes.BrsBoolean.True,
            BrsTypes.BrsInvalid.Instance,
        ];

        allTypes.forEach((other) => {
            expect(BrsTypes.BrsBoolean.True.lessThan(other)).toBe(BrsTypes.BrsBoolean.False);
            expect(BrsTypes.BrsBoolean.False.lessThan(other)).toBe(BrsTypes.BrsBoolean.False);
        });
    });

    test("true and false are greater than nothing", () => {
        const allTypes = [
            new BrsTypes.Int32(1),
            new BrsTypes.Int64(2),
            new BrsTypes.Float(1.5),
            new BrsTypes.Double(2.5),
            new BrsTypes.BrsString("i'm super valid"),
            BrsTypes.BrsBoolean.False,
            BrsTypes.BrsBoolean.True,
            BrsTypes.BrsInvalid.Instance,
        ];

        allTypes.forEach((other) => {
            expect(BrsTypes.BrsBoolean.True.greaterThan(other)).toBe(BrsTypes.BrsBoolean.False);
            expect(BrsTypes.BrsBoolean.False.greaterThan(other)).toBe(BrsTypes.BrsBoolean.False);
        });
    });

    test("boolean AND", () => {
        expect(BrsTypes.BrsBoolean.False.and(BrsTypes.BrsBoolean.False)).toBe(
            BrsTypes.BrsBoolean.False
        );
        expect(BrsTypes.BrsBoolean.False.and(BrsTypes.BrsBoolean.True)).toBe(
            BrsTypes.BrsBoolean.False
        );
        expect(BrsTypes.BrsBoolean.True.and(BrsTypes.BrsBoolean.False)).toBe(
            BrsTypes.BrsBoolean.False
        );
        expect(BrsTypes.BrsBoolean.True.and(BrsTypes.BrsBoolean.True)).toBe(
            BrsTypes.BrsBoolean.True
        );
    });

    test("boolean OR", () => {
        expect(BrsTypes.BrsBoolean.False.or(BrsTypes.BrsBoolean.False)).toBe(
            BrsTypes.BrsBoolean.False
        );
        expect(BrsTypes.BrsBoolean.False.or(BrsTypes.BrsBoolean.True)).toBe(
            BrsTypes.BrsBoolean.True
        );
        expect(BrsTypes.BrsBoolean.True.or(BrsTypes.BrsBoolean.False)).toBe(
            BrsTypes.BrsBoolean.True
        );
        expect(BrsTypes.BrsBoolean.True.or(BrsTypes.BrsBoolean.True)).toBe(
            BrsTypes.BrsBoolean.True
        );
    });

    test("boolean NOT", () => {
        expect(BrsTypes.BrsBoolean.False.not()).toBe(BrsTypes.BrsBoolean.True);
        expect(BrsTypes.BrsBoolean.True.not()).toBe(BrsTypes.BrsBoolean.False);
    });
});
