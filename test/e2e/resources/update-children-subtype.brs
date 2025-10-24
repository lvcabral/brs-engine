sub Main()
    print "Testing update() method with children subtype feature"
    print ""
    
    ' Test 1: Default subtype inheritance (ContentNode creates ContentNode children)
    print "Test 1: Default subtype inheritance"
    parent1 = CreateObject("roSGNode", "ContentNode")
    data1 = {
        title: "Parent ContentNode"
        children: [
            { title: "Child 1" }
            { title: "Child 2" }
        ]
    }
    parent1.update(data1, true)
    child1 = parent1.getChild(0)
    child2 = parent1.getChild(1)
    print "  Parent subtype: " + parent1.subtype()
    print "  Child 1 subtype: " + child1.subtype()
    print "  Child 2 subtype: " + child2.subtype()
    print ""
    
    ' Test 2: Override subtype for individual children
    print "Test 2: Override subtype for individual children"
    parent2 = CreateObject("roSGNode", "ContentNode")
    data2 = {
        title: "Parent"
        children: [
            { 
                title: "ContentNode child"
            }
            { 
                subtype: "Node"
                id: "basicNode"
            }
        ]
    }
    parent2.update(data2, true)
    child1_2 = parent2.getChild(0)
    child2_2 = parent2.getChild(1)
    print "  Parent subtype: " + parent2.subtype()
    print "  Child 1 subtype: " + child1_2.subtype()
    print "  Child 2 subtype: " + child2_2.subtype()
    print "  Child 2 id: " + child2_2.id
    print ""
    
    ' Test 3: Nested children with different subtypes
    print "Test 3: Nested children with different subtypes"
    parent3 = CreateObject("roSGNode", "ContentNode")
    data3 = {
        title: "Root ContentNode"
        children: [
            {
                subtype: "Node"
                id: "level1_node"
                children: [
                    {
                        subtype: "ContentNode"
                        title: "Level 2 - Back to ContentNode"
                        children: [
                            {
                                title: "Level 3 - Inherited ContentNode"
                            }
                        ]
                    }
                ]
            }
        ]
    }
    parent3.update(data3, true)
    level1 = parent3.getChild(0)
    level2 = level1.getChild(0)
    level3 = level2.getChild(0)
    print "  Root subtype: " + parent3.subtype()
    print "  Level 1 subtype: " + level1.subtype()
    print "  Level 1 id: " + level1.id
    print "  Level 2 subtype: " + level2.subtype()
    print "  Level 2 title: " + level2.title
    print "  Level 3 subtype: " + level3.subtype()
    print "  Level 3 title: " + level3.title
    print ""
    
    ' Test 4: Group node creates Node children by default
    print "Test 4: Group node creates Node children by default"
    group4 = CreateObject("roSGNode", "Group")
    group4.id = "myGroup"
    data4 = {
        translation: [100, 200]
        children: [
            { id: "child1" }
            { id: "child2" }
        ]
    }
    group4.update(data4, true)
    gchild1 = group4.getChild(0)
    gchild2 = group4.getChild(1)
    print "  Group subtype: " + group4.subtype()
    print "  Child 1 subtype: " + gchild1.subtype()
    print "  Child 1 id: " + gchild1.id
    print "  Child 2 subtype: " + gchild2.subtype()
    print "  Child 2 id: " + gchild2.id
    print ""
    
    ' Test 5: Group with ContentNode children (explicit subtype)
    print "Test 5: Group with ContentNode children (explicit subtype)"
    group5 = CreateObject("roSGNode", "Group")
    data5 = {
        id: "parentGroup"
        children: [
            {
                subtype: "ContentNode"
                title: "Content child 1"
                url: "http://example.com/video1.mp4"
            }
            {
                subtype: "ContentNode"
                title: "Content child 2"
                url: "http://example.com/video2.mp4"
            }
        ]
    }
    group5.update(data5, true)
    c1 = group5.getChild(0)
    c2 = group5.getChild(1)
    print "  Group subtype: " + group5.subtype()
    print "  Child 1 subtype: " + c1.subtype()
    print "  Child 1 title: " + c1.title
    print "  Child 2 subtype: " + c2.subtype()
    print "  Child 2 title: " + c2.title
    print ""
    
    ' Test 6: Mixed subtypes in sibling nodes
    print "Test 6: Mixed subtypes in sibling nodes"
    parent6 = CreateObject("roSGNode", "Group")
    data6 = {
        id: "mixedGroup"
        children: [
            {
                subtype: "Node"
                id: "node1"
            }
            {
                subtype: "ContentNode"
                title: "Content 1"
            }
            {
                subtype: "Group"
                id: "nestedGroup"
            }
            {
                id: "defaultNode"
            }
        ]
    }
    parent6.update(data6, true)
    print "  Parent subtype: " + parent6.subtype()
    print "  Child 0 subtype: " + parent6.getChild(0).subtype()
    print "  Child 1 subtype: " + parent6.getChild(1).subtype()
    print "  Child 2 subtype: " + parent6.getChild(2).subtype()
    print "  Child 3 subtype: " + parent6.getChild(3).subtype()
    print ""
    
    ' Test 7: Subtype inheritance through multiple levels
    print "Test 7: Subtype inheritance through multiple levels"
    parent7 = CreateObject("roSGNode", "Group")
    data7 = {
        id: "rootGroup"
        children: [
            {
                subtype: "ContentNode"
                title: "Level 1 ContentNode"
                children: [
                    {
                        title: "Level 2 - Inherited ContentNode"
                        children: [
                            {
                                title: "Level 3 - Still ContentNode"
                            }
                        ]
                    }
                    {
                        subtype: "Node"
                        id: "level2_switch_to_node"
                        children: [
                            {
                                id: "level3_inherited_node"
                            }
                        ]
                    }
                ]
            }
        ]
    }
    parent7.update(data7, true)
    l1 = parent7.getChild(0)
    l2_1 = l1.getChild(0)
    l3_1 = l2_1.getChild(0)
    l2_2 = l1.getChild(1)
    l3_2 = l2_2.getChild(0)
    print "  Root subtype: " + parent7.subtype()
    print "  Level 1 subtype: " + l1.subtype()
    print "  Level 2.1 subtype: " + l2_1.subtype()
    print "  Level 3.1 subtype: " + l3_1.subtype()
    print "  Level 2.2 subtype: " + l2_2.subtype()
    print "  Level 3.2 subtype: " + l3_2.subtype()
    print ""
    
    ' Test 8: Using update() with roArray directly (inherits parent subtype)
    print "Test 8: Using update() with roArray directly"
    parent8 = CreateObject("roSGNode", "ContentNode")
    parent8.title = "Parent"
    childrenArray = [
        { title: "Child A" }
        { title: "Child B" }
        { subtype: "Node", id: "nodeChild" }
    ]
    parent8.update(childrenArray, true)
    print "  Parent subtype: " + parent8.subtype()
    print "  Child A subtype: " + parent8.getChild(0).subtype()
    print "  Child B subtype: " + parent8.getChild(1).subtype()
    print "  Child C subtype: " + parent8.getChild(2).subtype()
    print "  Child C id: " + parent8.getChild(2).id
    print ""
    
    ' Test 9: Subtype with createFields=false (verify fields still respected)
    print "Test 9: Subtype with createFields=false"
    parent9 = CreateObject("roSGNode", "ContentNode")
    data9 = {
        title: "Parent"
        children: [
            {
                subtype: "ContentNode"
                title: "Valid field"
                customField: "Should not be created"
                url: "http://example.com/valid.mp4"
            }
            {
                subtype: "Node"
                id: "node_child"
                fakeField: "Also not created"
            }
        ]
    }
    parent9.update(data9, false)
    c1_9 = parent9.getChild(0)
    c2_9 = parent9.getChild(1)
    print "  Child 1 subtype: " + c1_9.subtype()
    print "  Child 1 title: " + c1_9.title
    print "  Child 1 has customField: " + c1_9.hasField("customField").toStr()
    print "  Child 1 url: " + c1_9.url
    print "  Child 2 subtype: " + c2_9.subtype()
    print "  Child 2 id: " + c2_9.id
    print "  Child 2 has fakeField: " + c2_9.hasField("fakeField").toStr()
    print ""
    
    print "All subtype tests completed successfully!"
end sub
