const { binary } = require("./InterpreterTests");
const { Interpreter } = require("../../lib/interpreter");
const brs = require("../../lib");
const { Lexeme } = brs.lexer;
const {
    Int32,
    Int64,
    Float,
    Double,
    BrsString,
    BrsBoolean,
    RoArray,
    BrsInvalid,
    RoAssociativeArray,
    RoString,
} = brs.types;

let interpreter;

/**
 * Generates tests that compares all permutations of two values using all supported operators.
 * @param {*} small the smaller of the two values, i.e. `small < large`.
 * @param {*} large the larger of the two values, i.e. `large > small`.
 */
function verifyComparisons(small, large) {
    test("<", () => {
        let smallLarge = binary(small, Lexeme.Less, large);
        let smallSmall = binary(small, Lexeme.Less, small);
        let largeSmall = binary(large, Lexeme.Less, small);
        let results = interpreter.exec([smallLarge, smallSmall, largeSmall]);
        expect(results).toEqual([BrsBoolean.True, BrsBoolean.False, BrsBoolean.False]);
    });

    test("<=", () => {
        let smallLarge = binary(small, Lexeme.LessEqual, large);
        let smallSmall = binary(small, Lexeme.LessEqual, small);
        let largeSmall = binary(large, Lexeme.LessEqual, small);
        let results = interpreter.exec([smallLarge, smallSmall, largeSmall]);
        expect(results).toEqual([BrsBoolean.True, BrsBoolean.True, BrsBoolean.False]);
    });

    test(">", () => {
        let smallLarge = binary(small, Lexeme.Greater, large);
        let smallSmall = binary(small, Lexeme.Greater, small);
        let largeSmall = binary(large, Lexeme.Greater, small);
        let results = interpreter.exec([smallLarge, smallSmall, largeSmall]);
        expect(results).toEqual([BrsBoolean.False, BrsBoolean.False, BrsBoolean.True]);
    });

    test(">=", () => {
        let smallLarge = binary(small, Lexeme.GreaterEqual, large);
        let smallSmall = binary(small, Lexeme.GreaterEqual, small);
        let largeSmall = binary(large, Lexeme.GreaterEqual, small);
        let results = interpreter.exec([smallLarge, smallSmall, largeSmall]);
        expect(results).toEqual([BrsBoolean.False, BrsBoolean.True, BrsBoolean.True]);
    });

    test("=", () => {
        let smallLarge = binary(small, Lexeme.Equal, large);
        let smallSmall = binary(small, Lexeme.Equal, small);
        let largeSmall = binary(large, Lexeme.Equal, small);
        let results = interpreter.exec([smallLarge, smallSmall, largeSmall]);
        expect(results).toEqual([BrsBoolean.False, BrsBoolean.True, BrsBoolean.False]);
    });

    test("<>", () => {
        let smallLarge = binary(small, Lexeme.LessGreater, large);
        let smallSmall = binary(small, Lexeme.LessGreater, small);
        let largeSmall = binary(large, Lexeme.LessGreater, small);
        let results = interpreter.exec([smallLarge, smallSmall, largeSmall]);
        expect(results).toEqual([BrsBoolean.True, BrsBoolean.False, BrsBoolean.True]);
    });
}

