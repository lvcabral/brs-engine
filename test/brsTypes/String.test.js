const brs = require("brs");
const { BrsBoolean, BrsString, RoString } = brs.types;

describe("String", () => {
    describe("lexical comparisons", () => {
        describe("with primitive", () => {
            let a = new BrsString("alpha");
            let b = new BrsString("bravo");
            let capitalB = new BrsString("BRAVO");

            test("less than", () => {
                expect(a.lessThan(b)).toBe(BrsBoolean.True);
                expect(b.lessThan(a)).toBe(BrsBoolean.False);
                expect(a.lessThan(capitalB)).toBe(BrsBoolean.False);
                expect(capitalB.lessThan(a)).toBe(BrsBoolean.True);
            });

            test("greater than", () => {
                expect(a.greaterThan(b)).toBe(BrsBoolean.False);
                expect(b.greaterThan(a)).toBe(BrsBoolean.True);
                expect(a.lessThan(capitalB)).toBe(BrsBoolean.False);
                expect(capitalB.lessThan(a)).toBe(BrsBoolean.True);
            });

            test("equal to", () => {
                let differentA = new BrsString("alpha");
                expect(a.equalTo(differentA)).toBe(BrsBoolean.True);
                expect(differentA.equalTo(a)).toBe(BrsBoolean.True);
                expect(b.equalTo(capitalB)).toBe(BrsBoolean.False);
                expect(capitalB.equalTo(b)).toBe(BrsBoolean.False);
            });
        });

        describe("with RoString", () => {
            let a = new BrsString("alpha");
            let b = new RoString(new BrsString("bravo"));
            let capitalB = new BrsString("BRAVO");

            test("less than", () => {
                expect(a.lessThan(b)).toBe(BrsBoolean.True);
                expect(b.lessThan(a)).toBe(BrsBoolean.False);
                expect(a.lessThan(capitalB)).toBe(BrsBoolean.False);
                expect(capitalB.lessThan(a)).toBe(BrsBoolean.True);
            });

            test("greater than", () => {
                expect(a.greaterThan(b)).toBe(BrsBoolean.False);
                expect(b.greaterThan(a)).toBe(BrsBoolean.True);
                expect(a.lessThan(capitalB)).toBe(BrsBoolean.False);
                expect(capitalB.lessThan(a)).toBe(BrsBoolean.True);
            });

            test("equal to", () => {
                let boxedA = new RoString(new BrsString("alpha"));
                expect(a.equalTo(boxedA)).toBe(BrsBoolean.True);
                expect(boxedA.equalTo(a)).toBe(BrsBoolean.True);
                expect(b.equalTo(capitalB)).toBe(BrsBoolean.False);
                expect(capitalB.equalTo(b)).toBe(BrsBoolean.False);
            });
        });
    });

    it("concatenates with other strings", () => {
        let deliveryFor = new BrsString("Pizza delivery for: ");
        let recipient = new BrsString("I. C. Weiner");
        expect(deliveryFor.concat(recipient)).toEqual(
            new BrsString("Pizza delivery for: I. C. Weiner")
        );
    });
});
