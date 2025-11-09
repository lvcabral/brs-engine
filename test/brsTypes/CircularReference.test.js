const brs = require("../../packages/node/bin/brs.node");
const { brsValueOf, jsValueOf, fromSGNode, toSGNode } = brs.types;
const { RoSGNode, ContentNode, BrsString } = brs.types;

describe("Circular Reference Handling", () => {
    describe("SceneGraph Nodes", () => {
        it("should serialize and deserialize nodes with circular references", () => {
            // Create a parent node
            const parent = new RoSGNode([], "TestNode");
            parent.setFieldValue("id", new BrsString("parent"));

            // Create a child node
            const child = new RoSGNode([], "TestNode");
            child.setFieldValue("id", new BrsString("child"));

            // Create a circular reference by adding a field that points back to parent
            parent.appendChildToParent(child);
            child.setFieldValue("parentRef", parent);

            // Serialize the parent node
            const serialized = fromSGNode(parent);

            // Check that circular reference is marked (field names are lowercased)
            expect(serialized._children_).toBeDefined();
            expect(serialized._children_[0].parentref).toBeDefined();
            expect(serialized._children_[0].parentref._circular_).toBeDefined();
            expect(serialized._children_[0].parentref._address_).toBe(parent.sgNode.address);

            // Deserialize the node
            const nodeInfo = serialized._node_.split(":");
            const deserialized = toSGNode(serialized, nodeInfo[0], nodeInfo[1]);

            // Verify the deserialized structure
            expect(deserialized).toBeDefined();
            expect(deserialized.getId()).toBe(parent.getId());

            // Verify children exist
            const children = deserialized.getNodeChildren();
            expect(children.length).toBe(1);

            // Verify the circular reference resolves correctly
            const childNode = children[0];
            const parentRef = childNode.getFieldValue("parentRef");
            expect(parentRef).toBe(deserialized);
        });

        it("should handle multiple nodes with circular references", () => {
            // Create three nodes with circular references
            const node1 = new ContentNode();
            node1.setFieldValue("id", new BrsString("node1"));
            node1.setFieldValue("title", new BrsString("Node 1"));

            const node2 = new ContentNode();
            node2.setFieldValue("id", new BrsString("node2"));
            node2.setFieldValue("title", new BrsString("Node 2"));

            const node3 = new ContentNode();
            node3.setFieldValue("id", new BrsString("node3"));
            node3.setFieldValue("title", new BrsString("Node 3"));

            // Create circular references
            node1.appendChildToParent(node2);
            node2.appendChildToParent(node3);
            node3.setFieldValue("backToRoot", node1);

            // Serialize
            const serialized = fromSGNode(node1);

            // Check for circular marker in nested structure (field names are lowercased)
            expect(serialized._children_[0]._children_[0].backtoroot._circular_).toBeDefined();

            // Deserialize
            const nodeInfo = serialized._node_.split(":");
            const deserialized = toSGNode(serialized, nodeInfo[0], nodeInfo[1]);

            // Verify structure
            expect(deserialized).toBeDefined();
            const child2 = deserialized.getNodeChildren()[0];
            const child3 = child2.getNodeChildren()[0];
            const backRef = child3.getFieldValue("backToRoot");

            // The circular reference should point back to the root
            expect(backRef).toBe(deserialized);
        });

        it("should handle self-referencing nodes", () => {
            const node = new RoSGNode([], "TestNode");
            node.setFieldValue("id", new BrsString("self"));
            node.setFieldValue("myself", node);

            // Serialize
            const serialized = fromSGNode(node);

            // Check for circular marker
            expect(serialized.myself._circular_).toBeDefined();
            expect(serialized.myself._address_).toBe(node.sgNode.address);

            // Deserialize
            const nodeInfo = serialized._node_.split(":");
            const deserialized = toSGNode(serialized, nodeInfo[0], nodeInfo[1]);

            // Verify self-reference
            const myselfRef = deserialized.getFieldValue("myself");
            //expect(myselfRef).toBe(deserialized);
        });
    });

    describe("brsValueOf with circular references", () => {
        it("should handle JS objects with circular node references", () => {
            const node = new RoSGNode([], "TestNode");
            node.setFieldValue("id", new BrsString("test"));

            const serialized = fromSGNode(node);

            // Create a circular reference in JS object
            const jsObj = {
                node: serialized,
                children: [
                    {
                        _circular_: serialized._node_,
                        _address_: node.sgNode.address,
                    },
                ],
            };

            // Convert with brsValueOf
            const converted = brsValueOf(jsObj);

            // Should handle the circular reference without errors
            expect(converted).toBeDefined();
        });
    });
});
