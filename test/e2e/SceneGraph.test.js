const { execute, createMockStreams, resourceFile, allArgs } = require("./E2ETests");

describe("SceneGraph node tests", () => {
    let outputStreams;

    beforeAll(() => {
        outputStreams = createMockStreams();
        outputStreams.root = __dirname + "/resources";
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    test("update-children-test.brs", async () => {
        await execute([resourceFile("scenegraph", "update-children-test.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "Parent title: Updated Parent",
            "Parent description: This is the parent",
            "Parent child count: 3",
            "Child 1 title: Child 1",
            "Child 1 description: First child",
            "Child 2 title: Child 2",
            "Child 2 child count: 1",
            "Grandchild title: Grandchild 1",
            "Child 3 title: Child 3",
            "Test completed successfully!",
        ]);
    });

    test("update-children-comprehensive.brs", async () => {
        await execute([resourceFile("scenegraph", "update-children-comprehensive.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "Testing update() method with children feature",
            "",
            "Test 1: Basic children creation from AA",
            "  Parent 1 title: Parent 1",
            "  Child count: 2",
            "  Child A title: Child A",
            "  Child B title: Child B",
            "",
            "Test 2: Nested children (multiple levels)",
            "  Root: Root",
            "  Level 1: Level 1 - Child 1",
            "  Level 2: Level 2 - Grandchild 1",
            "  Level 3: Level 3 - Great-grandchild 1",
            "",
            "Test 3: Mixed content with various fields",
            "  Collection title: Video Collection",
            "  Collection type: series",
            "  Episode 1 title: Episode 1",
            "  Episode 1 URL: http://example.com/ep1.mp4",
            "  Episode 1 length: 3600",
            "  Episode 2 title: Episode 2",
            "",
            "Test 4: Empty children array",
            "  Before update, child count: 1",
            "  After update, child count: 1",
            "",
            "Test 5: Update replaces existing children",
            "  Before update, child count: 1",
            "  Original child title: Original Child",
            "  After update, child count: 3",
            "  Original title: Original Child",
            "  New child 1 title: New Child 1",
            "  New child 2 title: New Child 2",
            "",
            "Test 6: Non-array children value",
            "  Parent title: Parent with invalid children",
            "  Child count: 0",
            "",
            "Test 7: Regular update behavior (without children key)",
            "  Parent title: Regular Update",
            "  Parent description: No children here",
            "  Parent URL: http://example.com/video.mp4",
            "  Child count: 0",
            "",
            "Test 8: Non-existent fields should NOT be created (createFields=false)",
            "  Parent title: Valid Field",
            "  Child 1 title: Child with valid field",
            "  Child 1 has customField1: false",
            "  Child 1 url: http://example.com/video.mp4",
            "  Child 2 title: Another child",
            "  Child 2 has nonExistentField: false",
            "  Child 2 has fakeProperty: false",
            "  Grandchild title: Grandchild",
            "  Grandchild has anotherBadField: false",
            "  Grandchild description: But this valid field should work",
            "",
            "Test 9: Non-existent fields SHOULD be created (createFields=true)",
            "  Parent title: Parent with custom fields",
            "  Parent has customParentField: true",
            "  Parent customParentField: This SHOULD be created",
            "  Child title: Child",
            "  Child has customChildField: true",
            "  Child customChildField: This SHOULD also be created",
            "  Child has anotherCustom: true",
            "",
            "All tests completed successfully!",
        ]);
    });

    test("update-children-nodetypes.brs", async () => {
        await execute([resourceFile("scenegraph", "update-children-nodetypes.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "Testing update() with children on different node types",
            "",
            "Test 1: Group node with children",
            "  Group ID: myGroup",
            "  Translation: [100, 200]",
            "  Child count: 2",
            "  Child 1 title: Child 1",
            "  Child 1 description: First",
            "",
            "Test 2: Node with existing children structure",
            "  Before update - Child count: 1",
            "  After update - Child count: 4",
            "  Node ID: updatedNode",
            "  Child 1 title: Existing",
            "  Child 2 title: New 1",
            "  Child 3 title: New 2",
            "  Child 4 title: New 3",
            "",
            "Tests completed!",
        ]);
    });

    test("update-children-subtype.brs", async () => {
        await execute([resourceFile("scenegraph", "update-children-subtype.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "Testing update() method with children subtype feature",
            "",
            "Test 1: Default subtype inheritance",
            "  Parent subtype: ContentNode",
            "  Child 1 subtype: ContentNode",
            "  Child 2 subtype: ContentNode",
            "",
            "Test 2: Override subtype for individual children",
            "  Parent subtype: ContentNode",
            "  Child 1 subtype: ContentNode",
            "  Child 2 subtype: invalid",
            "  Child 1 title: ContentNode child",
            "",
            "Test 3: Nested children with different subtypes",
            "  Root subtype: Node",
            "  Level 1 subtype: ContentNode",
            "  Level 1 id:",
            "  Level 2 subtype: ContentNode",
            "  Level 2 title: Level 2 - Back to ContentNode",
            "  Level 3 subtype: ContentNode",
            "  Level 3 title: Level 3 - Inherited ContentNode",
            "",
            "Test 4: Group node creates Node children by default",
            "  Group subtype: Group",
            "  Child 1 subtype: Group",
            "  Child 1 id: child1",
            "  Child 2 subtype: Group",
            "  Child 2 id: child2",
            "",
            "Test 5: Group with ContentNode children (explicit subtype)",
            "  Group subtype: Group",
            "  Child 1 subtype: ContentNode",
            "  Child 1 title: Content child 1",
            "  Child 2 subtype: ContentNode",
            "  Child 2 title: Content child 2",
            "",
            "Test 6: Mixed subtypes in sibling nodes",
            "  Parent subtype: Group",
            "  Child 0 subtype: Node",
            "  Child 1 subtype: ContentNode",
            "  Child 2 subtype: Group",
            "  Child 3 subtype: Group",
            "",
            "Test 7: Subtype inheritance through multiple levels",
            "  Root subtype: Group",
            "  Level 1 subtype: Node",
            "  Level 2.1 subtype: Node",
            "  Level 3.1 subtype: Node",
            "  Level 2.2 subtype: ContentNode",
            "  Level 3.2 subtype: ContentNode",
            "",
            "Test 8: Using update() with roArray directly",
            "  Parent subtype: ContentNode",
            "  Child A subtype: ContentNode",
            "  Child B subtype: ContentNode",
            "  Child C subtype: invalid",
            "  Child A title: Child A",
            "",
            "Test 9: Subtype with createFields=false",
            "  Child 1 subtype: ContentNode",
            "  Child 1 title: Valid field",
            "  Child 1 has customField: false",
            "  Child 1 url: http://example.com/valid.mp4",
            "  Child 2 subtype: Node",
            "  Child 2 id: node_child",
            "  Child 2 has fakeField: false",
            "",
            "All subtype tests completed successfully!",
        ]);
    });
    test("update-fields.brs", async () => {
        await execute([resourceFile("scenegraph", "update-fields.brs")], outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "true",
            "true",
            "true",
            "false",
            "true",
            "true",
            "true",
            "<UNINITIALIZED>",
            `<Component: roSGNode:Node> =
{
    id: "TestNode"
    focusable: false
    focusedChild: <Component: roInvalid>
    change: <Component: roAssociativeArray>
    ABC: "abc"
    four: 4
    one: 1
    two: 2
    XYZ: "xyz"
}`,
            "TestNode",
            " 1",
            "invalid",
            "<UNINITIALIZED>",
            "true",
            "TestNode",
            "<UNINITIALIZED>",
            "final",
        ]);
    });
});
