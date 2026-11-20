' A channel may ship a component whose name is also a built-in SceneGraph node type.
' On a device the channel's definition wins: <ButtonGroup> here is the component below,
' not the built-in ButtonGroup. The engine used to return the built-in class, so the
' component's init() never ran and the first key event it received crashed on `m.top`.
sub Main()
    print "=== Shadow Built-in Repro ==="

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)

    scene = screen.CreateScene("MainScene")
    screen.show()

    grp = scene.findNode("grp")
    print "node subtype = "; grp.subtype()
    print "init ran = "; grp.initRan
    print "custom field = "; grp.customOnly
    print "inherited field = "; grp.layoutDirection
    print "child made in init = "; grp.findNode("madeInInit") <> invalid
    print "child count = "; grp.getChildCount()

    print "=== Shadow Built-in Complete ==="
end sub
