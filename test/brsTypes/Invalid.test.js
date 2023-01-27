const BrsTypes = require("../../lib/brsTypes");

describe("Invalid", () => {
    it("is only equal to itself", () => {
        const notInvalid = [
            new BrsTypes.Int32(1),
            new BrsTypes.Int64(2),
            new BrsTypes.Float(1.5),
            new BrsTypes.Double(2.5),
            new BrsTypes.BrsString("i'm super valid"),
            BrsTypes.BrsBoolean.False,
        ];

        notInvalid.forEach((other) =>
            expect(BrsTypes.BrsInvalid.Instance.equalTo(other)).toBe(BrsTypes.BrsBoolean.False)
        );

        expect(BrsTypes.BrsInvalid.Instance.equalTo(BrsTypes.BrsInvalid.Instance)).toBe(
            BrsTypes.BrsBoolean.True
        );
    });

    it("is less than nothing", () => {
        const notInvalid = [
            new BrsTypes.Int32(1),
            new BrsTypes.Int64(2),
            new BrsTypes.Float(1.5),
            new BrsTypes.Double(2.5),
            new BrsTypes.BrsString("i'm super valid"),
            BrsTypes.BrsBoolean.False,
            BrsTypes.BrsInvalid.Instance,
        ];

        notInvalid.forEach((other) =>
            expect(BrsTypes.BrsInvalid.Instance.lessThan(other)).toBe(BrsTypes.BrsBoolean.False)
        );
    });

    it("is greater than nothing", () => {
        const notInvalid = [
            new BrsTypes.Int32(1),
            new BrsTypes.Int64(2),
            new BrsTypes.Float(1.5),
            new BrsTypes.Double(2.5),
            new BrsTypes.BrsString("i'm super valid"),
            BrsTypes.BrsBoolean.False,
            BrsTypes.BrsInvalid.Instance,
        ];

        notInvalid.forEach((other) =>
            expect(BrsTypes.BrsInvalid.Instance.greaterThan(other)).toBe(BrsTypes.BrsBoolean.False)
        );
    });
});
