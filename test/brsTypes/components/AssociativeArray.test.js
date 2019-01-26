const brs = require("brs");
const { AssociativeArray, BrsArray, BrsBoolean, BrsString, Int32, BrsInvalid, ValueKind } = brs.types;
const { Interpreter } = require("../../../lib/interpreter");

describe("AssociativeArray", () => {
    describe("comparisons", () => {
        it("is less than nothing", () => {
            let a = new AssociativeArray([]);
            expect(a.lessThan(a)).toBe(BrsBoolean.False);
        });
        it("is greater than nothing", () => {
            let a = new AssociativeArray([]);
            expect(a.greaterThan(a)).toBe(BrsBoolean.False);
        });
        it("is equal to nothing", () => {
            let a = new AssociativeArray([]);
            expect(a.equalTo(a)).toBe(BrsBoolean.False);
        });
    });

    describe("stringification", () => {
        it("lists all primitive values", () => {
            let aa = new AssociativeArray([
                { name: new BrsString("array"), value: new BrsArray([ new BrsString("I shouldn't appear")]) },
                { name: new BrsString("associative-array"), value: new AssociativeArray([]) },
                { name: new BrsString("boolean"), value: BrsBoolean.True },
                { name: new BrsString("string"), value: new BrsString("a string") },
                { name: new BrsString("number"), value: new Int32(-1) },
                { name: new BrsString("invalid"), value: BrsInvalid.Instance }
            ]);
            expect(aa.toString()).toEqual(
`<Component: roAssociativeArray> =
{
    array: <Component: roArray>
    associative-array: <Component: roAssociativeArray>
    boolean: true
    string: a string
    number: -1
    invalid: invalid
}`
            );
        });
    });

    describe("get", () => {
        it("returns value given a key it contains", () => {
            let aa = new AssociativeArray([
                { name: new BrsString("foo"), value: new Int32(-99) }
            ]);

            expect(aa.get(new BrsString("foo"))).toEqual(new Int32(-99));
        });

        it("returns 'invalid' given a key it doesn't contain", () => {
            let aa = new AssociativeArray([]);

            expect(aa.get(new BrsString("does_not_exist"))).toEqual(BrsInvalid.Instance);
        });
    });

    describe("set", () => {
        it("sets values with new keys", () => {
            let aa = new AssociativeArray([
                { name: new BrsString("foo"), value: new Int32(-99) }
            ]);
            let ninetyNine = aa.get(new BrsString("foo"));

            aa.set(new BrsString("bar"), new Int32(808));
            expect(aa.get(new BrsString("bar"))).toEqual(new Int32(808));

            // ensure other keys don't get modified
            expect(aa.get(new BrsString("foo"))).toBe(ninetyNine);
        });

        it("overwrites values with existing keys", () => {
            let aa = new AssociativeArray([
                { name: new BrsString("foo"), value: new Int32(-99) }
            ]);

            aa.set(new BrsString("foo"), new BrsString("not ninetynine"));

            expect(aa.get(new BrsString("foo"))).toEqual(new BrsString("not ninetynine"));
        });
    });

    describe("methods", () => {
        let interpreter;

        beforeEach(() => {
            interpreter = new Interpreter();
        });

        describe("clear", () => {
            it("empties the associative array", () => {
                let aa = new AssociativeArray([
                    { name: new BrsString("foo"), value: new Int32(-99) }
                ]);

                let clear = aa.getMethod("clear");
                expect(clear).toBeTruthy();
                expect(clear.call(interpreter)).toBe(BrsInvalid.Instance);
                expect(aa.elements).toEqual(new Map());
            });
        });

        describe("delete", () => {
            it("deletes a given item in the associative array", () => {
                let aa = new AssociativeArray([
                    { name: new BrsString("foo"), value: new Int32(-99) },
                    { name: new BrsString("bar"), value: new Int32(800) }
                ]);

                let deleteCall = aa.getMethod("delete");
                expect(deleteCall).toBeTruthy();
                expect(deleteCall.call(interpreter, new BrsString("foo"))).toBe(BrsBoolean.True);
                expect(deleteCall.call(interpreter, new BrsString("baz"))).toBe(BrsBoolean.False);
                expect(aa.get(new BrsString("foo"))).toEqual(BrsInvalid.Instance);
            });
        });

        describe("addreplace", () => {
            it("adds new elements to the associative array", () => {
                let aa = new AssociativeArray([
                    { name: new BrsString("letter1"), value: new BrsString("a") }
                ]);

                let addreplace = aa.getMethod("addreplace");
                expect(addreplace).toBeTruthy();
                expect(addreplace.call(interpreter, new BrsString("letter2"), new BrsString("b"))).toBe(BrsInvalid.Instance);
                expect(aa.get(new BrsString("letter2"))).toEqual(new BrsString("b"));
            });

            it("replaces the value of known elements in the associative array", () => {
                let aa = new AssociativeArray([
                    { name: new BrsString("letter1"), value: new BrsString("a") }
                ]);

                let addreplace = aa.getMethod("addreplace");
                expect(addreplace).toBeTruthy();
                expect(addreplace.call(interpreter, new BrsString("letter1"), new BrsString("c"))).toBe(BrsInvalid.Instance);
                expect(aa.get(new BrsString("letter1"))).not.toEqual(new BrsString("a"));
                expect(aa.get(new BrsString("letter1"))).toEqual(new BrsString("c"));
            });

        });

        describe("count", () => {
            it("returns the number of items in the associative array", () => {
                let aa = new AssociativeArray([
                    { name: new BrsString("letter1"), value: new BrsString("a") },
                    { name: new BrsString("letter2"), value: new BrsString("b") }
                ]);

                let count = aa.getMethod("count");
                expect(count).toBeTruthy();

                let result = count.call(interpreter);
                expect(result).toEqual(new Int32(2));
            });
        })

        describe("doesexist", () => {
            it("returns true when an item exists in the array", () => {
                let aa = new AssociativeArray([
                    { name: new BrsString("letter1"), value: new BrsString("a") },
                    { name: new BrsString("letter2"), value: new BrsString("b") }
                ]);

                let doesexist = aa.getMethod("doesexist");
                expect(doesexist).toBeTruthy();

                let result = doesexist.call(interpreter, new BrsString("letter2"));
                expect(result.kind).toBe(ValueKind.Boolean);
                expect(result).toBe(BrsBoolean.True);
            });

            it("returns false when an item doesn't exist in the array", () => {
                let aa = new AssociativeArray([
                    { name: new BrsString("letter1"), value: new BrsString("a") },
                    { name: new BrsString("letter2"), value: new BrsString("b") }
                ]);

                let doesexist = aa.getMethod("doesexist");
                let result = doesexist.call(interpreter, new BrsString("letter3"));
                expect(result.kind).toBe(ValueKind.Boolean);
                expect(result).toBe(BrsBoolean.False);
            });
        })

        describe("append", () => {
            it("appends a new associative array to an existing one", () => {
                let aa1 = new AssociativeArray([
                    { name: new BrsString("letter1"), value: new BrsString("a") },
                ]);

                let append = aa1.getMethod("append");
                expect(append).toBeTruthy();

                let aa2 = new AssociativeArray([
                    { name: new BrsString("letter2"), value: new BrsString("b") },
                    { name: new BrsString("empty"), value: new BrsString("") },
                    { name: new BrsString("arr"), value: new BrsArray([new Int32(1), new BrsString("two")]) },
                    { name: new BrsString("obj"), value: new AssociativeArray([]) },
                    { name: new BrsString("num"), value: new Int32(555) }
                ]);

                let resultAA = new AssociativeArray([
                    { name: new BrsString("letter1"), value: new BrsString("a") },
                    { name: new BrsString("letter2"), value: new BrsString("b") },
                    { name: new BrsString("empty"), value: new BrsString("") },
                    { name: new BrsString("arr"), value: new BrsArray([new Int32(1), new BrsString("two")]) },
                    { name: new BrsString("obj"), value: new AssociativeArray([]) },
                    { name: new BrsString("num"), value: new Int32(555) }
                ]);

                let result = append.call(interpreter, aa2);
                expect(aa1.toString()).toEqual(resultAA.toString());
                expect(result).toBe(BrsInvalid.Instance);
            });
        });

        describe("keys", () => {
            it("returns an array of keys from the associative array in lexicographical order", () => {
                let letter1 = new BrsString("letter1");
                let letter2 = new BrsString("letter2");
                let cletter = new BrsString("cletter");

                let aa = new AssociativeArray([
                    { name: letter1, value: new BrsString("a") },
                    { name: letter2, value: new BrsString("b") },
                    { name: cletter, value: new BrsString("c") }
                ]);

                let keys = aa.getMethod("keys");
                expect(keys).toBeTruthy();

                let result = keys.call(interpreter);
                expect(result.elements).toEqual(new BrsArray([ cletter, letter1, letter2 ]).elements);
            });

            it("returns an empty array from an empty associative array", () => {
                let aa = new AssociativeArray([]);

                let keys = aa.getMethod("keys");
                expect(keys).toBeTruthy();

                let result = keys.call(interpreter);
                expect(result.elements).toEqual(new BrsArray([]).elements);
            });
        });

        describe("items", () => {
            it("returns an array of values from the associative array in lexicographical order", () => {
                let cletter = new BrsString("c");
                let letter1 = new BrsString("a");
                let letter2 = new BrsString("b");

                let aa = new AssociativeArray([
                    { name: new BrsString("cletter"), value: cletter },
                    { name: new BrsString("letter1"), value: letter1 },
                    { name: new BrsString("letter2"), value: letter2 }
                ]);

                let items = aa.getMethod("items");
                expect(items).toBeTruthy();
                let result = items.call(interpreter);
                expect(result.elements).toEqual(new BrsArray([ letter1, letter2, cletter ]).elements);
            });

            it("returns an empty array from an empty associative array", () => {
                let aa = new AssociativeArray([]);

                let items = aa.getMethod("items");
                expect(items).toBeTruthy();

                let result = items.call(interpreter);
                expect(result.elements).toEqual(new BrsArray([]).elements);
            });
        });
    });
});
