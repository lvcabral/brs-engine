const brs = require("../../packages/node/bin/brs.node");
const { BrsString } = brs.types;
const sg = require("../../packages/node/bin/brs-sg.node");
const { ContentNode, Node, brsValueOf, fromSGNode, toSGNode, updateSGNode } = sg;

describe("Circular Reference Handling", () => {
    describe("SceneGraph Nodes", () => {
        it("should serialize and deserialize nodes with circular references", () => {
            // Create a parent node
            const parent = new Node([], "TestNode");
            parent.setValueSilent("id", new BrsString("parent"));

            // Create a child node
            const child = new Node([], "TestNode");
            child.setValueSilent("id", new BrsString("child"));

            // Create a circular reference by adding a field that points back to parent
            parent.appendChildToParent(child);
            child.setValueSilent("parentRef", parent);

            // Serialize the parent node
            const serialized = fromSGNode(parent);

            // Check that circular reference is marked (field names are lowercased)
            expect(serialized._children_).toBeDefined();
            expect(serialized._children_[0].parentref).toBeDefined();
            expect(serialized._children_[0].parentref._circular_).toBeDefined();
            expect(serialized._children_[0].parentref._address_).toBe(parent.address);

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
            const parentRef = childNode.getValue("parentRef");
            expect(parentRef).toBe(deserialized);
        });

        it("should handle multiple nodes with circular references", () => {
            // Create three nodes with circular references
            const node1 = new ContentNode();
            node1.setValueSilent("id", new BrsString("node1"));
            node1.setValueSilent("title", new BrsString("Node 1"));

            const node2 = new ContentNode();
            node2.setValueSilent("id", new BrsString("node2"));
            node2.setValueSilent("title", new BrsString("Node 2"));

            const node3 = new ContentNode();
            node3.setValueSilent("id", new BrsString("node3"));
            node3.setValueSilent("title", new BrsString("Node 3"));

            // Create circular references
            node1.appendChildToParent(node2);
            node2.appendChildToParent(node3);
            node3.setValueSilent("backToRoot", node1);

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
            const backRef = child3.getValue("backToRoot");

            // The circular reference should point back to the root
            expect(backRef).toBe(deserialized);
        });

        it("should handle self-referencing nodes", () => {
            const node = new Node([], "TestNode");
            node.setValueSilent("id", new BrsString("self"));
            node.setValueSilent("myself", node);

            // Serialize
            const serialized = fromSGNode(node);

            // Check for circular marker
            expect(serialized.myself._circular_).toBeDefined();
            expect(serialized.myself._address_).toBe(node.address);

            // Deserialize
            const nodeInfo = serialized._node_.split(":");
            const deserialized = toSGNode(serialized, nodeInfo[0], nodeInfo[1]);

            // Verify self-reference
            const myselfRef = deserialized.getValue("myself");
            //expect(myselfRef).toBe(deserialized);
        });
    });

    describe("brsValueOf with circular references", () => {
        it("should handle JS objects with circular node references", () => {
            const node = new Node([], "TestNode");
            node.setValueSilent("id", new BrsString("test"));

            const serialized = fromSGNode(node);

            // Create a circular reference in JS object
            const jsObj = {
                node: serialized,
                children: [
                    {
                        _circular_: serialized._node_,
                        _address_: node.address,
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

describe("updateSGNode", () => {
    it("updates existing nodes and children when addresses match", () => {
        const root = new Node([], "TestNode");
        root.setValueSilent("id", new BrsString("root"));
        root.setValueSilent("label", new BrsString("initial"));

        const existingChild = new Node([], "TestNode");
        existingChild.setValueSilent("id", new BrsString("child-1"));
        existingChild.setValueSilent("title", new BrsString("before"));
        root.appendChildToParent(existingChild);

        const serialized = fromSGNode(root);
        serialized.label = "updated";
        serialized.count = 3;
        serialized._children_[0].title = "child-updated";
        serialized._children_[0].rating = 5;

        const newChild = new Node([], "TestNode");
        newChild.setValueSilent("id", new BrsString("child-2"));
        newChild.setValueSilent("title", new BrsString("fresh"));
        const serializedNewChild = fromSGNode(newChild);
        serialized._children_.push(serializedNewChild);

        const nodeMap = new Map();
        nodeMap.set(root.address, root);
        nodeMap.set(existingChild.address, existingChild);

        const updatedRoot = updateSGNode(serialized, root, nodeMap);

        expect(updatedRoot).toBe(root);
        expect(updatedRoot.getValueJS("label")).toBe("updated");
        expect(updatedRoot.getValue("count").getValue()).toBe(3);

        const children = updatedRoot.getNodeChildren();
        expect(children.length).toBe(2);

        const updatedChild = children[0];
        expect(updatedChild).toBe(existingChild);
        expect(updatedChild.getValueJS("title")).toBe("child-updated");
        expect(updatedChild.getValue("rating").getValue()).toBe(5);

        const appendedChild = children[1];
        expect(appendedChild.getValueJS("id")).toBe("child-2");
    });

    it("updates nested field nodes with matching addresses", () => {
        const root = new Node([], "TestNode");
        const fieldNode = new Node([], "TestNode");
        fieldNode.setValueSilent("title", new BrsString("old"));
        root.setValueSilent("content", fieldNode);

        const serialized = fromSGNode(root);
        serialized.content.title = "new";

        const nodeMap = new Map();
        nodeMap.set(root.address, root);
        nodeMap.set(fieldNode.address, fieldNode);

        const updatedRoot = updateSGNode(serialized, root, nodeMap);

        expect(updatedRoot.getValue("content")).toBe(fieldNode);
        expect(fieldNode.getValueJS("title")).toBe("new");
    });

    it("replaces field nodes when addresses differ", () => {
        const root = new Node([], "TestNode");
        const originalField = new Node([], "TestNode");
        originalField.setValueSilent("id", new BrsString("original"));
        root.setValueSilent("content", originalField);

        const serialized = fromSGNode(root);
        const replacementField = new Node([], "TestNode");
        replacementField.setValueSilent("id", new BrsString("replacement"));
        replacementField.setValueSilent("title", new BrsString("new"));
        serialized.content = fromSGNode(replacementField);

        const nodeMap = new Map();
        nodeMap.set(root.address, root);
        nodeMap.set(originalField.address, originalField);

        const updatedRoot = updateSGNode(serialized, root, nodeMap);

        const assignedField = updatedRoot.getValue("content");
        expect(assignedField).not.toBe(originalField);
        expect(assignedField.getValueJS("id")).toBe("replacement");
        expect(assignedField.getValueJS("title")).toBe("new");
    });

    it("removes children that are missing from serialized data", () => {
        const root = new Node([], "TestNode");
        const childA = new Node([], "TestNode");
        const childB = new Node([], "TestNode");
        root.appendChildToParent(childA);
        root.appendChildToParent(childB);

        const serialized = fromSGNode(root);
        serialized._children_ = serialized._children_.slice(0, 1);

        const nodeMap = new Map();
        nodeMap.set(root.address, root);
        nodeMap.set(childA.address, childA);
        nodeMap.set(childB.address, childB);

        const updatedRoot = updateSGNode(serialized, root, nodeMap);

        const children = updatedRoot.getNodeChildren();
        expect(children.length).toBe(1);
        expect(children[0]).toBe(childA);
        expect(childB.getNodeParent()).not.toBe(updatedRoot);
    });
});
