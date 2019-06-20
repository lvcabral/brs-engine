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

    describe("ifSGNodeChildren", () => {
        let interpreter, parent, child1, child2, child3, child4;

        beforeEach(() => {
            interpreter = new Interpreter();
            parent = new RoSGNode([{ name: new BrsString("parent"), value: new BrsString("1") }]);
            child1 = new RoSGNode([{ name: new BrsString("child"), value: new BrsString("2") }]);
            child2 = new RoSGNode([{ name: new BrsString("child"), value: new BrsString("3") }]);
            child3 = new RoSGNode([{ name: new BrsString("child"), value: new BrsString("4") }]);
            child4 = new RoSGNode([{ name: new BrsString("child"), value: new BrsString("5") }]);
        });

        describe("getchildcount", () => {
            it("returns the number of children", () => {
                let getChildCount = parent.getMethod("getchildcount");
                expect(getChildCount).toBeTruthy();

                let result = getChildCount.call(interpreter);
                expect(result).toEqual(new Int32(0));
            });
        });

        describe("appendchild", () => {
            it("appends a child to the node", () => {
                let appendChild = parent.getMethod("appendchild");
                let getChildCount = parent.getMethod("getchildcount");

                let result = appendChild.call(interpreter, child1);
                let childCount = getChildCount.call(interpreter);
                expect(result).toEqual(BrsBoolean.True);
                expect(appendChild).toBeTruthy();
                expect(childCount).toEqual(new Int32(1));
            });

            it("appends invalid to the node", () => {
                let invalidChild = BrsInvalid.Instance;

                let appendChild = parent.getMethod("appendchild");
                let getChildCount = parent.getMethod("getchildcount");

                let result = appendChild.call(interpreter, invalidChild);
                let childCount = getChildCount.call(interpreter);
                expect(result).toEqual(BrsBoolean.False);
                expect(childCount).toEqual(new Int32(0));
            });

            it("doesn't append the same node twice", () => {
                let appendChild = parent.getMethod("appendchild");
                let getChildCount = parent.getMethod("getchildcount");

                let result = appendChild.call(interpreter, child1);
                appendChild.call(interpreter, child1);
                let childCount = getChildCount.call(interpreter);
                expect(result).toEqual(BrsBoolean.True);
                expect(childCount).toEqual(new Int32(1));
            });
        });

        describe("getchildren", () => {
            it("get children of node without children", () => {
                let getChildren = parent.getMethod("getchildren");
                let getChildCount = parent.getMethod("getchildcount");

                let result = getChildren.call(interpreter, new Int32(-1), new Int32(0));
                let childCount = getChildCount.call(interpreter);
                expect(getChildren).toBeTruthy();
                expect(childCount).toEqual(new Int32(0));
                expect(result).toBeInstanceOf(RoArray);
                expect(result.elements).toEqual([]);
            });

            it("get all children of node with children", () => {
                let getChildren = parent.getMethod("getchildren");
                let getChildCount = parent.getMethod("getchildcount");
                let appendChild = parent.getMethod("appendchild");

                appendChild.call(interpreter, child1);
                appendChild.call(interpreter, child2);
                appendChild.call(interpreter, child3);

                let result = getChildren.call(interpreter, new Int32(-1), new Int32(0));
                let childCount = getChildCount.call(interpreter);
                expect(childCount).toEqual(new Int32(3));
                expect(result).toBeInstanceOf(RoArray);
                expect(result.elements).toEqual([child1, child2, child3]);
            });

            it("get last two children", () => {
                let getChildren = parent.getMethod("getchildren");
                let getChildCount = parent.getMethod("getchildcount");
                let appendChild = parent.getMethod("appendchild");

                appendChild.call(interpreter, child1);
                appendChild.call(interpreter, child2);
                appendChild.call(interpreter, child3);
                appendChild.call(interpreter, child4);

                // get last 2 children
                let result = getChildren.call(interpreter, new Int32(2), new Int32(2));
                let childCount = getChildCount.call(interpreter);
                expect(childCount).toEqual(new Int32(4));
                expect(result).toBeInstanceOf(RoArray);
                expect(result.elements).toEqual([child3, child4]);
            });

            it("pass in large child count", () => {
                let getChildren = parent.getMethod("getchildren");
                let getChildCount = parent.getMethod("getchildcount");
                let appendChild = parent.getMethod("appendchild");

                appendChild.call(interpreter, child1);
                appendChild.call(interpreter, child2);
                appendChild.call(interpreter, child3);
                appendChild.call(interpreter, child4);

                // pass in more children count than there are children, should just return 2 with offset of 2
                let result1 = getChildren.call(interpreter, new Int32(20), new Int32(2));
                expect(result1).toBeInstanceOf(RoArray);
                expect(result1.elements).toEqual([child3, child4]);
            });

            it("pass in negative indices", () => {
                let getChildren = parent.getMethod("getchildren");
                let getChildCount = parent.getMethod("getchildcount");
                let appendChild = parent.getMethod("appendchild");

                appendChild.call(interpreter, child1);
                appendChild.call(interpreter, child2);
                appendChild.call(interpreter, child3);
                appendChild.call(interpreter, child4);

                // pass in negative indices
                let result2 = getChildren.call(interpreter, new Int32(-10), new Int32(-50));
                expect(result2).toBeInstanceOf(RoArray);
                expect(result2.elements).toEqual([]);
            });

            it("pass in negative start index", () => {
                let getChildren = parent.getMethod("getchildren");
                let getChildCount = parent.getMethod("getchildcount");
                let appendChild = parent.getMethod("appendchild");

                appendChild.call(interpreter, child1);
                appendChild.call(interpreter, child2);
                appendChild.call(interpreter, child3);
                appendChild.call(interpreter, child4);

                // pass in just negative start index
                let result3 = getChildren.call(interpreter, new Int32(5), new Int32(-50));
                expect(result3).toBeInstanceOf(RoArray);
                expect(result3.elements).toEqual([]);
            });

            it("get first 3 children", () => {
                let getChildren = parent.getMethod("getchildren");
                let getChildCount = parent.getMethod("getchildcount");
                let appendChild = parent.getMethod("appendchild");

                appendChild.call(interpreter, child1);
                appendChild.call(interpreter, child2);
                appendChild.call(interpreter, child3);
                appendChild.call(interpreter, child4);

                // get first 3 children
                let result4 = getChildren.call(interpreter, new Int32(3), new Int32(0));
                expect(result4).toBeInstanceOf(RoArray);
                expect(result4.elements).toEqual([child1, child2, child3]);
            });
        });

        describe("removechild", () => {
            it("remove a child node from parent", () => {
                let removeChild = parent.getMethod("removechild");
                let getChildren = parent.getMethod("getchildren");
                let getChildCount = parent.getMethod("getchildcount");
                let appendChild = parent.getMethod("appendchild");
                expect(removeChild).toBeTruthy();

                appendChild.call(interpreter, child1);
                appendChild.call(interpreter, child2);
                appendChild.call(interpreter, child3);

                // remove child 2
                removeChild.call(interpreter, child2);
                let result = getChildren.call(interpreter, new Int32(-1), new Int32(0));
                let childCount = getChildCount.call(interpreter);
                expect(childCount).toEqual(new Int32(2));
                expect(result).toBeInstanceOf(RoArray);
                expect(result.elements).toEqual([child1, child3]);

                // remove child 3
                removeChild.call(interpreter, child3);
                let result1 = getChildren.call(interpreter, new Int32(-1), new Int32(0));
                let childCount1 = getChildCount.call(interpreter);
                expect(childCount1).toEqual(new Int32(1));
                expect(result1).toBeInstanceOf(RoArray);
                expect(result1.elements).toEqual([child1]);

                // remove child 1
                removeChild.call(interpreter, child1);
                let result2 = getChildren.call(interpreter, new Int32(-1), new Int32(0));
                let childCount2 = getChildCount.call(interpreter);
                expect(childCount2).toEqual(new Int32(0));
                expect(result2).toBeInstanceOf(RoArray);
                expect(result2.elements).toEqual([]);

                // try to remove child 1 again, but shouldn't do anything
                removeChild.call(interpreter, child1);
                let result3 = getChildren.call(interpreter, new Int32(-1), new Int32(0));
                let childCount3 = getChildCount.call(interpreter);
                expect(childCount3).toEqual(new Int32(0));
                expect(result3).toBeInstanceOf(RoArray);
                expect(result3.elements).toEqual([]);
            });

            it("remove non-node things from parent", () => {
                let removeChild = parent.getMethod("removechild");
                let getChildren = parent.getMethod("getchildren");
                let getChildCount = parent.getMethod("getchildcount");
                let appendChild = parent.getMethod("appendchild");

                appendChild.call(interpreter, child1);
                appendChild.call(interpreter, child2);
                appendChild.call(interpreter, child3);

                // only returns true if we are removing roSGNode type object
                let result = removeChild.call(interpreter, child1);
                expect(result).toEqual(BrsBoolean.True);
                let result1 = removeChild.call(interpreter, new BrsString("some string"));
                expect(result1).toEqual(BrsBoolean.False);
                let result2 = removeChild.call(interpreter, new Int32(5));
                expect(result2).toEqual(BrsBoolean.False);
                let childCount = getChildCount.call(interpreter);
                expect(childCount).toEqual(new Int32(2));
            });
        });

        describe("getparent", () => {
            it("get parent of node", () => {
                let parent = new RoSGNode([
                    { name: new BrsString("parent"), value: new BrsString("1") },
                ]);
                let child1 = new RoSGNode([
                    { name: new BrsString("child"), value: new BrsString("2") },
                ]);

                let getParent = child1.getMethod("getparent");
                let appendChild = parent.getMethod("appendchild");

                appendChild.call(interpreter, child1);
                let parentNode = getParent.call(interpreter);
                expect(getParent).toBeTruthy();
                expect(parentNode).toEqual(parent);
            });

            it("get parent of node without parent", () => {
                let parent = new RoSGNode([
                    { name: new BrsString("parent"), value: new BrsString("1") },
                ]);
                let child1 = new RoSGNode([
                    { name: new BrsString("child"), value: new BrsString("2") },
                ]);

                let getParent = child1.getMethod("getparent");
                let appendChild = parent.getMethod("appendchild");
                let removeChild = parent.getMethod("removechild");

                // node should start without a parent
                let parentNode = getParent.call(interpreter);
                expect(parentNode).toEqual(BrsInvalid.Instance);

                // appends a node as child
                appendChild.call(interpreter, child1);
                let parentNode1 = getParent.call(interpreter);
                expect(parentNode1).toEqual(parent);

                // remove parent from child again, should get invalid as parent
                removeChild.call(interpreter, child1);
                let parentNode2 = getParent.call(interpreter);
                expect(parentNode2).toEqual(BrsInvalid.Instance);
            });
        });

        describe("createchild", () => {
            it("create generic roSGNode as child", () => {
                let parent = new RoSGNode([
                    { name: new BrsString("parent"), value: new BrsString("1") },
                ]);

                let createChild = parent.getMethod("createchild");
                let getChildren = parent.getMethod("getchildren");

                let childNode = createChild.call(interpreter, new BrsString("Node"));
                let result = getChildren.call(interpreter, new Int32(-1), new Int32(0));
                expect(createChild).toBeTruthy();
                expect(result.elements[0]).toEqual(childNode);
            });
        });
    });
});
