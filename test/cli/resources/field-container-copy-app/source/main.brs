sub cb()
end sub

sub Main()
    print "=== Field Container Copy ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()

    ' Assigning/reading an assocarray field copies the container, and a member it cannot copy -- a
    ' function reference, an roDateTime, an roByteArray -- has its KEY DROPPED (device-confirmed).
    scene.data = { url: "u", onDone: cb, when: CreateObject("roDateTime"), ba: CreateObject("roByteArray"), nested: { k: "v" } }
    back = scene.data
    print "keys = "; back.keys().join(",")
    print "onDone invalid = "; back.onDone = invalid
    print "when invalid = "; back.when = invalid
    print "ba invalid = "; back.ba = invalid
    print "nested.k = "; back.nested.k

    ' A cyclic container must copy (preserving the cycle), not overflow the stack.
    parent = { name: "p" }
    child = { name: "c", parent: parent }
    parent.child = child
    scene.data = parent
    r = scene.data
    print "cycle name = "; r.name
    print "cycle child.name = "; r.child.name
    print "cycle child.parent.name = "; r.child.parent.name
    print "cycle closed = "; r.child.parent.child.name = "c"

    ' An ARRAY keeps the slot instead, storing invalid, so Count() is unchanged (device-confirmed).
    scene.items = [cb, CreateObject("roDateTime"), "plain"]
    ia = scene.items
    print "array count = "; ia.count()
    print "array[0] invalid = "; ia[0] = invalid
    print "array[1] invalid = "; ia[1] = invalid
    print "array[2] = "; ia[2]

    ' roUtils.DeepCopy applies the very same policy -- drop the uncopyable, carry the node.
    utils = CreateObject("roUtils")
    n = CreateObject("roSGNode", "Node")
    dc = utils.DeepCopy({ node: n, when: CreateObject("roDateTime"), onDone: cb, s: "keep" })
    print "deepCopy s = "; dc.s
    print "deepCopy node = "; type(dc.node)
    print "deepCopy when invalid = "; dc.when = invalid
    print "deepCopy onDone invalid = "; dc.onDone = invalid

    print "=== Field Container Copy Complete ==="
end sub
