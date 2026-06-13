const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Int32, Float, RoArray, RoAssociativeArray } = core;

/** Minimal interpreter accepted by renderNode → renderChildren (never dereferenced when draw2D is absent). */
const fakeInterpreter = {};

/** Builds a root ContentNode with `count` child item ContentNodes (each with a title). */
function buildContent(count) {
    const root = SGNodeFactory.createNode("ContentNode");
    for (let i = 0; i < count; i++) {
        const item = SGNodeFactory.createNode("ContentNode");
        item.setValue("title", new BrsString(`item ${i}`));
        root.appendChildToParent(item);
    }
    return root;
}

/** Builds a TargetSet with `count` stacked rectangles and an optional focusIndex. */
function buildTargetSet(count, focusIndex) {
    const set = SGNodeFactory.createNode("TargetSet");
    const rects = [];
    for (let i = 0; i < count; i++) {
        rects.push(new RoArray([new Float(0), new Float(i * 100), new Float(200), new Float(100)]));
    }
    set.setValue("targetRects", new RoArray(rects));
    if (focusIndex !== undefined) {
        set.setValue("focusIndex", new Int32(focusIndex));
    }
    return set;
}

describe("Target nodes (TargetSet, TargetGroup, TargetList)", () => {
    beforeAll(() => {
        // TargetGroup item components resolve fonts/bitmaps from the common: volume; mount it once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    describe("factory wiring", () => {
        test.each([
            ["TargetSet", "TargetSet"],
            ["TargetGroup", "TargetGroup"],
            ["TargetList", "TargetList"],
        ])("creates %s as its own subtype (not a fallback Node/Group)", (type, expected) => {
            const node = SGNodeFactory.createNode(type);
            expect(node).toBeDefined();
            expect(node.constructor.name).toBe(expected);
            expect(node.nodeSubtype).toBe(expected);
        });
    });

    describe("TargetSet", () => {
        test("exposes the documented default fields, types and values", () => {
            const set = SGNodeFactory.createNode("TargetSet");
            const fields = set.getNodeFields();
            // The engine collapses rect2darray/nodearray to the generic "array" FieldKind.
            const expected = [
                ["targetRects", "array", []],
                ["focusIndex", "integer", -1],
                ["color", "color", 0xffffff80 | 0],
            ];
            for (const [name, type, value] of expected) {
                const field = fields.get(name.toLowerCase());
                expect(field).toBeDefined();
                expect(field.getType()).toBe(type);
                expect(set.getValueJS(name)).toEqual(value);
            }
        });

        test("getTargetRects normalizes the four-number-array rectangle format", () => {
            const set = buildTargetSet(2);
            expect(set.getTargetRects()).toEqual([
                { x: 0, y: 0, width: 200, height: 100 },
                { x: 0, y: 100, width: 200, height: 100 },
            ]);
        });

        test("getTargetRects normalizes the associative-array rectangle format", () => {
            const set = SGNodeFactory.createNode("TargetSet");
            const aa = new RoAssociativeArray([
                { name: new BrsString("x"), value: new Float(10) },
                { name: new BrsString("y"), value: new Float(5) },
                { name: new BrsString("width"), value: new Float(200) },
                { name: new BrsString("height"), value: new Float(150) },
            ]);
            set.setValue("targetRects", new RoArray([aa]));
            expect(set.getTargetRects()).toEqual([{ x: 10, y: 5, width: 200, height: 150 }]);
        });
    });

    describe("TargetGroup", () => {
        test("exposes the documented default fields, types and values", () => {
            const group = SGNodeFactory.createNode("TargetGroup");
            const fields = group.getNodeFields();
            const expected = [
                ["itemComponentName", "string", ""],
                ["defaultTargetSetFocusIndex", "integer", 0],
                ["wrap", "boolean", false],
                ["duration", "time", 0.3],
                ["showTargetRects", "boolean", false],
                ["currFocusItemIndex", "float", -1],
                ["jumpToItem", "integer", 0],
                ["animateToItem", "integer", 0],
                ["easeFunction", "string", "inOutCubic"],
                ["advancing", "boolean", false],
                ["reversing", "boolean", false],
            ];
            for (const [name, type, value] of expected) {
                const field = fields.get(name.toLowerCase());
                expect(field).toBeDefined();
                expect(field.getType()).toBe(type);
                expect(group.getValueJS(name)).toEqual(value);
            }
        });

        test("extends Group (inherits Group fields)", () => {
            const group = SGNodeFactory.createNode("TargetGroup");
            const fields = group.getNodeFields();
            for (const field of ["translation", "opacity", "visible", "content", "targetset"]) {
                expect(fields.get(field)).toBeDefined();
            }
        });

        test("setting content populates items and focuses item 0", () => {
            const group = SGNodeFactory.createNode("TargetGroup");
            group.setValue("content", buildContent(5));
            expect(group.getValueJS("itemFocused")).toBe(0);
            expect(group.getValueJS("currFocusItemIndex")).toBe(0);
        });

        test("jumpToItem moves focus (snap) and updates focus fields", () => {
            const group = SGNodeFactory.createNode("TargetGroup");
            group.setValue("content", buildContent(5));
            group.setValue("jumpToItem", new Int32(3));
            expect(group.getValueJS("itemFocused")).toBe(3);
            expect(group.getValueJS("currFocusItemIndex")).toBe(3);
            expect(group.getValueJS("itemUnfocused")).toBe(0);
        });

        test("animateToItem behaves like jumpToItem in the functional version", () => {
            const group = SGNodeFactory.createNode("TargetGroup");
            group.setValue("content", buildContent(5));
            group.setValue("animateToItem", new Int32(2));
            expect(group.getValueJS("itemFocused")).toBe(2);
            expect(group.getValueJS("currFocusItemIndex")).toBe(2);
        });

        test("jumpToItem out of range is ignored without wrap", () => {
            const group = SGNodeFactory.createNode("TargetGroup");
            group.setValue("content", buildContent(3));
            group.setValue("jumpToItem", new Int32(99));
            expect(group.getValueJS("itemFocused")).toBe(0);
        });

        test("setting targetSet mirrors into the read-only currTargetSet", () => {
            const group = SGNodeFactory.createNode("TargetGroup");
            const set = buildTargetSet(3, 1);
            group.setValue("targetSet", set);
            expect(group.getValue("currTargetSet")).toBe(set);
        });

        test("renderNode with content + targetSet does not throw (draw2D absent)", () => {
            const group = SGNodeFactory.createNode("TargetGroup");
            group.setValue("targetSet", buildTargetSet(5, 2));
            group.setValue("content", buildContent(5));
            expect(() => group.renderNode(fakeInterpreter, [0, 0], 0, 1)).not.toThrow();
        });
    });

    describe("TargetList", () => {
        test("exposes the documented default fields, types and values", () => {
            const list = SGNodeFactory.createNode("TargetList");
            const fields = list.getNodeFields();
            // nodearray collapses to the generic "array" FieldKind in the engine.
            const expected = [
                ["focusedTargetSet", "array", []],
                ["advanceKey", "string", "down"],
                ["reverseKey", "string", "up"],
            ];
            for (const [name, type, value] of expected) {
                const field = fields.get(name.toLowerCase());
                expect(field).toBeDefined();
                expect(field.getType()).toBe(type);
                expect(list.getValueJS(name)).toEqual(value);
            }
        });

        test("extends TargetGroup (inherits TargetGroup + Group fields)", () => {
            const list = SGNodeFactory.createNode("TargetList");
            const fields = list.getNodeFields();
            for (const field of ["targetset", "content", "jumptoitem", "translation", "visible"]) {
                expect(fields.get(field)).toBeDefined();
            }
        });

        test("advanceKey advances focus, reverseKey reverses it", () => {
            const list = SGNodeFactory.createNode("TargetList");
            list.setValue("content", buildContent(5));
            expect(list.handleKey("down", true)).toBe(true);
            expect(list.getValueJS("itemFocused")).toBe(1);
            expect(list.handleKey("up", true)).toBe(true);
            expect(list.getValueJS("itemFocused")).toBe(0);
        });

        test("reverse past the start is not handled without wrap", () => {
            const list = SGNodeFactory.createNode("TargetList");
            list.setValue("content", buildContent(5));
            expect(list.handleKey("up", true)).toBe(false);
            expect(list.getValueJS("itemFocused")).toBe(0);
        });

        test("custom advance/reverse keys are honored", () => {
            const list = SGNodeFactory.createNode("TargetList");
            list.setValue("content", buildContent(5));
            list.setValue("advanceKey", new BrsString("right"));
            list.setValue("reverseKey", new BrsString("left"));
            expect(list.handleKey("right", true)).toBe(true);
            expect(list.getValueJS("itemFocused")).toBe(1);
        });

        test("wrap allows advancing past the end back to the start", () => {
            const list = SGNodeFactory.createNode("TargetList");
            list.setValue("wrap", core.BrsBoolean.True);
            list.setValue("content", buildContent(3));
            list.setValue("jumpToItem", new Int32(2));
            expect(list.handleKey("down", true)).toBe(true);
            expect(list.getValueJS("itemFocused")).toBe(0);
        });

        test("accepts a single TargetSet assigned to the focusedTargetSet array field", () => {
            const list = SGNodeFactory.createNode("TargetList");
            const focused = buildTargetSet(7, 6);
            list.setValue("focusedTargetSet", focused);
            const stored = list.getValue("focusedTargetSet");
            expect(stored).toBeInstanceOf(RoArray);
            expect(stored.getElements()[0]).toBe(focused);
        });

        // Reproduces the two-row "fixed focus" example: focus moving between sibling TargetLists must
        // swap each row's active targetSet (the engine rewrites the focus chain rather than calling
        // setNodeFocus(false) on the row losing focus, so the swap is detected at render time).
        test("swaps focused/unfocused target sets as focus moves between rows", () => {
            const focused = buildTargetSet(7, 6);
            const unfocused = buildTargetSet(7, 6);

            const list1 = SGNodeFactory.createNode("TargetList");
            const list2 = SGNodeFactory.createNode("TargetList");
            for (const list of [list1, list2]) {
                list.setValue("focusedTargetSet", focused);
                list.setValue("unfocusedTargetSet", unfocused);
                list.setValue("content", buildContent(10));
            }
            list1.setValue("targetSet", focused);
            list2.setValue("targetSet", unfocused);

            // List 1 starts focused.
            sgRoot.setFocused(list1);
            list1.renderNode(fakeInterpreter, [0, 0], 0, 1);
            list2.renderNode(fakeInterpreter, [0, 0], 0, 1);
            expect(list1.getValue("targetSet")).toBe(focused);
            expect(list2.getValue("targetSet")).toBe(unfocused);

            // Focus moves to list 2: list 1 must shrink (unfocused), list 2 must grow (focused).
            sgRoot.setFocused(list2);
            list1.renderNode(fakeInterpreter, [0, 0], 0, 1);
            list2.renderNode(fakeInterpreter, [0, 0], 0, 1);
            expect(list1.getValue("targetSet")).toBe(unfocused);
            expect(list2.getValue("targetSet")).toBe(focused);
        });
    });
});
