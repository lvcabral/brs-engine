const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, fromSGNode } = scenegraph;
const { BrsString, Int32, Float, Double, ValueKind } = core;

/**
 * Roku OS 15.3 documents that SceneGraph fields support Double values:
 *
 *     mynode.addField("largeDecimalNumber", "double", true)
 *
 * The engine already maps the "double" field type to FieldKind.Double and coerces
 * assigned numbers accordingly. These tests lock that behavior in: a double field
 * must store a Double (not a Float), preserving precision beyond the ~7 significant
 * digits a 32-bit Float can hold.
 */
describe("SceneGraph Double field support (Roku OS 15.3)", () => {
    test('addNodeField(name, "double", ...) declares a field of type double', () => {
        const node = SGNodeFactory.createNode("Node");
        node.addNodeField("largeDecimalNumber", "double", true);

        expect(node.hasNodeField("largeDecimalNumber")).toBe(true);
        const field = node.getNodeFields().get("largedecimalnumber");
        expect(field).toBeDefined();
        expect(field.type).toBe("double");
    });

    test("a double field stores a Double and preserves precision beyond Float range", () => {
        const node = SGNodeFactory.createNode("Node");
        node.addNodeField("largeDecimalNumber", "double", true);

        // This value loses its low-order digits when stored as a 32-bit Float.
        const preciseValue = 12345678.123456789;
        node.setValue("largeDecimalNumber", new Double(preciseValue));

        // The stored value boxes to an roDouble; unboxing confirms the Double kind.
        const stored = node.getValue("largeDecimalNumber");
        expect(stored.unbox().kind).toBe(ValueKind.Double);
        expect(node.getValueJS("largeDecimalNumber")).toBeCloseTo(preciseValue, 6);
    });

    test("a float field of the same value loses precision (contrast)", () => {
        const node = SGNodeFactory.createNode("Node");
        node.addNodeField("smallDecimalNumber", "float", true);

        node.setValue("smallDecimalNumber", new Float(12345678.123456789));

        // A Float can only hold ~7 significant digits, so the low digits are gone.
        expect(node.getValueJS("smallDecimalNumber")).not.toBeCloseTo(12345678.123456789, 6);
    });

    test("assigning an Int or Float to a double field coerces to Double", () => {
        const node = SGNodeFactory.createNode("Node");
        node.addNodeField("d", "double", false);

        node.setValue("d", new Int32(42));
        expect(node.getValue("d").unbox().kind).toBe(ValueKind.Double);
        expect(node.getValueJS("d")).toBe(42);

        node.setValue("d", new Float(1.5));
        expect(node.getValue("d").unbox().kind).toBe(ValueKind.Double);
        expect(node.getValueJS("d")).toBeCloseTo(1.5, 6);
    });

    test("a double field serializes its value for cross-thread transfer", () => {
        const node = SGNodeFactory.createNode("Node");
        node.addNodeField("d", "double", true);
        node.setValue("d", new Double(9876543.5));

        const serialized = fromSGNode(node, false);
        expect(serialized.d).toBeCloseTo(9876543.5, 6);
    });
});
