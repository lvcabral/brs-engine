const BrsTypes = require("../../lib/brsTypes");

describe("String", () => {
    describe("lexical comparisons", () => {
        let a = new BrsTypes.BrsString("alpha");
        let b = new BrsTypes.BrsString("bravo");
        let capitalB = new BrsTypes.BrsString("BRAVO");

        test("less than", () => {
            expect(a.lessThan(b)).toBe(BrsTypes.BrsBoolean.True);
            expect(a.lessThan(capitalB)).toBe(BrsTypes.BrsBoolean.False);
        });

        test("greater than", () => {
            expect(a.greaterThan(b)).toBe(BrsTypes.BrsBoolean.False);
            expect(a.lessThan(capitalB)).toBe(BrsTypes.BrsBoolean.False);
        });

        test("equal to", () => {
            let differentA = new BrsTypes.BrsString("alpha");
            expect(a.equalTo(differentA)).toBe(BrsTypes.BrsBoolean.True);
            expect(b.equalTo(capitalB)).toBe(BrsTypes.BrsBoolean.False);
        });
    });

    it("concatenates with other strings", () => {
        let deliveryFor = new BrsTypes.BrsString("Pizza delivery for: ");
        let recipient = new BrsTypes.BrsString("I. C. Weiner");
        expect(deliveryFor.concat(recipient)).toEqual(
            new BrsTypes.BrsString("Pizza delivery for: I. C. Weiner")
        );
    });
});
