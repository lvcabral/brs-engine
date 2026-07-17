sub Main()
    print "=== Reparent Repro ==="

    ' A component that moves an XML-declared child into an inner container in init():
    ' after the move the root must no longer hold the node (single-parent invariant),
    ' otherwise the render traversal draws the subtree twice.
    node = CreateObject("roSGNode", "ReparentComp")
    moved = node.findNode("movedGroup")
    inner = node.findNode("innerGroup")
    print "root child count = "; node.getChildCount()
    print "inner child count = "; inner.getChildCount()
    print "moved parent is inner = "; moved.getParent().isSameNode(inner)

    ' Plain appendChild between two parents must also reparent.
    a = CreateObject("roSGNode", "Group")
    b = CreateObject("roSGNode", "Group")
    c = CreateObject("roSGNode", "Group")
    a.appendChild(c)
    b.appendChild(c)
    print "a child count = "; a.getChildCount()
    print "b child count = "; b.getChildCount()
    print "c parent is b = "; c.getParent().isSameNode(b)

    ' insertChild and replaceChild follow the same single-parent rule.
    d = CreateObject("roSGNode", "Group")
    d.insertChild(c, 0)
    print "b child count after insert = "; b.getChildCount()
    print "c parent is d = "; c.getParent().isSameNode(d)
    e = CreateObject("roSGNode", "Group")
    e.appendChild(CreateObject("roSGNode", "Group"))
    e.replaceChild(c, 0)
    print "d child count after replace = "; d.getChildCount()
    print "c parent is e = "; c.getParent().isSameNode(e)

    print "=== Reparent Repro Complete ==="
end sub
