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
    Uninitialized,
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
    change: <UNINITIALIZED>
    focusable: false
    focusedchild: invalid
    id: 
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

        it("overwrites values with existing keys if they are the same type", () => {
            let node = new RoSGNode([{ name: new BrsString("foo"), value: new Int32(-99) }]);

            node.set(new BrsString("foo"), new Int32(66));

            expect(node.get(new BrsString("foo"))).toEqual(new Int32(66));
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
                expect(node.getFields()).toEqual(new Map());
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
                expect(deleteCall.call(interpreter, new BrsString("baz"))).toBe(BrsBoolean.True);
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
                expect(result).toEqual(new Int32(6));
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
                let change = new BrsString("change");
                let focusable = new BrsString("focusable");
                let focusedChild = new BrsString("focusedchild");
                let id = new BrsString("id");
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
                expect(result.getElements()).toEqual([
                    change,
                    cletter,
                    focusable,
                    focusedChild,
                    id,
                    letter1,
                    letter2,
                ]);
            });

            it("returns an empty array from an empty associative array", () => {
                let change = new BrsString("change");
                let focusable = new BrsString("focusable");
                let focusedChild = new BrsString("focusedchild");
                let id = new BrsString("id");

                let node = new RoSGNode([]);

                let keys = node.getMethod("keys");
                expect(keys).toBeTruthy();

                let result = keys.call(interpreter);
                expect(result.getElements()).toEqual([change, focusable, focusedChild, id]);
            });
        });

        describe("items", () => {
            it("returns an array of values from the associative array in lexicographical order", () => {
                let change = BrsBoolean.False;
                let focusable = BrsInvalid.Instance;
                let focusedChild = Uninitialized.Instance;
                let id = new BrsString("");
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
                expect(result.getElements()).toEqual([
                    id,
                    focusedChild,
                    letter1,
                    letter2,
                    cletter,
                    change,
                    focusable,
                ]);
            });

            it("returns an empty array from an empty associative array", () => {
                let change = BrsBoolean.False;
                let focusable = BrsInvalid.Instance;
                let focusedChild = Uninitialized.Instance;
                let id = new BrsString("");

                let node = new RoSGNode([]);

                let items = node.getMethod("items");
                expect(items).toBeTruthy();

                let result = items.call(interpreter);
                expect(result.getElements()).toEqual([id, focusedChild, change, focusable]);
            });
        });
    });

    describe("ifSGNodeField", () => {
        let interpreter;

        beforeEach(() => {
            interpreter = new Interpreter();
        });

        describe("addfield", () => {
            it("adds a field to the object", () => {
                let node = new RoSGNode([]);

                let addField = node.getMethod("addfield");
                expect(addField).toBeTruthy();

                let result = addField.call(
                    interpreter,
                    new BrsString("field1"),
                    new BrsString("string"),
                    BrsBoolean.True
                );
                expect(result).toEqual(BrsBoolean.True);
                expect(node.getFields().size).toEqual(5);
            });

            it("doesn't add the field if the type is not valid", () => {
                let node = new RoSGNode([]);

                let addField = node.getMethod("addfield");

                let result = addField.call(
                    interpreter,
                    new BrsString("field1"),
                    new BrsString("not-valid-type"),
                    BrsBoolean.True
                );
                expect(result).toEqual(BrsBoolean.True); //Brightscript interpreter returns true here
                expect(node.getFields().size).toEqual(4);
            });
        });

        describe("addfields", () => {
            it("adds multiple fields to the node", () => {
                let node = new RoSGNode([]);
                let fields = new RoAssociativeArray([
                    { name: new BrsString("associative-array"), value: new RoAssociativeArray([]) },
                    { name: new BrsString("node"), value: new RoSGNode([]) },
                    { name: new BrsString("boolean"), value: BrsBoolean.True },
                    { name: new BrsString("string"), value: new BrsString("a string") },
                    { name: new BrsString("number"), value: new Int32(-1) },
                    { name: new BrsString("invalid"), value: BrsInvalid.Instance },
                ]);

                let addFields = node.getMethod("addfields");
                expect(addFields).toBeTruthy();

                let result = addFields.call(interpreter, fields);
                expect(result).toEqual(BrsBoolean.True);
                expect(node.getFields().size).toEqual(10);
            });

            it("doesn't add duplicated fields", () => {
                let node = new RoSGNode([]);
                let fields = new RoAssociativeArray([
                    { name: new BrsString("field1"), value: new BrsString("a string") },
                    { name: new BrsString("field2"), value: new Int32(-1) },
                ]);

                let addFields = node.getMethod("addfields");
                let result = addFields.call(interpreter, fields);
                expect(result).toEqual(BrsBoolean.True);
                expect(node.getFields().size).toEqual(6);

                let moreFields = new RoAssociativeArray([
                    { name: new BrsString("field1"), value: new BrsString("my string") },
                    { name: new BrsString("field2"), value: new Int32(-10) },
                    { name: new BrsString("field3"), value: BrsInvalid.Instance },
                ]);
                result = addFields.call(interpreter, moreFields);
                expect(result).toEqual(BrsBoolean.True);
                expect(node.getFields().size).toEqual(7); //Only adds the non duplicated
            });

            it("only adds fields if passed as an associative array", () => {
                let node = new RoSGNode([]);
                let fields = "non associative array";

                let addFields = node.getMethod("addfields");

                let result = addFields.call(interpreter, fields);
                expect(result).toEqual(BrsBoolean.False);
                expect(node.getFields().size).toEqual(4);
            });
        });

        describe("getfield", () => {
            it("gets an non-existing field from node", () => {
                let node = new RoSGNode([]);

                let getField = node.getMethod("getfield");
                expect(getField).toBeTruthy();

                let result = getField.call(interpreter, new BrsString("field1"));
                expect(result).toEqual(BrsInvalid.Instance);
            });

            it("gets the value of a defined field", () => {
                let node = new RoSGNode([]);

                let addField = node.getMethod("addfield");
                addField.call(
                    interpreter,
                    new BrsString("field1"),
                    new BrsString("string"),
                    BrsBoolean.True
                );

                let getField = node.getMethod("getfield");
                let result = getField.call(interpreter, new BrsString("field1"));
                expect(result).toEqual(new BrsString(""));
                expect(node.get(new BrsString("field1"))).toEqual(new BrsString(""));
            });
        });

        describe("observefield", () => {
            it("adds an observer", () => {
                let node = new RoSGNode([
                    { name: new BrsString("foo"), value: new Int32(-99) },
                    { name: new BrsString("bar"), value: new BrsString("hello") },
                ]);

                let observeField = node.getMethod("observefield");
                expect(observeField).toBeTruthy();

                let result = observeField.call(
                    interpreter,
                    new BrsString("foo"),
                    new BrsString("callMePlease")
                );
                expect(result).toEqual(BrsBoolean.True);
            });
        });

        describe("removefield", () => {
            it("removes a field from the node", () => {
                let node = new RoSGNode([]);

                let addField = node.getMethod("addfield");
                let removeField = node.getMethod("removefield");
                expect(removeField).toBeTruthy();

                let result = addField.call(
                    interpreter,
                    new BrsString("field1"),
                    new BrsString("string"),
                    BrsBoolean.False
                );
                expect(result).toEqual(BrsBoolean.True);
                expect(node.getFields().size).toEqual(5);

                result = removeField.call(interpreter, new BrsString("field1"));
                expect(result).toEqual(BrsBoolean.True);
                expect(node.getFields().size).toEqual(4);
            });

            it("doesn't remove a non existing field", () => {
                let node = new RoSGNode([]);

                let addField = node.getMethod("addfield");
                let removeField = node.getMethod("removefield");

                let result = addField.call(
                    interpreter,
                    new BrsString("field1"),
                    new BrsString("string"),
                    BrsBoolean.False
                );
                expect(result).toEqual(BrsBoolean.True);
                expect(node.getFields().size).toEqual(5);

                result = removeField.call(interpreter, new BrsString("field2"));
                expect(result).toEqual(BrsBoolean.True);
                expect(node.getFields().size).toEqual(5);
            });

            it("removes a field defined as invalid", () => {
                let node = new RoSGNode([
                    { name: new BrsString("useless"), value: BrsInvalid.Instance },
                ]);

                let removeField = node.getMethod("removefield");

                result = removeField.call(interpreter, new BrsString("useless"));
                expect(result).toEqual(BrsBoolean.True);
                expect(node.getFields().size).toEqual(4);
            });
        });

        describe("setfield", () => {
            it("updates the value of an existing field", () => {
                let node = new RoSGNode([]);
                const strVal = "value updated";

                let addField = node.getMethod("addfield");
                let setField = node.getMethod("setfield");
                let getField = node.getMethod("getfield");
                expect(setField).toBeTruthy();

                let result = addField.call(
                    interpreter,
                    new BrsString("field1"),
                    new BrsString("string"),
                    BrsBoolean.False
                );
                expect(result).toEqual(BrsBoolean.True);
                result = setField.call(interpreter, new BrsString("field1"), new BrsString(strVal));
                expect(result).toEqual(BrsBoolean.True);
                result = getField.call(interpreter, new BrsString("field1"));
                expect(result.value).toEqual(strVal);
            });

            it("doesn't update the value of a field if not the same type", () => {
                let node = new RoSGNode([]);

                let addField = node.getMethod("addfield");
                let setField = node.getMethod("setfield");

                let result = addField.call(
                    interpreter,
                    new BrsString("field1"),
                    new BrsString("integer"),
                    BrsBoolean.False
                );
                expect(result).toEqual(BrsBoolean.True);
                result = setField.call(
                    interpreter,
                    new BrsString("field1"),
                    new BrsString("new value")
                );
                expect(result).toEqual(BrsBoolean.False);
            });

            it("doesn't update the value of a non existing field", () => {
                let node = new RoSGNode([]);

                let setField = node.getMethod("setfield");
                let result = setField.call(interpreter, new BrsString("field1"), new Int32(999));
                expect(result).toEqual(BrsBoolean.False);
                expect(node.getFields().size).toEqual(4);
            });
        });

        describe("setfields", () => {
            it("updates the value of existing fields", () => {
                let node = new RoSGNode([]);
                const strVal = "updated string";
                const intVal = 666;
                let initialFields = new RoAssociativeArray([
                    { name: new BrsString("field1"), value: new BrsString("a string") },
                    { name: new BrsString("field2"), value: new Int32(-1) },
                    { name: new BrsString("field3"), value: BrsBoolean.False },
                ]);

                let addFields = node.getMethod("addfields");
                let setFields = node.getMethod("setfields");
                let getField = node.getMethod("getfield");
                expect(setFields).toBeTruthy();

                let result = addFields.call(interpreter, initialFields);
                expect(result).toEqual(BrsBoolean.True);

                let updatedFields = new RoAssociativeArray([
                    { name: new BrsString("field1"), value: new BrsString(strVal) },
                    { name: new BrsString("field2"), value: new Int32(intVal) },
                ]);

                result = setFields.call(interpreter, updatedFields);
                expect(result).toEqual(BrsBoolean.True);
                expect(node.getFields().size).toEqual(7);

                result = getField.call(interpreter, new BrsString("field1"));
                expect(result.value).toEqual(strVal);

                result = getField.call(interpreter, new BrsString("field2"));
                expect(result.value).toEqual(intVal);
            });

            it("doesn't update the value of existing fields if types don't match", () => {
                let node = new RoSGNode([]);
                const strVal = "a string";
                const intVal = -1;
                let initialFields = new RoAssociativeArray([
                    { name: new BrsString("field1"), value: new BrsString(strVal) },
                    { name: new BrsString("field2"), value: new Int32(intVal) },
                ]);

                let addFields = node.getMethod("addfields");
                let setFields = node.getMethod("setfields");
                let getField = node.getMethod("getfield");

                let result = addFields.call(interpreter, initialFields);
                expect(result).toEqual(BrsBoolean.True);

                let updatedFields = new RoAssociativeArray([
                    { name: new BrsString("field1"), value: BrsInvalid.Instance },
                    { name: new BrsString("field2"), value: BrsBoolean.False },
                ]);

                result = setFields.call(interpreter, updatedFields);
                expect(result).toEqual(BrsBoolean.True);
                expect(node.getFields().size).toEqual(6);

                result = getField.call(interpreter, new BrsString("field1"));
                expect(result.value).toEqual(strVal);

                result = getField.call(interpreter, new BrsString("field2"));
                expect(result.value).toEqual(intVal);
            });
        });

        describe("update", () => {
            it("updates the value of existing fields", () => {
                let node = new RoSGNode([]);
                const strVal = "updated string";
                const intVal = 666;
                let initialFields = new RoAssociativeArray([
                    { name: new BrsString("field1"), value: new BrsString("a string") },
                    { name: new BrsString("field2"), value: new Int32(-1) },
                    { name: new BrsString("field3"), value: BrsBoolean.False },
                ]);

                let addFields = node.getMethod("addfields");
                let update = node.getMethod("update");
                let getField = node.getMethod("getfield");
                expect(update).toBeTruthy();

                let result = addFields.call(interpreter, initialFields);
                expect(result).toEqual(BrsBoolean.True);

                let updatedFields = new RoAssociativeArray([
                    { name: new BrsString("field1"), value: new BrsString(strVal) },
                    { name: new BrsString("field2"), value: new Int32(intVal) },
                ]);

                result = update.call(interpreter, updatedFields);
                expect(result).toEqual(Uninitialized.Instance);
                expect(node.getFields().size).toEqual(7);

                result = getField.call(interpreter, new BrsString("field1"));
                expect(result.value).toEqual(strVal);

                result = getField.call(interpreter, new BrsString("field2"));
                expect(result.value).toEqual(intVal);
            });

            it("doesn't update the value of existing fields if types don't match", () => {
                let node = new RoSGNode([]);
                const strVal = "a string";
                const intVal = -1;
                let initialFields = new RoAssociativeArray([
                    { name: new BrsString("field1"), value: new BrsString(strVal) },
                    { name: new BrsString("field2"), value: new Int32(intVal) },
                ]);

                let addFields = node.getMethod("addfields");
                let update = node.getMethod("update");
                let getField = node.getMethod("getfield");

                let result = addFields.call(interpreter, initialFields);
                expect(result).toEqual(BrsBoolean.True);

                let updatedFields = new RoAssociativeArray([
                    { name: new BrsString("field1"), value: BrsInvalid.Instance },
                    { name: new BrsString("field2"), value: BrsBoolean.False },
                ]);

                result = update.call(interpreter, updatedFields);
                expect(result).toEqual(Uninitialized.Instance);
                expect(node.getFields().size).toEqual(6);

                result = getField.call(interpreter, new BrsString("field1"));
                expect(result.value).toEqual(strVal);

                result = getField.call(interpreter, new BrsString("field2"));
                expect(result.value).toEqual(intVal);
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