describe("interpreter comparisons", () => {
    beforeEach(() => {
        interpreter = new Interpreter();
    });

    describe("32-bit integer comparisons", () => {
        verifyComparisons(new Int32(2), new Int32(6));
    });

    describe("64-bit integer comparisons", () => {
        verifyComparisons(new Int64(Math.pow(10, 17)), new Int64(20 * Math.pow(10, 18)));
    });

    describe("float comparisons", () => {
        verifyComparisons(new Float(2), new Float(6));
    });

    describe("double comparisons", () => {
        verifyComparisons(new Double(2), new Double(6));
    });

    describe("string comparisons", () => {
        verifyComparisons(new BrsString("amy"), new BrsString("zapp"));
    });

    describe("array comparisons", () => {
        [
            { name: "<", operator: Lexeme.Less },
            { name: "<=", operator: Lexeme.LessEqual },
            { name: ">", operator: Lexeme.Greater },
            { name: ">=", operator: Lexeme.GreaterEqual },
            { name: "=", operator: Lexeme.Equal },
            { name: "<>", operator: Lexeme.LessGreater },
        ].forEach(({ name, operator }) => {
            test(name, () => {
                let arr = new RoArray([]);

                expect(() => interpreter.exec([binary(arr, operator, arr)])).toThrow(
                    /Attempting to compare non-homogeneous values/
                );
            });
        });
    });

    describe("`invalid` comparisons", () => {
        let invalid = BrsInvalid.Instance;

        [
            { name: "boolean", value: BrsBoolean.True },
            { name: "string", value: new BrsString("foo") },
            { name: "32-bit integer", value: new Int32(5) },
            { name: "64-bit integer", value: new Int64(-1111111111) },
            { name: "float", value: new Float(3.4) },
            { name: "double", value: new Double(7.8) },
            { name: "array", value: new RoArray([]) },
            { name: "associative array", value: new RoAssociativeArray([]) },
        ].forEach(({ name, value }) => {
            test(name, () => {
                expect(
                    interpreter.exec([
                        binary(value, Lexeme.Equal, invalid),
                        binary(invalid, Lexeme.Equal, value),
                        binary(value, Lexeme.LessGreater, invalid),
                        binary(invalid, Lexeme.LessGreater, value),
                    ])
                ).toEqual([BrsBoolean.False, BrsBoolean.False, BrsBoolean.True, BrsBoolean.True]);

                [Lexeme.Less, Lexeme.LessEqual, Lexeme.Greater, Lexeme.GreaterEqual].forEach(
                    (operator) => {
                        expect(() => interpreter.exec([binary(value, operator, invalid)])).toThrow(
                            /Attempting to compare non-homogeneous values/
                        );

                        expect(() => interpreter.exec([binary(invalid, operator, value)])).toThrow(
                            /Attempting to compare non-homogeneous values/
                        );
                    }
                );
            });
        });

        test("invalid", () =>
            expect(
                interpreter.exec([
                    binary(invalid, Lexeme.Equal, invalid),
                    binary(invalid, Lexeme.LessGreater, invalid),
                ])
            ).toEqual([BrsBoolean.True, BrsBoolean.False]));
    });

    describe("disallowed mixed-type comparisons", () => {
        let int32 = new Int32(2);
        let str = new BrsString("two");
        let rostr = new RoString(str);
        let int64 = new Int64(2);

        // due to a combinatoric explosion of LHS-RHS-operator pairs, just test a representative
        // sample of pairings
        test("32-bit integer and string", () => {
            let less = binary(int32, Lexeme.Less, str);
            let lessEqual = binary(int32, Lexeme.LessEqual, str);
            let greater = binary(int32, Lexeme.Greater, str);
            let greaterEqual = binary(int32, Lexeme.GreaterEqual, str);
            let equal = binary(int32, Lexeme.Equal, str);
            let notEqual = binary(int32, Lexeme.LessGreater, str);
            expect(() =>
                interpreter.exec([less, lessEqual, greater, greaterEqual, equal, notEqual])
            ).toThrow(/Attempting to compare non-homogeneous values/);
        });

        test("roString and 64-bit int", () => {
            let less = binary(rostr, Lexeme.Less, int64);
            let lessEqual = binary(rostr, Lexeme.LessEqual, int64);
            let greater = binary(rostr, Lexeme.Greater, int64);
            let greaterEqual = binary(rostr, Lexeme.GreaterEqual, int64);
            let equal = binary(rostr, Lexeme.Equal, int64);
            let notEqual = binary(rostr, Lexeme.LessGreater, int64);
            expect(() =>
                interpreter.exec([less, lessEqual, greater, greaterEqual, equal, notEqual])
            ).toThrow(/Attempting to compare non-homogeneous values/);
        });
    });
});
