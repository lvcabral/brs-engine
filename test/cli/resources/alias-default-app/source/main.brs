sub Main()
    print "=== Testing Aliased Field Default ==="

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)

    scene = screen.CreateScene("AliasDefaultTest")
    screen.show()

    ' The default must reach the parent alias field and every aliased child field.
    print "scene.boxHeight = "; scene.boxHeight.toStr()
    print "box1.height = "; scene.findNode("box1").height.toStr()
    print "box2.height = "; scene.findNode("box2").height.toStr()

    ' Single-target aliased default.
    print "scene.boxWidth = "; scene.boxWidth.toStr()
    print "box1.width = "; scene.findNode("box1").width.toStr()

    ' A field declared after the aliased defaults must still exist (no addFields cascade).
    print "scene.trailing = "; scene.trailing

    print "=== Test Complete ==="
end sub
