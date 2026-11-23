' Channel components named after built-in node types (ButtonGroup, RSGPalette) replace the built-in.
' Device trace: test/simulator/probes/shadow-builtin-probe.
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

    login = CreateObject("roSGNode", "LoginButtons")
    print "subclass subtype = "; login.subtype()
    print "subclass isSubtype(ButtonGroup) = "; login.isSubtype("ButtonGroup")
    print "subclass isSubtype(LayoutGroup) = "; login.isSubtype("LayoutGroup")
    print "subclass base init = "; login.customOnly
    print "subclass own init = "; login.loginTag

    palette = CreateObject("roSGNode", "RSGPalette")
    copy = palette.clone(false)
    print "node-rooted clone subtype = "; copy.subtype()
    print "node-rooted clone has marker = "; copy.hasField("marker")

    print "=== Shadow Built-in Complete ==="
end sub
