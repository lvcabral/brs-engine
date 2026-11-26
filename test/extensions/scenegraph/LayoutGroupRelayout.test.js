const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Float, RoArray, Interpreter } = core;

/**
 * A LayoutGroup re-lays out whenever its children change: on every child-list mutation (including a
 * replace or reorder that keeps the count), and when a child grows during a nested boundingRect()
 * query made while the group itself is rendering.
 */
describe("LayoutGroup re-layout", () => {
    let interpreter;

    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    function rect(id, height) {
        const node = SGNodeFactory.createNode("Rectangle");
        node.setValue("id", new BrsString(id));
        node.setValue("width", new Float(100));
        node.setValue("height", new Float(height));
        return node;
    }

    function buildGroup() {
        const scene = SGNodeFactory.createNode("Scene");
        const group = SGNodeFactory.createNode("LayoutGroup");
        group.setValue("layoutDirection", new BrsString("vert"));
        group.setValue("itemSpacings", new RoArray([new Float(10)]));
        const a = rect("a", 20);
        const b = rect("b", 30);
        const c = rect("c", 40);
        for (const child of [a, b, c]) {
            group.appendChildToParent(child);
        }
        scene.appendChildToParent(group);
        scene.layoutNode(interpreter, [0, 0], 0, 1);
        return { scene, group, a, b, c };
    }

    const y = (node) => node.getValueJS("translation")[1];

    test("lays out the initial children", () => {
        const { a, b, c } = buildGroup();
        expect([y(a), y(b), y(c)]).toEqual([0, 30, 70]);
    });

    test("replaceChild places the new child and shifts its siblings", () => {
        const { scene, group, b, c } = buildGroup();
        const replacement = rect("r", 50);
        expect(group.replaceChildAtIndex(replacement, 0)).toBe(true);
        scene.layoutNode(interpreter, [0, 0], 0, 1);
        expect([y(replacement), y(b), y(c)]).toEqual([0, 60, 100]);
    });

    test("insertChild moving an existing child re-orders the layout", () => {
        const { scene, group, a, b, c } = buildGroup();
        expect(group.insertChildAtIndex(c, 0)).toBe(true);
        scene.layoutNode(interpreter, [0, 0], 0, 1);
        expect([y(c), y(a), y(b)]).toEqual([0, 50, 80]);
    });

    test("removeChildrenAtIndex closes the gap", () => {
        const { scene, group, a, c } = buildGroup();
        expect(group.removeChildrenAtIndex(1, 1)).toBe(true);
        scene.layoutNode(interpreter, [0, 0], 0, 1);
        expect([y(a), y(c)]).toEqual([0, 30]);
    });

    test("a nested boundingRect() during the group's render re-lays out and keeps the outer pass count", () => {
        const { scene, group, b, c } = buildGroup();
        // b grows inside its own render, then queries the group mid-render, as a renderTracking
        // observer does.
        const originalRender = b.renderNode.bind(b);
        let nested;
        b.renderNode = (...args) => {
            originalRender(...args);
            if (nested === undefined) {
                b.setValue("height", new Float(60));
                nested = { ...group.getBoundingRect("local", interpreter) };
            }
        };
        group.setValue("itemSpacings", new RoArray([new Float(12)]));
        sgRoot.rendering = true;
        try {
            scene.layoutNode(interpreter, [0, 0], 0, 1);
        } finally {
            sgRoot.rendering = false;
        }
        expect(nested.height).toBe(20 + 12 + 60 + 12 + 40);
        expect([y(b), y(c)]).toEqual([32, 104]);
        expect(group.lastPassCount).toBe(1);
    });
});
