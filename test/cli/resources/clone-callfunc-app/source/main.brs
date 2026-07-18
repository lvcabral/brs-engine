sub Main()
    print "=== Clone CallFunc Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()

    ' A custom component that subclasses a data node (ContentNode) is reconstructed through
    ' createFlatNode (the same path a cross-thread Task copy takes). clone() exercises it in a
    ' single thread. The clone's public function must still see a valid m.top / m.global.
    original = CreateObject("roSGNode", "MyData")
    cloned = original.clone(false)
    print "clone subtype = "; cloned.subtype()
    print "readTop = "; cloned.callFunc("readTop")
    print "readGlobal = "; cloned.callFunc("readGlobal")
    print "=== Clone CallFunc Repro Complete ==="
end sub
