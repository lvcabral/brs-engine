const brs = require("brs");
const { RoArray, RoAssociativeArray, BrsBoolean, BrsString, Int32, BrsInvalid, Float } = brs.types;
const { Interpreter } = require("../../../lib/interpreter");
const { createMockStreams } = require("../../e2e/E2ETests");

describe("RoArray", () => {
    describe("comparisons", () => {
        it("is equal to nothing", () => {
            let a = new RoArray([]);
            expect(a.equalTo(a)).toBe(BrsBoolean.False);
        });
    });

    describe("stringification", () => {
        it("lists all primitive values", () => {
            let arr = new RoArray([
                new RoArray([new BrsString("I shouldn't appear")]),
                BrsBoolean.True,
                new BrsString("a string"),
                new Int32(-1),
                BrsInvalid.Instance,
            ]);
            expect(arr.toString()).toEqual(
                `<Component: roArray> =
[
    <Component: roArray>
    true
    a string
    -1
    invalid
]`
            );
        });
    });

    describe("get", () => {
        it("returns values from in-bounds indexes", () => {
            let a = new BrsString("a");
            let b = new BrsString("b");
            let c = new BrsString("c");

            let arr = new RoArray([a, b, c]);

            expect(arr.get(new Int32(0))).toBe(a);
            expect(arr.get(new Int32(2))).toBe(c);
        });

        it("returns invalid for out-of-bounds indexes", () => {
            let arr = new RoArray([]);

            expect(arr.get(new Int32(555))).toBe(BrsInvalid.Instance);
        });
    });

    describe("set", () => {
        it("sets values at in-bounds indexes", () => {
            let a = new BrsString("a");
            let b = new BrsString("b");
            let c = new BrsString("c");

            let arr = new RoArray([a, b, c]);

            arr.set(new Int32(0), new BrsString("replacement for a"));
            arr.set(new Int32(2), new BrsString("replacement for c"));

            expect(arr.get(new Int32(0))).toEqual(new BrsString("replacement for a"));
            expect(arr.get(new Int32(2))).toEqual(new BrsString("replacement for c"));
        });

        it("sets values at out-of-bounds indexes", () => {
            let arr = new RoArray([]);

            arr.set(new Int32(555), new BrsString("value set at index 555"));
            expect(arr.get(new Int32(555))).toEqual(new BrsString("value set at index 555"));
        });
    });

    describe("methods", () => {
        let interpreter;

        beforeEach(() => {
            let mockStreams = createMockStreams();
            interpreter = new Interpreter({
                stdout: mockStreams.stdout,
                stderr: mockStreams.stderr,
            });
        });

        describe("peek", () => {
            it("returns the value at the highest index", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let arr = new RoArray([a, b, c]);

                let peek = arr.getMethod("peek");
                expect(peek).toBeTruthy();
                expect(peek.call(interpreter)).toBe(c);
            });

            it("returns `invalid` when empty", () => {
                let arr = new RoArray([]);

                let peek = arr.getMethod("peek");
                expect(peek).toBeTruthy();
                expect(peek.call(interpreter)).toBe(BrsInvalid.Instance);
            });
        });

        describe("pop", () => {
            it("returns and removes the value at the highest index", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let arr = new RoArray([a, b, c]);

                let pop = arr.getMethod("pop");
                expect(pop).toBeTruthy();
                expect(pop.call(interpreter)).toBe(c);
                expect(arr.elements).toEqual([a, b]);
            });

            it("returns `invalid` and doesn't modify when empty", () => {
                let arr = new RoArray([]);

                let pop = arr.getMethod("pop");
                expect(pop).toBeTruthy();

                let before = arr.getElements();
                expect(pop.call(interpreter)).toBe(BrsInvalid.Instance);
                expect(arr.getElements()).toEqual(before);
            });
        });

        describe("push", () => {
            it("appends a value to the end of the array", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let arr = new RoArray([a, b]);

                let push = arr.getMethod("push");
                expect(push).toBeTruthy();
                expect(push.call(interpreter, c)).toBe(BrsInvalid.Instance);
                expect(arr.elements).toEqual([a, b, c]);
            });
        });

        describe("shift", () => {
            it("returns and removes the value at the lowest index", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let arr = new RoArray([a, b, c]);

                let shift = arr.getMethod("shift");
                expect(shift).toBeTruthy();
                expect(shift.call(interpreter)).toBe(a);
                expect(arr.elements).toEqual([b, c]);
            });

            it("returns `invalid` and doesn't modify when empty", () => {
                let arr = new RoArray([]);

                let shift = arr.getMethod("shift");
                expect(shift).toBeTruthy();

                let before = arr.getElements();
                expect(shift.call(interpreter)).toBe(BrsInvalid.Instance);
                expect(arr.getElements()).toEqual(before);
            });
        });

        describe("unshift", () => {
            it("inserts a value at the beginning of the array", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let arr = new RoArray([b, c]);

                let unshift = arr.getMethod("unshift");
                expect(unshift).toBeTruthy();
                expect(unshift.call(interpreter, a)).toBe(BrsInvalid.Instance);
                expect(arr.elements).toEqual([a, b, c]);
            });
        });

        describe("delete", () => {
            it("removes elements from in-bounds indices", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let arr = new RoArray([a, b, c]);

                let deleteMethod = arr.getMethod("delete");
                expect(deleteMethod).toBeTruthy();
                expect(deleteMethod.call(interpreter, new Int32(1))).toBe(BrsBoolean.True);
                expect(arr.elements).toEqual([a, c]);
            });

            it("doesn't remove elements from out-of-bounds indices", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let arr = new RoArray([a, b, c]);

                let deleteMethod = arr.getMethod("delete");
                expect(deleteMethod).toBeTruthy();
                expect(deleteMethod.call(interpreter, new Int32(1111))).toBe(BrsBoolean.False);
                expect(deleteMethod.call(interpreter, new Int32(-1))).toBe(BrsBoolean.False);
                expect(arr.elements).toEqual([a, b, c]);
            });
        });

        describe("count", () => {
            it("returns the length of the array", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let arr = new RoArray([a, b, c]);

                let count = arr.getMethod("count");
                expect(count).toBeTruthy();
                expect(count.call(interpreter)).toEqual(new Int32(3));
            });
        });

        describe("clear", () => {
            it("empties the array", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let arr = new RoArray([a, b]);

                let clear = arr.getMethod("clear");
                expect(clear).toBeTruthy();
                expect(clear.call(interpreter)).toBe(BrsInvalid.Instance);
                expect(arr.elements).toEqual([]);
            });
        });

        describe("append", () => {
            it("adds non-empty elements to the current array", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let src = new RoArray([a, b]);

                let c = new BrsString("c");
                let d = new BrsString("d");
                let e = new BrsString("e");
                let f = new BrsString("f");
                let other = new RoArray([c, undefined, d, undefined, undefined, e, f, undefined]);

                let append = src.getMethod("append");
                expect(append).toBeTruthy();
                expect(append.call(interpreter, other)).toBe(BrsInvalid.Instance);
                expect(src.elements).toEqual([a, b, c, d, e, f]);
            });
        });

        describe("join", () => {
            it("joins the string elements of the current array", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");
                let src = new RoArray([a, b, c]);

                let join = src.getMethod("join");
                expect(join).toBeTruthy();
                expect(join.call(interpreter, new BrsString(","))).toEqual(new BrsString("a,b,c"));
            });

            it("return empty string when any element is a non string value", () => {
                let a = new BrsString("a");
                let b = new Int32(1);
                let c = new BrsString("c");
                let src = new RoArray([a, b, c]);

                let join = src.getMethod("join");
                expect(join).toBeTruthy();
                expect(join.call(interpreter, new BrsString(","))).toEqual(new BrsString(""));
            });
            it("return empty string when any element is invalid", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = BrsInvalid.Instance;
                let src = new RoArray([a, b, c]);

                let join = src.getMethod("join");
                expect(join).toBeTruthy();
                expect(join.call(interpreter, new BrsString(","))).toEqual(new BrsString(""));
            });
        });

        describe("sort", () => {
            it("sorts mixed elements properly", () => {
                let strA = new BrsString("a");
                let strAaa = new BrsString("aaa");
                let strB = new BrsString("b");
                let strBaa = new BrsString("baa");
                let strC = new BrsString("c");
                let i3 = new Int32(3);
                let i1 = new Int32(1);
                let f2_5 = new Float(2.5);
                let i2 = new Int32(2);
                let i10 = new Int32(10);
                let bool_t = new BrsBoolean(true);
                let bool_f = new BrsBoolean(false);
                let aa1 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(1) },
                    { name: new BrsString("name"), value: new BrsString("Carol") },
                ]);
                let aa2 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(2) },
                    { name: new BrsString("name"), value: new BrsString("Betty") },
                ]);

                let ar = new RoArray([]);

                let src = new RoArray([
                    strA,
                    strB,
                    strC,
                    i3,
                    aa1,
                    i1,
                    i2,
                    i10,
                    f2_5,
                    bool_t,
                    ar,
                    strBaa,
                    strAaa,
                    aa2,
                    bool_f,
                ]);

                let sort = src.getMethod("sort");
                expect(sort).toBeTruthy();
                expect(sort.call(interpreter)).toBe(BrsInvalid.Instance);
                // numbers in order, strings in order (case sensitive - uppercase first), assocArrays, everything else
                expect(src.elements).toEqual([
                    i1, // numbers in order - value = 1
                    i2, // value = 2
                    f2_5, // value = 2.5
                    i3, // value = 3
                    i10, // value = 10
                    strA, // strings in order - value = "a"
                    strAaa, // value = "aaa"
                    strB, // value = "b"
                    strBaa, //value = "baa"
                    strC, // value = "c"
                    aa1, // assoc arrays in original order
                    aa2,
                    bool_t, // everything else in original order
                    ar,
                    bool_f,
                ]);
            });

            it("sorts the elements of the array with no flags", () => {
                let a = new BrsString("a");
                let b = new BrsString("B");
                let c = new BrsString("c");
                let i3 = new Int32(3);
                let i1 = new Int32(1);
                let i2 = new Int32(2);
                let src = new RoArray([a, b, c, i3, i1, i2]);

                let sort = src.getMethod("sort");
                expect(sort).toBeTruthy();
                expect(sort.call(interpreter)).toBe(BrsInvalid.Instance);
                expect(src.elements).toEqual([i1, i2, i3, b, a, c]);
            });

            it("sorts the elements of the array with empty flags", () => {
                let a = new BrsString("a");
                let b = new BrsString("B");
                let c = new BrsString("c");
                let i3 = new Int32(3);
                let i1 = new Int32(1);
                let i2 = new Int32(2);
                let src = new RoArray([a, b, c, i3, i1, i2]);

                let sort = src.getMethod("sort");
                expect(sort).toBeTruthy();
                expect(sort.call(interpreter, new BrsString(""))).toBe(BrsInvalid.Instance);
                expect(src.elements).toEqual([i1, i2, i3, b, a, c]);
            });

            it("sorts the elements of the array with flags = i", () => {
                let a = new BrsString("a");
                let b = new BrsString("B");
                let c = new BrsString("c");
                let i3 = new Int32(3);
                let i1 = new Int32(1);
                let i2 = new Int32(2);
                let src = new RoArray([a, b, c, i3, i1, i2]);

                let sort = src.getMethod("sort");
                expect(sort).toBeTruthy();
                expect(sort.call(interpreter, new BrsString("i"))).toBe(BrsInvalid.Instance);
                expect(src.elements).toEqual([i1, i2, i3, a, b, c]);
            });

            it("sorts the elements of the array with flags = ii", () => {
                let a = new BrsString("a");
                let b = new BrsString("B");
                let c = new BrsString("c");
                let i3 = new Int32(3);
                let i1 = new Int32(1);
                let i2 = new Int32(2);
                let src = new RoArray([a, b, c, i3, i1, i2]);

                let sort = src.getMethod("sort");
                expect(sort).toBeTruthy();
                expect(sort.call(interpreter, new BrsString("ii"))).toBe(BrsInvalid.Instance);
                expect(src.elements).toEqual([i1, i2, i3, a, b, c]);
            });

            it("sorts the elements of the array with flag = r", () => {
                let a = new BrsString("a");
                let b = new BrsString("B");
                let c = new BrsString("c");
                let i3 = new Int32(3);
                let i1 = new Int32(1);
                let i2 = new Int32(2);
                let src = new RoArray([a, b, c, i3, i1, i2]);

                let sort = src.getMethod("sort");
                expect(sort).toBeTruthy();
                expect(sort.call(interpreter, new BrsString("r"))).toBe(BrsInvalid.Instance);
                expect(src.elements).toEqual([c, a, b, i3, i2, i1]);
            });

            it("sorts the elements of the array with flag = ir", () => {
                let a = new BrsString("a");
                let b = new BrsString("B");
                let c = new BrsString("c");
                let i3 = new Int32(3);
                let i1 = new Int32(1);
                let i2 = new Int32(2);
                let src = new RoArray([a, b, c, i3, i1, i2]);

                let sort = src.getMethod("sort");
                expect(sort).toBeTruthy();
                expect(sort.call(interpreter, new BrsString("ir"))).toBe(BrsInvalid.Instance);
                expect(src.elements).toEqual([c, b, a, i3, i2, i1]);
            });

            it("sorts the elements of the array with flag = ri", () => {
                let a = new BrsString("a");
                let b = new BrsString("B");
                let c = new BrsString("c");
                let i3 = new Int32(3);
                let i1 = new Int32(1);
                let i2 = new Int32(2);
                let src = new RoArray([a, b, c, i3, i1, i2]);

                let sort = src.getMethod("sort");
                expect(sort).toBeTruthy();
                expect(sort.call(interpreter, new BrsString("ri"))).toBe(BrsInvalid.Instance);
                expect(src.elements).toEqual([c, b, a, i3, i2, i1]);
            });

            it("sorts the elements of the array with flag = rir", () => {
                let a = new BrsString("a");
                let b = new BrsString("B");
                let c = new BrsString("c");
                let i3 = new Int32(3);
                let i1 = new Int32(1);
                let i2 = new Int32(2);
                let src = new RoArray([a, b, c, i3, i1, i2]);

                let sort = src.getMethod("sort");
                expect(sort).toBeTruthy();
                expect(sort.call(interpreter, new BrsString("rir"))).toBe(BrsInvalid.Instance);
                expect(src.elements).toEqual([c, b, a, i3, i2, i1]);
            });

            it("sorts the elements of the array with array elements and no flags", () => {
                let a = new BrsString("a");
                let b = new BrsString("B");
                let c = new BrsString("c");
                let ar = new RoArray([]);
                let aa = new RoAssociativeArray([]);
                let i3 = new Int32(3);
                let i1 = new Int32(1);
                let i2 = new Int32(2);
                let src = new RoArray([a, b, c, ar, aa, i3, i1, i2]);

                let sort = src.getMethod("sort");
                expect(sort).toBeTruthy();
                expect(sort.call(interpreter)).toBe(BrsInvalid.Instance);
                expect(src.elements).toEqual([i1, i2, i3, b, a, c, aa, ar]);
            });

            it("sorts the elements of the array with array elements and flag = ir", () => {
                let a = new BrsString("a");
                let b = new BrsString("B");
                let c = new BrsString("c");
                let ar = new RoArray([]);
                let aa = new RoAssociativeArray([]);
                let i3 = new Int32(3);
                let i1 = new Int32(1);
                let i2 = new Int32(2);
                let src = new RoArray([a, b, c, ar, aa, i3, i1, i2]);

                let sort = src.getMethod("sort");
                expect(sort).toBeTruthy();
                expect(sort.call(interpreter, new BrsString("ir"))).toBe(BrsInvalid.Instance);
                expect(src.elements).toEqual([ar, aa, c, b, a, i3, i2, i1]);
            });

            it("sorts the elements of the array with invalid flag", () => {
                let a = new BrsString("a");
                let b = new BrsString("B");
                let c = new BrsString("c");
                let i3 = new Int32(3);
                let i1 = new Int32(1);
                let i2 = new Int32(2);
                let src = new RoArray([a, b, c, i3, i1, i2]);

                let sort = src.getMethod("sort");
                expect(sort).toBeTruthy();
                expect(sort.call(interpreter, new BrsString("ari"))).toBe(BrsInvalid.Instance);
                expect(src.elements).toEqual([a, b, c, i3, i1, i2]);
            });
        });

        describe("sortBy", () => {
            it("sorts the array based on AA case matching valid string field with no flags", () => {
                let a1 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(1) },
                    { name: new BrsString("name"), value: new BrsString("Carol") },
                ]);
                let a3 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(3) },
                    { name: new BrsString("name"), value: new BrsString("Betty") },
                ]);
                let a2 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(2) },
                    { name: new BrsString("name"), value: new BrsString("anne") },
                ]);
                let a = new BrsString("a");
                let b = new BrsString("B");
                let ar = new RoArray([]);
                let i2 = new Int32(2);
                let i1 = new Int32(1);
                let src = new RoArray([a1, a3, a2, a, b, ar, i2, i1]);

                let sortBy = src.getMethod("sortBy");
                expect(sortBy).toBeTruthy();
                expect(sortBy.call(interpreter, new BrsString("name"))).toBe(BrsInvalid.Instance);
                expect(src.elements).toEqual([i2, i1, a, b, a3, a1, a2, ar]);
            });

            it("sorts the array based on AA non-matching case valid field with no flags", () => {
                let a1 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(1) },
                    { name: new BrsString("name"), value: new BrsString("Carol") },
                ]);
                let a3 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(3) },
                    { name: new BrsString("name"), value: new BrsString("Betty") },
                ]);
                let a2 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(2) },
                    { name: new BrsString("name"), value: new BrsString("anne") },
                ]);
                let a = new BrsString("a");
                let b = new BrsString("B");
                let ar = new RoArray([]);
                let i2 = new Int32(2);
                let i1 = new Int32(1);
                let src = new RoArray([a1, a3, a2, a, b, ar, i2, i1]);

                let sortBy = src.getMethod("sortBy");
                expect(sortBy).toBeTruthy();
                expect(sortBy.call(interpreter, new BrsString("nAme"))).toBe(BrsInvalid.Instance);
                expect(src.elements).toEqual([i2, i1, a, b, a3, a1, a2, ar]);
            });

            it("sorts the array based on AA valid string field with flags = i", () => {
                let a1 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(1) },
                    { name: new BrsString("name"), value: new BrsString("Carol") },
                ]);
                let a3 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(3) },
                    { name: new BrsString("name"), value: new BrsString("Betty") },
                ]);
                let a2 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(2) },
                    { name: new BrsString("name"), value: new BrsString("anne") },
                ]);
                let a = new BrsString("a");
                let b = new BrsString("B");
                let ar = new RoArray([]);
                let i2 = new Int32(2);
                let i1 = new Int32(1);
                let src = new RoArray([a1, a3, a2, a, b, ar, i2, i1]);

                let sortBy = src.getMethod("sortBy");
                expect(sortBy).toBeTruthy();
                expect(sortBy.call(interpreter, new BrsString("name"), new BrsString("i"))).toBe(
                    BrsInvalid.Instance
                );
                expect(src.elements).toEqual([i2, i1, a, b, a2, a3, a1, ar]);
            });

            it("sorts the array based on AA valid string field with flags = r", () => {
                let a1 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(1) },
                    { name: new BrsString("name"), value: new BrsString("Carol") },
                ]);
                let a3 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(3) },
                    { name: new BrsString("name"), value: new BrsString("Betty") },
                ]);
                let a2 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(2) },
                    { name: new BrsString("name"), value: new BrsString("anne") },
                ]);
                let a = new BrsString("a");
                let b = new BrsString("B");
                let ar = new RoArray([]);
                let i2 = new Int32(2);
                let i1 = new Int32(1);
                let src = new RoArray([a1, a3, a2, a, b, ar, i2, i1]);

                let sortBy = src.getMethod("sortBy");
                expect(sortBy).toBeTruthy();
                expect(sortBy.call(interpreter, new BrsString("name"), new BrsString("r"))).toBe(
                    BrsInvalid.Instance
                );
                expect(src.elements).toEqual([ar, a2, a1, a3, b, a, i1, i2]);
            });

            it("sorts the array based on AA valid string field with flags = ir", () => {
                let a1 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(1) },
                    { name: new BrsString("name"), value: new BrsString("Carol") },
                ]);
                let a3 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(3) },
                    { name: new BrsString("name"), value: new BrsString("Betty") },
                ]);
                let a2 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(2) },
                    { name: new BrsString("name"), value: new BrsString("anne") },
                ]);
                let a = new BrsString("a");
                let b = new BrsString("B");
                let ar = new RoArray([]);
                let i2 = new Int32(2);
                let i1 = new Int32(1);
                let src = new RoArray([a1, a3, a2, a, b, ar, i2, i1]);

                let sortBy = src.getMethod("sortBy");
                expect(sortBy).toBeTruthy();
                expect(sortBy.call(interpreter, new BrsString("name"), new BrsString("ir"))).toBe(
                    BrsInvalid.Instance
                );
                expect(src.elements).toEqual([ar, a1, a3, a2, b, a, i1, i2]);
            });

            it("sorts the array based on AA valid string field with flags = riir", () => {
                let a1 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(1) },
                    { name: new BrsString("name"), value: new BrsString("Carol") },
                ]);
                let a3 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(3) },
                    { name: new BrsString("name"), value: new BrsString("Betty") },
                ]);
                let a2 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(2) },
                    { name: new BrsString("name"), value: new BrsString("anne") },
                ]);
                let a = new BrsString("a");
                let b = new BrsString("B");
                let ar = new RoArray([]);
                let i2 = new Int32(2);
                let i1 = new Int32(1);
                let src = new RoArray([a1, a3, a2, a, b, ar, i2, i1]);

                let sortBy = src.getMethod("sortBy");
                expect(sortBy).toBeTruthy();
                expect(sortBy.call(interpreter, new BrsString("name"), new BrsString("riir"))).toBe(
                    BrsInvalid.Instance
                );
                expect(src.elements).toEqual([ar, a1, a3, a2, b, a, i1, i2]);
            });

            it("sorts the array based on AA valid numeric field with no flags", () => {
                let a3 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(3) },
                    { name: new BrsString("name"), value: new BrsString("Betty") },
                ]);
                let a1 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(1) },
                    { name: new BrsString("name"), value: new BrsString("Carol") },
                ]);
                let a2 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(2) },
                    { name: new BrsString("name"), value: new BrsString("anne") },
                ]);
                let a = new BrsString("a");
                let b = new BrsString("B");
                let ar = new RoArray([]);
                let i2 = new Int32(2);
                let i1 = new Int32(1);
                let src = new RoArray([a3, a1, a2, a, b, ar, i2, i1]);

                let sortBy = src.getMethod("sortBy");
                expect(sortBy).toBeTruthy();
                expect(sortBy.call(interpreter, new BrsString("id"))).toBe(BrsInvalid.Instance);
                expect(src.elements).toEqual([i2, i1, a, b, a1, a2, a3, ar]);
            });

            it("sorts the array based on AA valid mixed field", () => {
                let a1 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(1) },
                    { name: new BrsString("name"), value: new BrsString("Carol") },
                    { name: new BrsString("data"), value: new Int32(10) },
                ]);
                let a2 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(2) },
                    { name: new BrsString("name"), value: new BrsString("anne") },
                    { name: new BrsString("data"), value: new Float(9.5) },
                ]);
                let a3 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(3) },
                    { name: new BrsString("name"), value: new BrsString("Betty") },
                    { name: new BrsString("data"), value: new BrsString("abc") },
                ]);
                let a4 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(4) },
                    { name: new BrsString("name"), value: new BrsString("Dave") },
                    { name: new BrsString("data"), value: new BrsBoolean(true) },
                ]);
                let a5 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(5) },
                    { name: new BrsString("name"), value: new BrsString("Dave") },
                ]);
                let strA = new BrsString("a");
                let strB = new BrsString("B");
                let boolTrue = new BrsBoolean(true);
                let boolFalse = new BrsBoolean(false);
                let arr = new RoArray([]);
                let i2 = new Int32(2);
                let i1 = new Int32(1);
                let src = new RoArray([
                    a3,
                    a4,
                    a5,
                    a1,
                    a2,
                    strA,
                    strB,
                    boolTrue,
                    arr,
                    i2,
                    i1,
                    boolFalse,
                ]);

                let sortBy = src.getMethod("sortBy");
                expect(sortBy).toBeTruthy();
                expect(sortBy.call(interpreter, new BrsString("data"))).toBe(BrsInvalid.Instance);
                expect(src.elements).toEqual([
                    i2, // numbers in original order
                    i1,
                    strA, // strings in original order
                    strB,
                    a2, // data = 9.5
                    a1, // data = 10
                    a3, // data = "abc"
                    a4, // data = true
                    a5, // no data property
                    boolTrue, // everything else in original order
                    arr,
                    boolFalse,
                ]);
            });

            it("sorts the array based on AA valid numeric field with flags = r", () => {
                let a1 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(1) },
                    { name: new BrsString("name"), value: new BrsString("Carol") },
                ]);
                let a3 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(3) },
                    { name: new BrsString("name"), value: new BrsString("Betty") },
                ]);
                let a2 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(2) },
                    { name: new BrsString("name"), value: new BrsString("anne") },
                ]);
                let a = new BrsString("a");
                let b = new BrsString("B");
                let ar = new RoArray([]);
                let i2 = new Int32(2);
                let i1 = new Int32(1);
                let src = new RoArray([a1, a3, a2, a, b, ar, i2, i1]);

                let sortBy = src.getMethod("sortBy");
                expect(sortBy).toBeTruthy();
                expect(sortBy.call(interpreter, new BrsString("ID"), new BrsString("r"))).toBe(
                    BrsInvalid.Instance
                );
                expect(src.elements).toEqual([ar, a3, a2, a1, b, a, i1, i2]);
            });

            it("sorts the array based on AA inexistent field with no flags", () => {
                let a3 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(3) },
                    { name: new BrsString("name"), value: new BrsString("Betty") },
                ]);
                let a1 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(1) },
                    { name: new BrsString("name"), value: new BrsString("Carol") },
                ]);
                let a2 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(2) },
                    { name: new BrsString("name"), value: new BrsString("anne") },
                ]);
                let a = new BrsString("a");
                let b = new BrsString("B");
                let ar = new RoArray([]);
                let i2 = new Int32(2);
                let i1 = new Int32(1);
                let src = new RoArray([a3, a1, a2, a, b, ar, i2, i1]);

                let sortBy = src.getMethod("sortBy");
                expect(sortBy).toBeTruthy();
                expect(sortBy.call(interpreter, new BrsString("xyz"))).toBe(BrsInvalid.Instance);
                expect(src.elements).toEqual([i2, i1, a, b, a3, a1, a2, ar]);
            });

            it("sorts the array based on AA empty field with no flags", () => {
                let a3 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(3) },
                    { name: new BrsString("name"), value: new BrsString("Betty") },
                ]);
                let a1 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(1) },
                    { name: new BrsString("name"), value: new BrsString("Carol") },
                ]);
                let a2 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(2) },
                    { name: new BrsString("name"), value: new BrsString("anne") },
                ]);
                let a = new BrsString("a");
                let b = new BrsString("B");
                let ar = new RoArray([]);
                let i2 = new Int32(2);
                let i1 = new Int32(1);
                let src = new RoArray([a3, a1, a2, a, b, ar, i2, i1]);

                let sortBy = src.getMethod("sortBy");
                expect(sortBy).toBeTruthy();
                expect(sortBy.call(interpreter, new BrsString(""))).toBe(BrsInvalid.Instance);
                expect(src.elements).toEqual([i2, i1, a, b, a3, a1, a2, ar]);
            });

            it("sorts the array based on AA inexistent field with flags = r", () => {
                let a1 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(1) },
                    { name: new BrsString("name"), value: new BrsString("Carol") },
                ]);
                let a3 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(3) },
                    { name: new BrsString("name"), value: new BrsString("Betty") },
                ]);
                let a2 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(2) },
                    { name: new BrsString("name"), value: new BrsString("anne") },
                ]);
                let a = new BrsString("a");
                let b = new BrsString("B");
                let ar = new RoArray([]);
                let i2 = new Int32(2);
                let i1 = new Int32(1);
                let src = new RoArray([a3, a1, a2, a, b, ar, i2, i1]);

                let sortBy = src.getMethod("sortBy");
                expect(sortBy).toBeTruthy();
                expect(sortBy.call(interpreter, new BrsString("xyz"), new BrsString("r"))).toBe(
                    BrsInvalid.Instance
                );
                expect(src.elements).toEqual([ar, a2, a1, a3, b, a, i1, i2]);
            });

            it("sorts the array based on AA valid field with invalid flags", () => {
                let a1 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(1) },
                    { name: new BrsString("name"), value: new BrsString("Carol") },
                ]);
                let a3 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(3) },
                    { name: new BrsString("name"), value: new BrsString("Betty") },
                ]);
                let a2 = new RoAssociativeArray([
                    { name: new BrsString("id"), value: new Int32(2) },
                    { name: new BrsString("name"), value: new BrsString("anne") },
                ]);
                let a = new BrsString("a");
                let b = new BrsString("B");
                let ar = new RoArray([]);
                let i2 = new Int32(2);
                let i1 = new Int32(1);
                let src = new RoArray([a1, a3, a2, a, b, ar, i2, i1]);

                let sortBy = src.getMethod("sortBy");
                expect(sortBy).toBeTruthy();
                expect(sortBy.call(interpreter, new BrsString("id"), new BrsString("ia"))).toBe(
                    BrsInvalid.Instance
                );
                expect(src.elements).toEqual([a1, a3, a2, a, b, ar, i2, i1]);
            });
        });

        describe("reverse", () => {
            it("reverts the sequence of array elements", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");
                let i1 = new Int32(1);
                let d = new BrsString("d");
                let e = new BrsString("e");
                let src = new RoArray([a, b, c, i1, d, e]);

                let reverse = src.getMethod("reverse");
                expect(reverse).toBeTruthy();
                expect(reverse.call(interpreter)).toBe(BrsInvalid.Instance);
                expect(src.elements).toEqual([e, d, i1, c, b, a]);
            });
        });
    });
});
