sub Main()
    print "=== Method Shadow Field Repro ==="

    ' ShadowGroup declares an XML field named "isInFocusChain", which is also an
    ' ifSGNodeFocus method. Call syntax must resolve the method (a field value is
    ' not callable), while reads and observers must see the XML field.
    node = CreateObject("roSGNode", "ShadowGroup")
    node.isInFocusChain = true
    print "field read = "; node.isInFocusChain
    print "method call = "; node.isInFocusChain()

    print "=== Method Shadow Field Repro Complete ==="
end sub
