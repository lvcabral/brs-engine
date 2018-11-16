const { Exp, Log, Sqr, Rnd } = require("../../lib/stdlib/index");
const { Interpreter } = require("../../lib/interpreter");
const { Int32, Float, ValueKind } = require("../../lib/brsTypes");

const interpreter = new Interpreter();

describe("global math functions", () => {
    describe("Exp", () => {
        it("calculates a natural exponent", () => {
            expect(
                Exp.call(interpreter, new Float(12.7)).value
            ).toBeCloseTo(327747.901874, 1);
        });
    });

    describe("Log", () => {
        it("calculates a natural logarithm", () => {
            expect(
                Log.call(interpreter, new Float(17)).value
            ).toBeCloseTo(2.833213, 5);
        });
    });

    describe("Sqr", () => {
        it("calculates the square root", () => {
            expect(
                Sqr.call(interpreter, new Float(9.9)).value
            ).toBeCloseTo(3.146426, 5);
        });
    });

    describe("Rnd", () => {
        it("calculates a random float between zero and one", () => {
            let result = Rnd.call(interpreter, new Int32(0));
            expect(result.kind).toBe(ValueKind.Float);
            expect(result.value).toBeGreaterThanOrEqual(0.0);
            expect(result.value).toBeLessThan(1.0);
        });

        it("calculates a random number between one and some number", () => {
            function mockRandomToAlwaysBe(val, cb) {
                randomMock = jest.spyOn(global.Math, "random").mockImplementation(() => val);
                cb();
                randomMock.mockRestore();
            }

            // make sure it can return the lowest possible value
            mockRandomToAlwaysBe(0.0, () => {
                let lowestPossibleValue = Rnd.call(interpreter, new Int32(5));
                expect(lowestPossibleValue.kind).toBe(ValueKind.Int32);
                expect(lowestPossibleValue.value).toBe(1);
            });

            // make sure it can return the highest possible value
            mockRandomToAlwaysBe(0.99999999, () => {
                let highestPossibleValue = Rnd.call(interpreter, new Int32(5));
                expect(highestPossibleValue.kind).toBe(ValueKind.Int32);
                expect(highestPossibleValue.value).toBe(5);
            });

            // make sure it can return a middle value
            mockRandomToAlwaysBe(0.5, () => {
                let midPossibleValue = Rnd.call(interpreter, new Int32(5));
                expect(midPossibleValue.kind).toBe(ValueKind.Int32);
                expect(midPossibleValue.value).toBe(3);
            });
        });
    });
});