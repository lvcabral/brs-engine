sub main()
    ' Test field case preservation
    scene = CreateObject("roSGNode", "Scene")

    ' Create a node with mixed case field names
    node = CreateObject("roSGNode", "Node")

    ' Set some fields with different cases
    node.addFields({
        MyCustomField: "value1",
        anotherField: "value2",
        UPPERCASE: "value3"
    })

    ' Get the field names - they should preserve original case
    fields = node.getFields()

    print "Field names (should preserve case):"
    for each fieldName in fields
        print fieldName
    end for

    ' Verify case-insensitive access still works
    print ""
    print "Case-insensitive access tests:"
    print "node.mycustomfield = "; node.mycustomfield
    print "node.MyCustomField = "; node.MyCustomField
    print "node.MYCUSTOMFIELD = "; node.MYCUSTOMFIELD

    print "node.anotherfield = "; node.anotherfield
    print "node.anotherField = "; node.anotherField
    print "node.ANOTHERFIELD = "; node.ANOTHERFIELD

    print "node.uppercase = "; node.uppercase
    print "node.UPPERCASE = "; node.UPPERCASE

    ' Test with built-in fields
    node.id = "TestNode"
    node.ID = "TestNodeModified"
    print ""
    print "Built-in field test:"
    print "node.id = "; node.id
    print "node.ID = "; node.ID
end sub
