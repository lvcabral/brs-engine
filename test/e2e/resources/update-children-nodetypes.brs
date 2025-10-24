sub Main()
    print "Testing update() with children on different node types"
    print ""

    ' Test with Group node
    print "Test 1: Group node with children"
    group = CreateObject("roSGNode", "Group")
    group.id = "myGroup"
    data = {
        translation: [100, 200]
        children: [
            {title: "Child 1", description: "First"}
            {title: "Child 2", description: "Second"}
        ]
    }
    group.update(data, true)
    print "  Group ID: " + group.id
    print "  Translation: [" + group.translation[0].toStr() + ", " + group.translation[1].toStr() + "]"
    print "  Child count: " + group.getChildCount().toStr()
    if group.getChildCount() > 0 then
        child1 = group.getChild(0)
        print "  Child 1 title: " + child1.title
        print "  Child 1 description: " + child1.description
    end if
    print ""

    ' Test with RowList node (if it exists)
    print "Test 2: Node with existing children structure"
    node = CreateObject("roSGNode", "Node")
    node.id = "testNode"
    ' Manually add a child first
    existingChild = CreateObject("roSGNode", "ContentNode")
    existingChild.title = "Existing"
    node.appendChild(existingChild)
    print "  Before update - Child count: " + node.getChildCount().toStr()

    data2 = {
        id: "updatedNode"
        children: [
            {title: "New 1"}
            {title: "New 2"}
            {title: "New 3"}
        ]
    }
    node.update(data2, true)
    print "  After update - Child count: " + node.getChildCount().toStr()
    print "  Node ID: " + node.id
    for i = 0 to node.getChildCount() - 1
        child = node.getChild(i)
        print "  Child " + (i + 1).toStr() + " title: " + child.title
    end for
    print ""

    print "Tests completed!"
end sub
