sub main()
	node = createObject("roSGNode", "Node")
    print node.setField("id", "TestNode")
	print node.addFields({one: 1, two: 2})
	print node.addFields({one: "1", four: 4})
	print node.setField("three", 3)
	node.three = 3
	print node.setField("one", "1")
	print node.setFields({one: "1", three: 3})
    print node.addFields({XYZ: "xyz", ABC: "abc"})
    print node.addReplace("three", 3)
    print node
	print node.id
    print node.one
    print node.three
    print node.clear()
    print node.removeField("id")
    print node.id
    print node.append({final: "final"})
    print node.final
end sub