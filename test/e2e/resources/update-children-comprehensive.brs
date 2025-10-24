sub Main()
    print "Testing update() method with children feature"
    print ""

    ' Test 1: Basic children creation
    print "Test 1: Basic children creation from AA"
    parent1 = CreateObject("roSGNode", "ContentNode")
    data1 = {
        title: "Parent 1"
        children: [
            {title: "Child A"}
            {title: "Child B"}
        ]
    }
    parent1.update(data1, true)
    print "  Parent 1 title: " + parent1.title
    print "  Child count: " + parent1.getChildCount().toStr()
    print "  Child A title: " + parent1.getChild(0).title
    print "  Child B title: " + parent1.getChild(1).title
    print ""

    ' Test 2: Nested children (multiple levels)
    print "Test 2: Nested children (multiple levels)"
    parent2 = CreateObject("roSGNode", "ContentNode")
    data2 = {
        title: "Root"
        children: [
            {
                title: "Level 1 - Child 1"
                children: [
                    {
                        title: "Level 2 - Grandchild 1"
                        children: [
                            {title: "Level 3 - Great-grandchild 1"}
                        ]
                    }
                ]
            }
        ]
    }
    parent2.update(data2, true)
    level1 = parent2.getChild(0)
    level2 = level1.getChild(0)
    level3 = level2.getChild(0)
    print "  Root: " + parent2.title
    print "  Level 1: " + level1.title
    print "  Level 2: " + level2.title
    print "  Level 3: " + level3.title
    print ""

    ' Test 3: Mixed content with various fields
    print "Test 3: Mixed content with various fields"
    parent3 = CreateObject("roSGNode", "ContentNode")
    data3 = {
        title: "Video Collection"
        description: "A collection of videos"
        contentType: "series"
        children: [
            {
                title: "Episode 1"
                description: "First episode"
                url: "http://example.com/ep1.mp4"
                length: 3600
                hdposterurl: "http://example.com/ep1.jpg"
            }
            {
                title: "Episode 2"
                description: "Second episode"
                url: "http://example.com/ep2.mp4"
                length: 3720
            }
        ]
    }
    parent3.update(data3, true)
    ep1 = parent3.getChild(0)
    ep2 = parent3.getChild(1)
    print "  Collection title: " + parent3.title
    print "  Collection type: " + parent3.contentType
    print "  Episode 1 title: " + ep1.title
    print "  Episode 1 URL: " + ep1.url
    print "  Episode 1 length: " + ep1.length.toStr()
    print "  Episode 2 title: " + ep2.title
    print ""

    ' Test 4: Empty children array
    print "Test 4: Empty children array"
    parent4 = CreateObject("roSGNode", "ContentNode")
    parent4.appendChild(CreateObject("roSGNode", "ContentNode"))
    print "  Before update, child count: " + parent4.getChildCount().toStr()
    data4 = {
        title: "Empty Parent"
        children: []
    }
    parent4.update(data4, true)
    print "  After update, child count: " + parent4.getChildCount().toStr()
    print ""

    ' Test 5: Update replaces existing children
    print "Test 5: Update replaces existing children"
    parent5 = CreateObject("roSGNode", "ContentNode")
    child1 = CreateObject("roSGNode", "ContentNode")
    child1.title = "Original Child"
    parent5.appendChild(child1)
    print "  Before update, child count: " + parent5.getChildCount().toStr()
    print "  Original child title: " + parent5.getChild(0).title
    data5 = {
        title: "Updated Parent"
        children: [
            {title: "New Child 1"}
            {title: "New Child 2"}
        ]
    }
    parent5.update(data5, true)
    print "  After update, child count: " + parent5.getChildCount().toStr()
    print "  Original title: " + parent5.getChild(0).title
    print "  New child 1 title: " + parent5.getChild(1).title
    print "  New child 2 title: " + parent5.getChild(2).title
    print ""

    ' Test 6: Non-array children value (should be ignored)
    print "Test 6: Non-array children value"
    parent6 = CreateObject("roSGNode", "ContentNode")
    data6 = {
        title: "Parent with invalid children"
        children: "not an array"
    }
    parent6.update(data6, true)
    print "  Parent title: " + parent6.title
    print "  Child count: " + parent6.getChildCount().toStr()
    print ""

    ' Test 7: Regular update behavior (without children key)
    print "Test 7: Regular update behavior (without children key)"
    parent7 = CreateObject("roSGNode", "ContentNode")
    data7 = {
        title: "Regular Update"
        description: "No children here"
        url: "http://example.com/video.mp4"
    }
    parent7.update(data7, true)
    print "  Parent title: " + parent7.title
    print "  Parent description: " + parent7.description
    print "  Parent URL: " + parent7.url
    print "  Child count: " + parent7.getChildCount().toStr()
    print ""

    ' Test 8: Non-existent fields should NOT be created when createFields=false
    print "Test 8: Non-existent fields should NOT be created (createFields=false)"
    parent8 = CreateObject("roSGNode", "ContentNode")
    data8 = {
        title: "Valid Field"
        description: "Another valid field"
        children: [
            {
                title: "Child with valid field"
                customField1: "This should NOT be created"
                url: "http://example.com/video.mp4"
            }
            {
                title: "Another child"
                nonExistentField: "This should also NOT be created"
                fakeProperty: 123
                children: [
                    {
                        title: "Grandchild"
                        anotherBadField: "Not created either"
                        description: "But this valid field should work"
                    }
                ]
            }
        ]
    }
    parent8.update(data8, false)
    child1_8 = parent8.getChild(0)
    child2_8 = parent8.getChild(1)
    grandchild_8 = child2_8.getChild(0)
    print "  Parent title: " + parent8.title
    print "  Child 1 title: " + child1_8.title
    print "  Child 1 has customField1: " + child1_8.hasField("customField1").toStr()
    print "  Child 1 url: " + child1_8.url
    print "  Child 2 title: " + child2_8.title
    print "  Child 2 has nonExistentField: " + child2_8.hasField("nonExistentField").toStr()
    print "  Child 2 has fakeProperty: " + child2_8.hasField("fakeProperty").toStr()
    print "  Grandchild title: " + grandchild_8.title
    print "  Grandchild has anotherBadField: " + grandchild_8.hasField("anotherBadField").toStr()
    print "  Grandchild description: " + grandchild_8.description
    print ""

    ' Test 9: Non-existent fields SHOULD be created when createFields=true
    print "Test 9: Non-existent fields SHOULD be created (createFields=true)"
    parent9 = CreateObject("roSGNode", "ContentNode")
    data9 = {
        title: "Parent with custom fields"
        customParentField: "This SHOULD be created"
        children: [
            {
                title: "Child"
                customChildField: "This SHOULD also be created"
                anotherCustom: 456
            }
        ]
    }
    parent9.update(data9, true)
    child1_9 = parent9.getChild(0)
    print "  Parent title: " + parent9.title
    print "  Parent has customParentField: " + parent9.hasField("customParentField").toStr()
    if parent9.hasField("customParentField") then
        print "  Parent customParentField: " + parent9.customParentField
    end if
    print "  Child title: " + child1_9.title
    print "  Child has customChildField: " + child1_9.hasField("customChildField").toStr()
    if child1_9.hasField("customChildField") then
        print "  Child customChildField: " + child1_9.customChildField
    end if
    print "  Child has anotherCustom: " + child1_9.hasField("anotherCustom").toStr()
    print ""

    print "All tests completed successfully!"
end sub
