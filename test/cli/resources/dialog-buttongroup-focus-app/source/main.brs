sub Main()
    print "=== Dialog ButtonGroup Focus Repro ==="

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)

    scene = screen.CreateScene("MainScene")
    screen.show()
    scene.setFocus(true)

    dialog = CreateObject("roSGNode", "MyDialog")
    dialog.callFunc("setup")

    scene.sceneDialog = dialog

    buttons = dialog.findNode("buttons")
    print "after show: isInFocusChain = "; buttons.isInFocusChain()

    ' Move focus away, then re-focus the dialog (the framework must re-deliver focus to the buttons).
    nullFocus = scene.findNode("nullFocus")
    nullFocus.setFocus(true)
    dialog.setFocus(true)
    print "after refocus: isInFocusChain = "; buttons.isInFocusChain()

    print "=== Dialog ButtonGroup Focus Complete ==="
end sub
