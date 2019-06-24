sub main()
    ' tests for ifAssociativeArray
    node1 = createObject("roSGNode", "Node")
    node1.foo = "foo"

    node1.addReplace("bar", 5)
    node1.append({ baz: false })

    print "node size: " node1.count()                              ' => 7
    print "node keys size: " node1.keys().count()                  ' => 7
    print "node items size: " node1.items().count()                ' => 7
    print "can delete elements: " node1.delete("baz")              ' => true
    print "can look up elements: " node1.lookup("foo") = "foo"     ' => true
    print "can look up elements (brackets): " node1["foo"] = "foo" ' => true
    print "can check for existence: " node1.doesExist("bar")       ' => true

    node1.clear()
    print "can empty itself: " node1.count() = 0                   ' => true

    'ifNodeField tests
    node1.addField("field1", "string", false)
    node1.addFields({ field2: 0, field3: false})

    print "node size: " node1.count()                              ' => 3
    
    node1.removeField("field2")
    print "node size: " node1.count()                              ' => 2

    print "field3 in node is: " node1.getField("field3")           ' => false

    node1.setField("field3", true)
    print "field3 in node now is: " node1.getField("field3")      ' => true

    node1.setFields({ field1: "hello", field3: false })
    print "field1 in node now is: " node1.getField("field1")      ' => hello
    print "field3 in node now is: " node1.getField("field3")      ' => false

    node1.observeField("field1", "onSomethingChanged")
    node1.setField("field1", "world")

    'ifNodeChildren tests
    parentNode = createObject("roSGNode", "Node")
    parentNode.id = "parent"
    print "parent child count: " parentNode.getChildCount()        ' => 0
    childNode = parentNode.createChild("Node")
    testParent = childNode.getParent()
    print "get same parent from child: " parentNode.id = testParent.id '=> true
    print "parent child count: " parentNode.getChildCount()        ' => 1
    childNode2 = createObject("roSGNode", "Node")
    parentNode.appendChild(childNode2)
    print "parent child count: " parentNode.getChildCount()        ' => 2
    childNode3 = parentNode.createChild("Node")
    print "parent child count: " parentNode.getChildCount()        ' => 3
    parentNode.removeChild(childNode)
    print "parent child count: " parentNode.getChildCount()        ' => 2
    children = parentNode.getChildren(-1, 0)
    print "children size: " children.count()                       ' => 2

    'ifNodeDict tests
    ' no node exists
    currentNode = createObject("roSGNode", "Node")
    currentNode.id = "current"
    print "find node that does not exist: " currentNode.findNode("invalid-node-name") ' => invalid

    ' finds itself
    searchResult = currentNode.findNode("current")
    print "node finds itself: " searchResult.id                     ' => current

    ' finds one of its children
    child = currentNode.createChild("Node")
    child.id = "findnode-child"
    child.name = "Child"
    result = currentNode.findNode("findnode-child")
    print "node finds one of its children: " result.name            ' => Child

    ' finds a child of one of its children
    grandChild = child.createChild("Node")
    grandChild.id = "findnode-grandchild"
    grandChild.name = "Grandchild"
    grandChild2 = child.createChild("Node")
    grandChild2.id = "findnode-grandchild-2"
    grandChild2.name = "GrandChild-2"
    result = currentNode.findNode("findnode-grandchild")
    print "node finds its grandchild: " grandChild.name             ' => Grandchild

    ' finds a sibling node
    root = createObject("roSGNode", "Node")
    root.id = "root"
    root.name = "root-node"
    childrenIds = ["c1", "c2", "c3", "c4", "c5", "c6", "c7"]
    children = {}
    for each id in childrenIds
        child = root.createChild("Node")
        child.id = id
        child.name = "sibling-" + id
        children[id] = child
    end for

    result = children["c4"].findNode("c7")
    print "node finds its sibling: " result.name                    ' => name-c7

    ' finds a cousin node
    cousin1 = children["c1"].createChild("Node")
    cousin1.id = "cousin1"
    cousin1.name = "Cousin-1"

    cousin2 = children["c2"].createChild("Node")
    cousin2.id = "cousin2"
    cousin2.name = "Cousin-2"

    result = cousin1.findNode("cousin2")
    print "node finds a cousin node: " result.name                  ' => Cousin-2

    ' finds its grandparent
    result = cousin2.findNode("root")
    print "node finds its grandparent: " result.name                ' => root-node
end sub

sub onSomethingChanged()
    print "oops, something changed here"
end sub
