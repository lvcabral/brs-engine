const brs = require("../../../lib");
const { RoList, BrsBoolean, BrsString, Int32, BrsInvalid, Float } = brs.types;
const { Interpreter } = require("../../../lib/interpreter");
const { createMockStreams } = require("../../e2e/E2ETests");

describe("RoList", () => {
    describe("comparisons", () => {
        it("is equal to nothing", () => {
            let a = new RoList([]);
            expect(a.equalTo(a)).toBe(BrsBoolean.False);
        });
    });

    describe("stringification", () => {
        it("lists all primitive values", () => {
            let list = new RoList([
                new RoList([new BrsString("I shouldn't appear")]),
                BrsBoolean.True,
                new BrsString("a string"),
                new Int32(-1),
                BrsInvalid.Instance,
            ]);
            expect(list.toString()).toEqual(
                `<Component: roList> =
(
    <Component: roList>
    true
    "a string"
    -1
    invalid
)`
            );
        });
    });

    describe("get", () => {
        it("returns values from in-bounds indexes", () => {
            let a = new BrsString("a");
            let b = new BrsString("b");
            let c = new BrsString("c");

            let list = new RoList([a, b, c]);

            expect(list.get(new Int32(0))).toBe(a);
            expect(list.get(new Int32(2))).toBe(c);
        });

        it("returns invalid for out-of-bounds indexes", () => {
            let list = new RoList([]);

            expect(list.get(new Int32(555))).toBe(BrsInvalid.Instance);
        });
    });

    describe("set", () => {
        it("sets values at in-bounds indexes", () => {
            let a = new BrsString("a");
            let b = new BrsString("b");
            let c = new BrsString("c");

            let list = new RoList([a, b, c]);

            list.set(new Int32(0), new BrsString("replacement for a"));
            list.set(new Int32(2), new BrsString("replacement for c"));

            expect(list.get(new Int32(0))).toEqual(new BrsString("replacement for a"));
            expect(list.get(new Int32(2))).toEqual(new BrsString("replacement for c"));
        });

        it("sets values at out-of-bounds indexes", () => {
            let list = new RoList([]);

            list.set(new Int32(555), new BrsString("value set at index 555"));
            expect(list.get(new Int32(555))).toEqual(new BrsString("value set at index 555"));
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

                let list = new RoList([a, b, c]);

                let peek = list.getMethod("peek");
                expect(peek).toBeTruthy();
                expect(peek.call(interpreter)).toBe(c);
            });

            it("returns `invalid` when empty", () => {
                let list = new RoList([]);

                let peek = list.getMethod("peek");
                expect(peek).toBeTruthy();
                expect(peek.call(interpreter)).toBe(BrsInvalid.Instance);
            });
        });

        describe("pop", () => {
            it("returns and removes the value at the highest index", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let list = new RoList([a, b, c]);

                let pop = list.getMethod("pop");
                expect(pop).toBeTruthy();
                expect(pop.call(interpreter)).toBe(c);
                expect(list.elements).toEqual([a, b]);
            });

            it("returns `invalid` and doesn't modify when empty", () => {
                let list = new RoList([]);

                let pop = list.getMethod("pop");
                expect(pop).toBeTruthy();

                let before = list.getElements();
                expect(pop.call(interpreter)).toBe(BrsInvalid.Instance);
                expect(list.getElements()).toEqual(before);
            });
        });

        describe("push", () => {
            it("appends a value to the end of the array", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let list = new RoList([a, b]);

                let push = list.getMethod("push");
                expect(push).toBeTruthy();
                expect(push.call(interpreter, c)).toBe(BrsInvalid.Instance);
                expect(list.elements).toEqual([a, b, c]);
            });
        });

        describe("shift", () => {
            it("returns and removes the value at the lowest index", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let list = new RoList([a, b, c]);

                let shift = list.getMethod("shift");
                expect(shift).toBeTruthy();
                expect(shift.call(interpreter)).toBe(a);
                expect(list.elements).toEqual([b, c]);
            });

            it("returns `invalid` and doesn't modify when empty", () => {
                let list = new RoList([]);

                let shift = list.getMethod("shift");
                expect(shift).toBeTruthy();

                let before = list.getElements();
                expect(shift.call(interpreter)).toBe(BrsInvalid.Instance);
                expect(list.getElements()).toEqual(before);
            });
        });

        describe("unshift", () => {
            it("inserts a value at the beginning of the array", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let list = new RoList([b, c]);

                let unshift = list.getMethod("unshift");
                expect(unshift).toBeTruthy();
                expect(unshift.call(interpreter, a)).toBe(BrsInvalid.Instance);
                expect(list.elements).toEqual([a, b, c]);
            });
        });

        describe("delete", () => {
            it("removes elements from in-bounds indices", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let list = new RoList([a, b, c]);

                let deleteMethod = list.getMethod("delete");
                expect(deleteMethod).toBeTruthy();
                expect(deleteMethod.call(interpreter, new Int32(1))).toBe(BrsBoolean.True);
                expect(list.elements).toEqual([a, c]);
            });

            it("doesn't remove elements from out-of-bounds indices", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let list = new RoList([a, b, c]);

                let deleteMethod = list.getMethod("delete");
                expect(deleteMethod).toBeTruthy();
                expect(deleteMethod.call(interpreter, new Int32(1111))).toBe(BrsBoolean.False);
                expect(deleteMethod.call(interpreter, new Int32(-1))).toBe(BrsBoolean.False);
                expect(list.elements).toEqual([a, b, c]);
            });
        });

        describe("count", () => {
            it("returns the length of the array", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let list = new RoList([a, b, c]);

                let count = list.getMethod("count");
                expect(count).toBeTruthy();
                expect(count.call(interpreter)).toEqual(new Int32(3));
            });
        });

        describe("clear", () => {
            it("empties the array", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let list = new RoList([a, b]);

                let clear = list.getMethod("clear");
                expect(clear).toBeTruthy();
                expect(clear.call(interpreter)).toBe(BrsInvalid.Instance);
                expect(list.elements).toEqual([]);
            });
        });

        describe("append", () => {
            it("adds non-empty elements to the current array", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let src = new RoList([a, b]);

                let c = new BrsString("c");
                let d = new BrsString("d");
                let e = new BrsString("e");
                let f = new BrsString("f");
                let other = new RoList([c, undefined, d, undefined, undefined, e, f, undefined]);

                let append = src.getMethod("append");
                expect(append).toBeTruthy();
                expect(append.call(interpreter, other)).toBe(BrsInvalid.Instance);
                expect(src.elements).toEqual([a, b, c, d, e, f]);
            });
        });

        describe("ifList", () => {
            it("addHead() - adds a value to the beginning of the list", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let list = new RoList([b, c]);

                let addHead = list.getMethod("addHead");
                expect(addHead).toBeTruthy();
                expect(addHead.call(interpreter, a)).toBe(BrsInvalid.Instance);
                expect(list.elements).toEqual([a, b, c]);
            });
            it("addTail() - adds a value to the end of the list", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let list = new RoList([a, b]);

                let addTail = list.getMethod("addTail");
                expect(addTail).toBeTruthy();
                expect(addTail.call(interpreter, c)).toBe(BrsInvalid.Instance);
                expect(list.elements).toEqual([a, b, c]);
            });
            it("getHead() - returns the first element of the list", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");
                let list = new RoList([a, b, c]);
                let getHead = list.getMethod("getHead");
                expect(getHead).toBeTruthy();
                expect(getHead.call(interpreter)).toBe(a);
            });
            it("getTail() - returns the last element of the list", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");
                let list = new RoList([a, b, c]);
                let getTail = list.getMethod("getTail");
                expect(getTail).toBeTruthy();
                expect(getTail.call(interpreter)).toBe(c);
            });
            it("removeHead() - removes the first element of the list", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");
                let list = new RoList([a, b, c]);
                let removeHead = list.getMethod("removeHead");
                expect(removeHead).toBeTruthy();
                expect(removeHead.call(interpreter)).toBe(a);
                expect(list.elements).toEqual([b, c]);
            });
            it("removeTail() - removes the last element of the list", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");
                let list = new RoList([a, b, c]);
                let removeTail = list.getMethod("removeTail");
                expect(removeTail).toBeTruthy();
                expect(removeTail.call(interpreter)).toBe(c);
                expect(list.elements).toEqual([a, b]);
            });
            it("getIndex() - returns invalid when the index was not reset yet", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");
                let list = new RoList([a, b, c]);
                let getIndex = list.getMethod("getIndex");
                expect(getIndex).toBeTruthy();
                expect(getIndex.call(interpreter)).toBe(BrsInvalid.Instance);
            });
            if (
                ("resetIndex() - resets the current index of the linked list and get first item",
                () => {
                    let a = new BrsString("a");
                    let b = new BrsString("b");
                    let c = new BrsString("c");
                    let list = new RoList([a, b, c]);
                    let resetIndex = list.getMethod("resetIndex");
                    expect(resetIndex).toBeTruthy();
                    expect(resetIndex.call(interpreter)).toEqual(BrsBoolean.True);
                    let getIndex = list.getMethod("getIndex");
                    expect(getIndex).toBeTruthy();
                    expect(getIndex.call(interpreter)).toEqual(a);
                })
            );
            if (
                ("removeIndex() - removes the current index of the linked list",
                () => {
                    let a = new BrsString("a");
                    let b = new BrsString("b");
                    let c = new BrsString("c");
                    let list = new RoList([a, b, c]);
                    let resetIndex = list.getMethod("resetIndex");
                    expect(resetIndex).toBeTruthy();
                    expect(resetIndex.call(interpreter)).toEqual(BrsBoolean.True);
                    let removeIndex = list.getMethod("removeIndex");
                    expect(removeIndex).toBeTruthy();
                    expect(removeIndex.call(interpreter)).toEqual(a);
                })
            );
        });
    });
});
