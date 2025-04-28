const brs = require("../../../bin/brs.node");
const { Interpreter } = brs;
const { RoAssociativeArray, RoArray, BrsBoolean, BrsString, Int32, BrsInvalid, ValueKind } = brs.types;

describe("RoAssociativeArray", () => {
    describe("comparisons", () => {
        it("is equal to nothing", () => {
            let a = new RoAssociativeArray([]);
            expect(a.equalTo(a)).toBe(BrsBoolean.False);
        });
    });

    describe("stringification", () => {
        it("lists all primitive values", () => {
            let aa = new RoAssociativeArray([
                {
                    name: new BrsString("array"),
                    value: new RoArray([new BrsString("I shouldn't appear")]),
                },
                { name: new BrsString("associative-array"), value: new RoAssociativeArray([]) },
                { name: new BrsString("boolean"), value: BrsBoolean.True },
                { name: new BrsString("string"), value: new BrsString("a string") },
                { name: new BrsString("number"), value: new Int32(-1) },
                { name: new BrsString("invalid"), value: BrsInvalid.Instance },
            ]);
            expect(aa.toString()).toEqual(
                `<Component: roAssociativeArray> =
{
    array: <Component: roArray>
    associative-array: <Component: roAssociativeArray>
    boolean: true
    invalid: invalid
    number: -1
    string: "a string"
}`
            );
        });
    });

    describe("get", () => {
        it("returns value given a key it contains", () => {
            let aa = new RoAssociativeArray([{ name: new BrsString("foo"), value: new Int32(-99) }]);

            expect(aa.get(new BrsString("foo"))).toEqual(new Int32(-99, true));
        });

        it("returns 'invalid' given a key it doesn't contain", () => {
            let aa = new RoAssociativeArray([]);

            expect(aa.get(new BrsString("does_not_exist"))).toEqual(BrsInvalid.Instance);
        });
    });

    describe("set", () => {
        it("sets values with new keys", () => {
            let aa = new RoAssociativeArray([{ name: new BrsString("foo"), value: new Int32(-99) }]);
            let ninetyNine = aa.get(new BrsString("foo"));

            aa.set(new BrsString("bar"), new Int32(808));
            expect(aa.get(new BrsString("bar"))).toEqual(new Int32(808, true));

            // ensure other keys don't get modified
            expect(aa.get(new BrsString("foo"))).toBe(ninetyNine);
        });

        it("overwrites values with existing keys", () => {
            let aa = new RoAssociativeArray([{ name: new BrsString("foo"), value: new Int32(-99) }]);

            aa.set(new BrsString("foo"), new BrsString("not ninetynine"));

            expect(aa.get(new BrsString("foo"))).toEqual(new BrsString("not ninetynine", true));
        });
    });

    describe("methods", () => {
        let interpreter;

        beforeEach(() => {
            interpreter = new Interpreter();
        });

        describe("clear", () => {
            it("empties the associative array", () => {
                let aa = new RoAssociativeArray([{ name: new BrsString("foo"), value: new Int32(-99) }]);

                let clear = aa.getMethod("clear");
                expect(clear).toBeTruthy();
                expect(clear.call(interpreter)).toBe(BrsInvalid.Instance);
                expect(aa.elements).toEqual(new Map());
            });
        });

        describe("delete", () => {
            it("deletes a given item in the associative array", () => {
                let aa = new RoAssociativeArray([
                    { name: new BrsString("foo"), value: new Int32(-99) },
                    { name: new BrsString("bar"), value: new Int32(800) },
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
                let aa = new RoAssociativeArray([{ name: new BrsString("letter1"), value: new BrsString("a") }]);

                let addreplace = aa.getMethod("addreplace");
                expect(addreplace).toBeTruthy();
                expect(addreplace.call(interpreter, new BrsString("letter2"), new BrsString("b"))).toBe(
                    BrsInvalid.Instance
                );
                expect(aa.get(new BrsString("letter2"))).toEqual(new BrsString("b", true));
            });

            it("replaces the value of known elements in the associative array", () => {
                let aa = new RoAssociativeArray([{ name: new BrsString("letter1"), value: new BrsString("a") }]);

                let addreplace = aa.getMethod("addreplace");
                expect(addreplace).toBeTruthy();
                expect(addreplace.call(interpreter, new BrsString("letter1"), new BrsString("c"))).toBe(
                    BrsInvalid.Instance
                );
                expect(aa.get(new BrsString("letter1"))).not.toEqual(new BrsString("a", true));
                expect(aa.get(new BrsString("letter1"))).toEqual(new BrsString("c", true));
            });
        });

        describe("count", () => {
            it("returns the number of items in the associative array", () => {
                let aa = new RoAssociativeArray([
                    { name: new BrsString("letter1"), value: new BrsString("a") },
                    { name: new BrsString("letter2"), value: new BrsString("b") },
                ]);

                let count = aa.getMethod("count");
                expect(count).toBeTruthy();

                let result = count.call(interpreter);
                expect(result).toEqual(new Int32(2));
            });
        });

        describe("doesexist", () => {
            it("returns true when an item exists in the array", () => {
                let aa = new RoAssociativeArray([
                    { name: new BrsString("letter1"), value: new BrsString("a") },
                    { name: new BrsString("letter2"), value: new BrsString("b") },
                ]);

                let doesexist = aa.getMethod("doesexist");
                expect(doesexist).toBeTruthy();

                let result = doesexist.call(interpreter, new BrsString("letter2"));
                expect(result.kind).toBe(ValueKind.Boolean);
                expect(result).toBe(BrsBoolean.True);
            });

            it("returns false when an item doesn't exist in the array", () => {
                let aa = new RoAssociativeArray([
                    { name: new BrsString("letter1"), value: new BrsString("a") },
                    { name: new BrsString("letter2"), value: new BrsString("b") },
                ]);

                let doesexist = aa.getMethod("doesexist");
                let result = doesexist.call(interpreter, new BrsString("letter3"));
                expect(result.kind).toBe(ValueKind.Boolean);
                expect(result).toBe(BrsBoolean.False);
            });
            it("returns true even when the value of an item contains invalid in the array", () => {
                let aa = new RoAssociativeArray([{ name: new BrsString("letter1"), value: BrsInvalid.Instance }]);

                let doesexist = aa.getMethod("doesexist");
                let result = doesexist.call(interpreter, new BrsString("letter1"));
                expect(result.kind).toBe(ValueKind.Boolean);
                expect(result).toBe(BrsBoolean.True);
            });
        });

        describe("append", () => {
            it("appends a new associative array to an existing one", () => {
                let aa1 = new RoAssociativeArray([{ name: new BrsString("letter1"), value: new BrsString("a") }]);

                let append = aa1.getMethod("append");
                expect(append).toBeTruthy();

                let aa2 = new RoAssociativeArray([
                    { name: new BrsString("letter2"), value: new BrsString("b") },
                    { name: new BrsString("empty"), value: new BrsString("") },
                    {
                        name: new BrsString("arr"),
                        value: new RoArray([new Int32(1), new BrsString("two")]),
                    },
                    { name: new BrsString("obj"), value: new RoAssociativeArray([]) },
                    { name: new BrsString("num"), value: new Int32(555) },
                ]);

                let resultAA = new RoAssociativeArray([
                    { name: new BrsString("letter1"), value: new BrsString("a") },
                    { name: new BrsString("letter2"), value: new BrsString("b") },
                    { name: new BrsString("empty"), value: new BrsString("") },
                    {
                        name: new BrsString("arr"),
                        value: new RoArray([new Int32(1), new BrsString("two")]),
                    },
                    { name: new BrsString("obj"), value: new RoAssociativeArray([]) },
                    { name: new BrsString("num"), value: new Int32(555) },
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

                let aa = new RoAssociativeArray([
                    { name: letter1, value: new BrsString("a") },
                    { name: letter2, value: new BrsString("b") },
                    { name: cletter, value: new BrsString("c") },
                ]);

                let keys = aa.getMethod("keys");
                expect(keys).toBeTruthy();

                let result = keys.call(interpreter);
                expect(result.elements).toEqual(new RoArray([cletter, letter1, letter2]).elements);
            });

            it("returns an empty array from an empty associative array", () => {
                let aa = new RoAssociativeArray([]);

                let keys = aa.getMethod("keys");
                expect(keys).toBeTruthy();

                let result = keys.call(interpreter);
                expect(result.elements).toEqual(new RoArray([]).elements);
            });
        });

        describe("items", () => {
            it("returns an array of values from the associative array in lexicographical order", () => {
                let cletter = new BrsString("c");
                let letter1 = new BrsString("a");
                let letter2 = new BrsString("b");

                let aa = new RoAssociativeArray([
                    { name: new BrsString("cletter"), value: cletter },
                    { name: new BrsString("letter1"), value: letter1 },
                    { name: new BrsString("letter2"), value: letter2 },
                ]);

                let items = aa.getMethod("items");
                expect(items).toBeTruthy();
                let result = items.call(interpreter);
                expect(result.elements[0].elements.get("key")).toEqual(new BrsString("cletter", true));
                expect(result.elements[0].elements.get("value")).toEqual(new BrsString("c", true));
                expect(result.elements[1].elements.get("key")).toEqual(new BrsString("letter1", true));
                expect(result.elements[1].elements.get("value")).toEqual(new BrsString("a", true));
                expect(result.elements[2].elements.get("key")).toEqual(new BrsString("letter2", true));
                expect(result.elements[2].elements.get("value")).toEqual(new BrsString("b", true));
            });

            it("returns an empty array from an empty associative array", () => {
                let aa = new RoAssociativeArray([]);

                let items = aa.getMethod("items");
                expect(items).toBeTruthy();

                let result = items.call(interpreter);
                expect(result.elements).toEqual(new RoArray([]).elements);
            });
        });

        describe("setModeCaseSensitive", () => {
            it("looks for key using case insensitive by default", () => {
                let v1 = new BrsString("value1");

                let aa = new RoAssociativeArray([{ name: new BrsString("key1"), value: v1 }]);

                let lookup = aa.getMethod("lookup");
                expect(lookup).toBeTruthy();

                let doesexist = aa.getMethod("doesexist");
                expect(doesexist).toBeTruthy();

                let result = lookup.call(interpreter, new BrsString("KeY1"));
                expect(result).toBe(v1);

                result = doesexist.call(interpreter, new BrsString("KeY1"));
                expect(result.kind).toBe(ValueKind.Boolean);
                expect(result).toBe(BrsBoolean.True);

                result = aa.get(new BrsString("KEY1"));
                expect(result).toBe(v1);
            });

            it("changes lookups to case sensitive mode", () => {
                let v1 = new BrsString("value1");
                let v2 = new BrsString("value2");

                let aa = new RoAssociativeArray([{ name: new BrsString("key1"), value: v1 }]);

                let lookup = aa.getMethod("lookup");
                expect(lookup).toBeTruthy();

                let doesexist = aa.getMethod("doesexist");
                expect(doesexist).toBeTruthy();

                let addreplace = aa.getMethod("addreplace");
                expect(addreplace).toBeTruthy();

                let setModeCaseSensitive = aa.getMethod("setmodecasesensitive");
                expect(setModeCaseSensitive).toBeTruthy();

                // Keys added in constructor are case insensitive
                let result1 = lookup.call(interpreter, new BrsString("KeY1"));
                expect(result1).toBe(v1);

                result1 = doesexist.call(interpreter, new BrsString("key1"));
                expect(result1.kind).toBe(ValueKind.Boolean);
                expect(result1).toBe(BrsBoolean.True);

                // Turn on case sensitive mode
                setModeCaseSensitive.call(interpreter);

                // Add a new key aftet case mode changed
                addreplace.call(interpreter, new BrsString("KeY2"), v2);

                let result2 = doesexist.call(interpreter, new BrsString("key2"));
                expect(result2.kind).toBe(ValueKind.Boolean);
                expect(result2).toBe(BrsBoolean.False);

                result2 = lookup.call(interpreter, new BrsString("KeY2"));
                expect(result2).toBe(v2);

                result2 = aa.get(new BrsString("KeY2"));
                expect(result2).toBe(v2);
            });
        });

        describe("lookupCI", () => {
            it("changes lookups to case sensitive mode", () => {
                let v1 = new BrsString("value1");
                let v2 = new BrsString("value2");
                let v3 = new BrsString("value3");

                let aa = new RoAssociativeArray([{ name: new BrsString("key1"), value: v1 }]);

                let setModeCaseSensitive = aa.getMethod("setmodecasesensitive");
                expect(setModeCaseSensitive).toBeTruthy();
                setModeCaseSensitive.call(interpreter);

                let addreplace = aa.getMethod("addreplace");
                expect(addreplace).toBeTruthy();
                addreplace.call(interpreter, new BrsString("KEY1"), v2);

                let lookup = aa.getMethod("lookup");
                expect(lookup).toBeTruthy();

                // check lookupCI method
                let lookupCI = aa.getMethod("lookupCI");

                addreplace.call(interpreter, new BrsString("Key1"), v3);
                expect(lookupCI).toBeTruthy();

                let result = lookup.call(interpreter, new BrsString("key1"));
                expect(result).toBe(v1);

                result = lookup.call(interpreter, new BrsString("KEY1"));
                expect(result).toBe(v2);

                result = lookupCI.call(interpreter, new BrsString("kEy1"));
                expect(result).toBe(v1);

                result = lookupCI.call(interpreter, new BrsString("KeY1"));
                expect(result).toBe(v1);
            });
        });
    });
});
