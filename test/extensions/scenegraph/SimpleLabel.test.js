const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Int32 } = core;

/** Minimal interpreter accepted by renderNode → renderChildren (never dereferenced when draw2D is absent). */
const fakeInterpreter = {};

describe("SimpleLabel node", () => {
    beforeAll(() => {
        // SimpleLabel resolves its font from the common: volume; mount it once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    test("is wired into the factory as a SimpleLabel subtype", () => {
        const label = SGNodeFactory.createNode("SimpleLabel");
        expect(label).toBeDefined();
        expect(label.constructor.name).toBe("SimpleLabel");
        expect(label.nodeSubtype).toBe("SimpleLabel");
    });

    test("exposes the documented default fields, types and values", () => {
        const label = SGNodeFactory.createNode("SimpleLabel");
        const fields = label.getNodeFields();

        const expected = [
            ["text", "string", ""],
            ["color", "color", 0xddddddff | 0], // stored as a signed 32-bit int
            ["fontUri", "string", ""],
            ["fontSize", "integer", 0],
            ["horizOrigin", "string", "left"],
            ["vertOrigin", "string", "top"],
        ];
        for (const [name, type, value] of expected) {
            const field = fields.get(name.toLowerCase()); // the field map is keyed lowercase
            expect(field).toBeDefined();
            expect(field.getType()).toBe(type);
            expect(label.getValueJS(name)).toBe(value);
        }
    });

    test("extends Group (inherits Group fields)", () => {
        const label = SGNodeFactory.createNode("SimpleLabel");
        const fields = label.getNodeFields();
        for (const groupField of ["translation", "opacity", "visible", "rotation"]) {
            expect(fields.get(groupField.toLowerCase())).toBeDefined();
        }
    });

    test("round-trips field assignments", () => {
        const label = SGNodeFactory.createNode("SimpleLabel");
        label.setValue("text", new BrsString("Hello"));
        label.setValue("fontUri", new BrsString("font:LargeBoldSystemFont"));
        label.setValue("fontSize", new Int32(40));
        label.setValue("horizOrigin", new BrsString("center"));
        label.setValue("vertOrigin", new BrsString("baseline"));

        expect(label.getValueJS("text")).toBe("Hello");
        expect(label.getValueJS("fontUri")).toBe("font:LargeBoldSystemFont");
        expect(label.getValueJS("fontSize")).toBe(40);
        expect(label.getValueJS("horizOrigin")).toBe("center");
        expect(label.getValueJS("vertOrigin")).toBe("baseline");
    });

    test("measures non-empty text after a measure pass", () => {
        const label = SGNodeFactory.createNode("SimpleLabel");
        label.setValue("text", new BrsString("Measured"));
        const measured = label.getMeasured();
        expect(measured.width).toBeGreaterThan(0);
        expect(measured.height).toBeGreaterThan(0);
    });

    test("renders without a draw surface for every origin combination", () => {
        const label = SGNodeFactory.createNode("SimpleLabel");
        label.setValue("text", new BrsString("Origin"));
        for (const h of ["left", "center", "right"]) {
            for (const v of ["top", "center", "baseline", "bottom"]) {
                label.setValue("horizOrigin", new BrsString(h));
                label.setValue("vertOrigin", new BrsString(v));
                expect(() => label.renderNode(fakeInterpreter, [0, 0], 0, 1)).not.toThrow();
            }
        }
    });
});
