sub Main()
    print "Testing update() with a nested {subtype:...} AA on an arbitrary field"
    print ""

    ' Test 1: a brand new field whose value is {subtype:"Node"} should become a
    ' real roSGNode, just like a "children" array element with the same shape.
    print "Test 1: fresh field with a valid subtype"
    n1 = CreateObject("roSGNode", "Node")
    n1.update({ thing: { subtype: "Node" } }, true)
    print "  type(n1.thing): " + type(n1.thing)
    if type(n1.thing) = "roSGNode"
        print "  n1.thing.subtype(): " + n1.thing.subtype()
    end if
    print ""

    ' Test 2: an unknown/invalid subtype should fail node creation, leaving the
    ' field's value Invalid (the field is still created, typed as Node).
    print "Test 2: fresh field with an invalid subtype"
    n2 = CreateObject("roSGNode", "Node")
    n2.update({ thing: { subtype: "TotallyBogusNodeType12345" } }, true)
    print "  n2.hasField(thing): " + n2.hasField("thing").toStr()
    print "  type(n2.thing): " + type(n2.thing)
    print ""

    ' Test 3: a nested AA WITHOUT a "subtype" key must still be stored as a
    ' plain AssocArray value - only the "subtype" shape triggers conversion.
    print "Test 3: fresh field with a plain (non-subtype) AA"
    n3 = CreateObject("roSGNode", "Node")
    n3.update({ meta: { foo: "bar" } }, true)
    print "  type(n3.meta): " + type(n3.meta)
    if type(n3.meta) = "roAssociativeArray"
        print "  n3.meta.foo: " + n3.meta.foo
    end if
    print ""

    ' Test 4: the real-world regression - a field pre-declared via a
    ' {subtype:"Node"} placeholder (as in a "create a response holder" helper)
    ' must accept a REAL node value in a later update() call without a type
    ' mismatch.
    print "Test 4: pre-declared placeholder field accepts a real node later"
    responseNode = CreateObject("roSGNode", "Node")
    responseNode.update({ request: { subtype: "Node" }, result: { subtype: "Node" } }, true)
    print "  Pre-declared type(responseNode.result): " + type(responseNode.result)

    realResult = CreateObject("roSGNode", "ContentNode")
    realResult.update({ code: 200 }, true)
    responseNode.update({ result: realResult }, true)

    print "  After real update, type(responseNode.result): " + type(responseNode.result)
    if type(responseNode.result) = "roSGNode"
        print "  responseNode.result.code: " + responseNode.result.code.toStr()
    end if
    print ""

    ' Test 5: a "children" array alongside a sibling subtype-node field in the
    ' same update() call - the special-cased "children" handling must not
    ' interfere with the generic subtype-node handling (or vice versa).
    print "Test 5: children[] alongside a sibling subtype-node field"
    parent = CreateObject("roSGNode", "Node")
    parent.update({
        linked: { subtype: "Node" }
        children: [
            { subtype: "Node", id: "child1" }
            { subtype: "Node", id: "child2" }
        ]
    }, true)
    print "  parent.getChildCount(): " + parent.getChildCount().toStr()
    print "  type(parent.linked): " + type(parent.linked)

    print ""
    print "Test completed successfully!"
end sub
