const {
    ValueKind,
    Int32,
    Int64,
    Float,
    Double,
    BrsString,
    BrsBoolean,
    BrsInvalid,
} = require("../../lib/brsTypes");
const Long = require("long");

describe("Int64", () => {
    it("truncates initial values to integers", () => {
        let threePointNine = new Int64(3.9);
        expect(threePointNine.getValue().toNumber()).toBe(3);
    });

    it("creates base-10 integers from strings", () => {
        let threePointNine = Int64.fromString("3.9");
        expect(threePointNine.getValue().toNumber()).toBe(3);
    });

    it("creates base-16 integers from strings", () => {
        let cafeFood = Int64.fromString("&hCAFEF00D");
        expect(cafeFood.getValue().toNumber()).toBe(3405705229);
    });

    describe("addition", () => {
        let five = new Int64(5);

        it("adds Int32 right-hand sides", () => {
            let four = new Int32(4);
            let result = five.add(four);
            expect(result.kind).toBe(ValueKind.Int64);
            expect(result.getValue().toNumber()).toBe(9);
        });

        it("adds Int64 right-hand sides", () => {
            let four = new Int64(4);
            let result = five.add(four);
            expect(result.kind).toBe(ValueKind.Int64);
            expect(result.getValue().toNumber()).toBe(9);
        });

        it("adds Float right-hand sides", () => {
            let fourPointFive = new Float(4.5);
            let result = five.add(fourPointFive);
            expect(result.kind).toBe(ValueKind.Float);
            expect(result.getValue()).toBe(9.5);
        });

        it("adds Double right-hand sides", () => {
            let fourPointFive = new Double(4.5);
            let result = five.add(fourPointFive);
            expect(result.kind).toBe(ValueKind.Double);
            expect(result.getValue()).toBe(9.5);
        });
    });

    describe("subtraction", () => {
        let five = new Int64(5);

        it("subtracts Int32 right-hand sides", () => {
            let four = new Int32(4);
            let result = five.subtract(four);
            expect(result.kind).toBe(ValueKind.Int64);
            expect(result.getValue().toNumber()).toBe(1);
        });

        it("subtracts Int64 right-hand sides", () => {
            let four = new Int64(4);
            let result = five.subtract(four);
            expect(result.kind).toBe(ValueKind.Int64);
            expect(result.getValue().toNumber()).toBe(1);
        });

        it("subtracts Float right-hand sides", () => {
            let fourPointFive = new Float(4.5);
            let result = five.subtract(fourPointFive);
            expect(result.kind).toBe(ValueKind.Float);
            expect(result.getValue()).toBe(0.5);
        });

        it("subtracts Double right-hand sides", () => {
            let fourPointFive = new Double(4.5);
            let result = five.subtract(fourPointFive);
            expect(result.kind).toBe(ValueKind.Double);
            expect(result.getValue()).toBe(0.5);
        });
    });

    describe("multiplication", () => {
        let five = new Int64(5);

        it("multiplies by Int32 right-hand sides", () => {
            let four = new Int32(4);
            let result = five.multiply(four);
            expect(result.kind).toBe(ValueKind.Int64);
            expect(result.getValue().toNumber()).toBe(20);
        });

        it("multiplies by Int64 right-hand sides", () => {
            let four = new Int64(4);
            let result = five.multiply(four);
            expect(result.kind).toBe(ValueKind.Int64);
            expect(result.getValue().toNumber()).toBe(20);
        });

        it("multiplies by Float right-hand sides", () => {
            let twoPointFive = new Float(2.5);
            let result = five.multiply(twoPointFive);
            expect(result.kind).toBe(ValueKind.Float);
            expect(result.getValue()).toBe(12.5);
        });

        it("multiplies by Double right-hand sides", () => {
            let twoPointFive = new Double(2.5);
            let result = five.multiply(twoPointFive);
            expect(result.kind).toBe(ValueKind.Double);
            expect(result.getValue()).toBe(12.5);
        });
    });

    describe("division", () => {
        let ten = new Int64(10);

        it("divides by Int32 right-hand sides", () => {
            let two = new Int32(-2);
            let result = ten.divide(two);
            expect(result.kind).toBe(ValueKind.Float);
            expect(result.getValue()).toBe(-5);
        });

        it("divides by Int64 right-hand sides", () => {
            let two = new Int64(-2);
            let result = ten.divide(two);
            expect(result.kind).toBe(ValueKind.Float);
            expect(result.getValue()).toBe(-5);
        });

        it("divides by Float right-hand sides", () => {
            let pointFive = new Float(-0.5);
            let result = ten.divide(pointFive);
            expect(result.kind).toBe(ValueKind.Float);
            expect(result.getValue()).toBe(-20);
        });

        it("divides by Double right-hand sides", () => {
            let pointFive = new Double(-0.5);
            let result = ten.divide(pointFive);
            expect(result.kind).toBe(ValueKind.Double);
            expect(result.getValue()).toBe(-20);
        });
    });

    describe("modulo", () => {
        let ten = new Int64(10);

        it("modulos Int32 right-hand sides", () => {
            let two = new Int32(2);
            let result = ten.modulo(two);
            expect(result.kind).toBe(ValueKind.Int64);
            expect(result.getValue().toNumber()).toBe(0);
        });

        it("modulos Int64 right-hand sides", () => {
            let three = new Int64(3);
            let result = ten.modulo(three);
            expect(result.kind).toBe(ValueKind.Int64);
            expect(result.getValue().toNumber()).toBe(1);
        });

        it("modulos Float right-hand sides", () => {
            let threePointFive = new Float(3.5);
            let result = ten.modulo(threePointFive);
            expect(result.kind).toBe(ValueKind.Int64);
            expect(result.getValue()).toEqual(Long.fromNumber(3));
        });

        it("modulos Double right-hand sides", () => {
            let twoPointFive = new Double(2.5);
            let result = ten.modulo(twoPointFive);
            expect(result.kind).toBe(ValueKind.Int64);
            expect(result.getValue()).toEqual(Long.ZERO);
        });
    });

    describe("integer-division", () => {
        let ten = new Int64(10);

        it("integer-divides by Int32 right-hand sides", () => {
            let three = new Int32(3);
            let result = ten.intDivide(three);
            expect(result.kind).toBe(ValueKind.Int64);
            expect(result.getValue()).toEqual(Long.fromNumber(3));
        });

        it("integer-divides by Int64 right-hand sides", () => {
            let three = new Int64(3);
            let result = ten.intDivide(three);
            expect(result.kind).toBe(ValueKind.Int64);
            expect(result.getValue()).toEqual(Long.fromNumber(3));
        });

        it("integer-divides by Float right-hand sides", () => {
            let threePointFive = new Float(3.5);
            let result = ten.intDivide(threePointFive);
            expect(result.kind).toBe(ValueKind.Int64);
            expect(result.getValue()).toEqual(Long.fromNumber(2));
        });

        it("integer-divides by Double right-hand sides", () => {
            let twoPointFive = new Double(2.5);
            let result = ten.intDivide(twoPointFive);
            expect(result.kind).toBe(ValueKind.Int64);
            expect(result.getValue()).toEqual(Long.fromNumber(4));
        });
    });

    describe("exponentiation", () => {
        let nine = new Int64(9);

        it("raises to Int32 powers", () => {
            let three = new Int32(3);
            let result = nine.pow(three);
            expect(result.kind).toBe(ValueKind.Int64);
            expect(result.getValue().toNumber()).toBe(729);
        });

        it("raises to Int64 powers", () => {
            let three = new Int64(3);
            let result = nine.pow(three);
            expect(result.kind).toBe(ValueKind.Int64);
            expect(result.getValue().toNumber()).toBe(729);
        });

        it("raises to Float powers", () => {
            let oneHalf = new Float(0.5);
            let result = nine.pow(oneHalf);
            expect(result.kind).toBe(ValueKind.Float);
            expect(result.getValue()).toBe(3);
        });

        it("raises to Double powers", () => {
            let oneHalf = new Double(0.5);
            let result = nine.pow(oneHalf);
            expect(result.kind).toBe(ValueKind.Double);
            expect(result.getValue()).toBe(3);
        });
    });

    describe("less than", () => {
        const lhs = new Int64(2);

        function testLessThan(operands) {
            expect(lhs.lessThan(operands.large)).toBe(BrsBoolean.True);
            expect(lhs.lessThan(operands.small)).toBe(BrsBoolean.False);
        }

        it("compares to Int32 right-hand sides", () =>
            testLessThan({
                lhs: lhs,
                small: new Int32(1),
                large: new Int32(3),
            }));

        it("compares to Int64 right-hand sides", () =>
            testLessThan({
                lhs: lhs,
                small: new Int64(1),
                large: new Int64(Math.pow(10, 18)),
            }));

        it("compares to Float right-hand sides", () =>
            testLessThan({
                lhs: lhs,
                small: new Float(0.12345),
                large: new Float(2.001),
            }));

        it("compares to Double right-hand sides", () =>
            testLessThan({
                lhs: lhs,
                small: new Double(1.999999999),
                large: new Double(2.000000001),
            }));

        it("returns false for all other types", () => {
            let nonNumbers = [new BrsString("hello"), BrsBoolean.True, BrsInvalid.Instance];
            nonNumbers.forEach((rhs) => expect(lhs.lessThan(rhs)).toBe(BrsBoolean.False));
        });
    });

    describe("greater than", () => {
        const lhs = new Int64(2);

        function testGreaterThan(operands) {
            expect(lhs.greaterThan(operands.large)).toBe(BrsBoolean.False);
            expect(lhs.greaterThan(operands.small)).toBe(BrsBoolean.True);
        }

        it("compares to Int32 right-hand sides", () =>
            testGreaterThan({
                lhs: lhs,
                small: new Int32(1),
                large: new Int32(3),
            }));

        it("compares to Int64 right-hand sides", () =>
            testGreaterThan({
                lhs: lhs,
                small: new Int64(1),
                large: new Int64(Math.pow(10, 18)),
            }));

        it("compares to Float right-hand sides", () =>
            testGreaterThan({
                lhs: lhs,
                small: new Float(0.12345),
                large: new Float(2.001),
            }));

        it("compares to Double right-hand sides", () =>
            testGreaterThan({
                lhs: lhs,
                small: new Double(1.999999999),
                large: new Double(2.000000001),
            }));

        it("returns false for all other types", () => {
            let nonNumbers = [new BrsString("hello"), BrsBoolean.True, BrsInvalid.Instance];
            nonNumbers.forEach((rhs) => expect(lhs.greaterThan(rhs)).toBe(BrsBoolean.False));
        });
    });

    describe("equal to", () => {
        const lhs = new Int64(2);

        function testEqualTo(operands) {
            expect(lhs.equalTo(operands.same)).toBe(BrsBoolean.True);
            expect(lhs.equalTo(operands.diff)).toBe(BrsBoolean.False);
        }

        it("compares to Int32 right-hand sides", () =>
            testEqualTo({
                lhs: lhs,
                same: lhs,
                diff: new Int32(3),
            }));

        it("compares to Int64 right-hand sides", () =>
            testEqualTo({
                lhs: lhs,
                same: new Int64(2),
                diff: new Int64(Math.pow(10, 18)),
            }));

        it("compares to Float right-hand sides", () =>
            testEqualTo({
                lhs: lhs,
                same: new Float(2),
                diff: new Float(2.001),
            }));

        it("compares to Double right-hand sides", () =>
            testEqualTo({
                lhs: lhs,
                same: new Double(2),
                diff: new Double(2.000000001),
            }));

        it("compares to Boolean right-hand sides", () =>
            testEqualTo({
                lhs: lhs,
                same: BrsBoolean.True,
                diff: BrsBoolean.False,
            }));

        it("returns false for all other types", () => {
            let nonNumbers = [new BrsString("hello"), BrsInvalid.Instance];
            nonNumbers.forEach((rhs) => expect(lhs.equalTo(rhs)).toBe(BrsBoolean.False));
        });
    });

    describe("bitwise AND", () => {
        let six = new Int64(6);

        it("ANDs with Int32 right-hand sides", () => {
            expect(six.and(new Int32(5))).toEqual(new Int64(4));
        });

        it("ANDs with Int64 right-hand sides", () => {
            expect(six.and(new Int64(5))).toEqual(new Int64(4));
        });

        it("ANDs with Float right-hand sides", () => {
            expect(six.and(new Float(5.32323))).toEqual(new Int64(4));
        });

        it("ANDs with Int64 right-hand sides", () => {
            expect(six.and(new Double(5.32323))).toEqual(new Int64(4));
        });

        it("ANDs with Boolean right-hand sides", () => {
            expect(six.and(BrsBoolean.True)).toBe(BrsBoolean.True);
        });
    });

    describe("bitwise OR", () => {
        let six = new Int64(6);

        it("ORs with Int32 right-hand sides", () => {
            expect(six.or(new Int32(3))).toEqual(new Int64(7));
        });

        it("ORs with Int64 right-hand sides", () => {
            expect(six.or(new Int64(3))).toEqual(new Int64(7));
        });

        it("ORs with Float right-hand sides", () => {
            expect(six.or(new Float(3.4444))).toEqual(new Int64(7));
        });

        it("ORs with Int64 right-hand sides", () => {
            expect(six.or(new Double(3.4444))).toEqual(new Int64(7));
        });

        it("ORs with Boolean right-hand sides", () => {
            expect(six.or(BrsBoolean.False)).toBe(BrsBoolean.True);
        });
    });
});
