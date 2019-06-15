const brs = require("brs");
const {
    RoAssociativeArray,
    RoSGNode,
    RoArray,
    BrsBoolean,
    BrsString,
    Int32,
    BrsInvalid,
    ValueKind,
} = brs.types;
const { Interpreter } = require("../../../lib/interpreter");

describe("RoSGNode", () => {
    describe("stringification", () => {
        it("lists all primitive values", () => {
            let node = new RoSGNode([
                {
                    name: new BrsString("array"),
                    value: new RoArray([new BrsString("I shouldn't appear")]),
                },
                { name: new BrsString("associative-array"), value: new RoAssociativeArray([]) },
                { name: new BrsString("node"), value: new RoSGNode([]) },
                { name: new BrsString("boolean"), value: BrsBoolean.True },
                { name: new BrsString("string"), value: new BrsString("a string") },
                { name: new BrsString("number"), value: new Int32(-1) },
                { name: new BrsString("invalid"), value: BrsInvalid.Instance },
            ]);
            expect(node.toString()).toEqual(
                `<Component: roSGNode:Node> =
{
    array: <Component: roArray>
    associative-array: <Component: roAssociativeArray>
    node: <Component: roSGNode:Node>
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
            let node = new RoSGNode([{ name: new BrsString("foo"), value: new Int32(-99) }]);

            expect(node.get(new BrsString("foo"))).toEqual(new Int32(-99));
        });

        it("returns 'invalid' given a key it doesn't contain", () => {
            let node = new RoSGNode([]);

            expect(node.get(new BrsString("does_not_exist"))).toEqual(BrsInvalid.Instance);
        });
    });

    describe("set", () => {
        it("sets values with new keys", () => {
            let node = new RoSGNode([{ name: new BrsString("foo"), value: new Int32(-99) }]);
            let ninetyNine = node.get(new BrsString("foo"));

            node.set(new BrsString("bar"), new Int32(808));
            expect(node.get(new BrsString("bar"))).toEqual(new Int32(808));

            // ensure other keys don't get modified
            expect(node.get(new BrsString("foo"))).toBe(ninetyNine);
        });

        it("overwrites values with existing keys", () => {
            let node = new RoSGNode([{ name: new BrsString("foo"), value: new Int32(-99) }]);

            node.set(new BrsString("foo"), new BrsString("not ninetynine"));

            expect(node.get(new BrsString("foo"))).toEqual(new BrsString("not ninetynine"));
        });
    });

    describe("methods", () => {
        let interpreter;

        beforeEach(() => {
            interpreter = new Interpreter();
        });

        describe("clear", () => {
            it("empties the associative array", () => {
                let node = new RoSGNode([{ name: new BrsString("foo"), value: new Int32(-99) }]);

                let clear = node.getMethod("clear");
                expect(clear).toBeTruthy();
                expect(clear.call(interpreter)).toBe(BrsInvalid.Instance);
                expect(node.elements).toEqual(new Map());
            });
        });

        describe("delete", () => {
            it("deletes a given item in the associative array", () => {
                let node = new RoSGNode([
                    { name: new BrsString("foo"), value: new Int32(-99) },
                    { name: new BrsString("bar"), value: new Int32(800) },
                ]);

                let deleteCall = node.getMethod("delete");
                expect(deleteCall).toBeTruthy();
                expect(deleteCall.call(interpreter, new BrsString("foo"))).toBe(BrsBoolean.True);
                expect(deleteCall.call(interpreter, new BrsString("baz"))).toBe(BrsBoolean.False);
                expect(node.get(new BrsString("foo"))).toEqual(BrsInvalid.Instance);
            });
        });

        describe("addreplace", () => {
            it("adds new elements to the associative array", () => {
                let node = new RoSGNode([
                    { name: new BrsString("letter1"), value: new BrsString("a") },
                ]);

                let addreplace = node.getMethod("addreplace");
                expect(addreplace).toBeTruthy();
                expect(
                    addreplace.call(interpreter, new BrsString("letter2"), new BrsString("b"))
                ).toBe(BrsInvalid.Instance);
                expect(node.get(new BrsString("letter2"))).toEqual(new BrsString("b"));
            });

            it("replaces the value of known elements in the associative array", () => {
                let node = new RoSGNode([
                    { name: new BrsString("letter1"), value: new BrsString("a") },
                ]);

                let addreplace = node.getMethod("addreplace");
                expect(addreplace).toBeTruthy();
                expect(
                    addreplace.call(interpreter, new BrsString("letter1"), new BrsString("c"))
                ).toBe(BrsInvalid.Instance);
                expect(node.get(new BrsString("letter1"))).not.toEqual(new BrsString("a"));
                expect(node.get(new BrsString("letter1"))).toEqual(new BrsString("c"));
            });
        });

        describe("count", () => {
            it("returns the number of items in the associative array", () => {
                let node = new RoSGNode([
                    { name: new BrsString("letter1"), value: new BrsString("a") },
                    { name: new BrsString("letter2"), value: new BrsString("b") },
                ]);

                let count = node.getMethod("count");
                expect(count).toBeTruthy();

                let result = count.call(interpreter);
                expect(result).toEqual(new Int32(2));
            });
        });

        describe("doesexist", () => {
            it("returns true when an item exists in the array", () => {
                let node = new RoSGNode([
                    { name: new BrsString("letter1"), value: new BrsString("a") },
                    { name: new BrsString("letter2"), value: new BrsString("b") },
                ]);

                let doesexist = node.getMethod("doesexist");
                expect(doesexist).toBeTruthy();

                let result = doesexist.call(interpreter, new BrsString("letter2"));
                expect(result.kind).toBe(ValueKind.Boolean);
                expect(result).toBe(BrsBoolean.True);
            });

            it("returns false when an item doesn't exist in the array", () => {
                let node = new RoSGNode([
                    { name: new BrsString("letter1"), value: new BrsString("a") },
                    { name: new BrsString("letter2"), value: new BrsString("b") },
                ]);

                let doesexist = node.getMethod("doesexist");
                let result = doesexist.call(interpreter, new BrsString("letter3"));
                expect(result.kind).toBe(ValueKind.Boolean);
                expect(result).toBe(BrsBoolean.False);
            });
        });

        describe("append", () => {
            it("appends a new associative array to an existing one", () => {
                let node1 = new RoSGNode([
                    { name: new BrsString("letter1"), value: new BrsString("a") },
                ]);

                let append = node1.getMethod("append");
                expect(append).toBeTruthy();

                let node2 = new RoSGNode([
                    { name: new BrsString("letter2"), value: new BrsString("b") },
                    { name: new BrsString("empty"), value: new BrsString("") },
                    {
                        name: new BrsString("arr"),
                        value: new RoArray([new Int32(1), new BrsString("two")]),
                    },
                    { name: new BrsString("obj"), value: new RoSGNode([]) },
                    { name: new BrsString("num"), value: new Int32(555) },
                ]);

                let resultNode = new RoSGNode([
                    { name: new BrsString("letter1"), value: new BrsString("a") },
                    { name: new BrsString("letter2"), value: new BrsString("b") },
                    { name: new BrsString("empty"), value: new BrsString("") },
                    {
                        name: new BrsString("arr"),
                        value: new RoArray([new Int32(1), new BrsString("two")]),
                    },
                    { name: new BrsString("obj"), value: new RoSGNode([]) },
                    { name: new BrsString("num"), value: new Int32(555) },
                ]);

                let result = append.call(interpreter, node2);
                expect(node1.toString()).toEqual(resultNode.toString());
                expect(result).toBe(BrsInvalid.Instance);
            });
        });

        describe("keys", () => {
            it("returns an array of keys from the associative array in lexicographical order", () => {
                let letter1 = new BrsString("letter1");
                let letter2 = new BrsString("letter2");
                let cletter = new BrsString("cletter");

                let node = new RoSGNode([
                    { name: letter1, value: new BrsString("a") },
                    { name: letter2, value: new BrsString("b") },
                    { name: cletter, value: new BrsString("c") },
                ]);

                let keys = node.getMethod("keys");
                expect(keys).toBeTruthy();

                let result = keys.call(interpreter);
                expect(result.elements).toEqual(new RoArray([cletter, letter1, letter2]).elements);
            });

            it("returns an empty array from an empty associative array", () => {
                let node = new RoSGNode([]);

                let keys = node.getMethod("keys");
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

                let node = new RoSGNode([
                    { name: new BrsString("cletter"), value: cletter },
                    { name: new BrsString("letter1"), value: letter1 },
                    { name: new BrsString("letter2"), value: letter2 },
                ]);

                let items = node.getMethod("items");
                expect(items).toBeTruthy();
                let result = items.call(interpreter);
                expect(result.elements).toEqual(new RoArray([letter1, letter2, cletter]).elements);
            });

            it("returns an empty array from an empty associative array", () => {
                let node = new RoSGNode([]);

                let items = node.getMethod("items");
                expect(items).toBeTruthy();

                let result = items.call(interpreter);
                expect(result.elements).toEqual(new RoArray([]).elements);
            });
        });
    });
});
