sub Main()
    print "=== ButtonGroup Custom Children Repro ==="

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)

    scene = screen.CreateScene("MainScene")
    screen.show()
    scene.setFocus(true)

    row = scene.findNode("buttonRow")
    leftButton = scene.findNode("leftButton")
    rightButton = scene.findNode("rightButton")

    ' Force a layout/measurement pass, then verify the horizontal layout is honored.
    rect = row.boundingRect()
    leftTrans = leftButton.translation
    rightTrans = rightButton.translation
    print "left x = "; Int(leftTrans[0])
    print "right x = "; Int(rightTrans[0])

    ' The custom children keep their own text — the group must not overwrite it.
    print "left text = "; leftButton.text
    print "right text = "; rightButton.text

    ' Focus the right button directly (as app screens do); the group must not steal it back.
    rightButton.setFocus(true)
    rect = row.boundingRect()
    print "right hasFocus = "; rightButton.hasFocus()

    ' Switch focus to the left button and verify layout stayed stable across focus changes.
    leftButton.setFocus(true)
    rect = row.boundingRect()
    print "left hasFocus = "; leftButton.hasFocus()
    print "right x after focus = "; Int(rightButton.translation[0])
    print "children count = "; row.getChildCount()

    print "=== ButtonGroup Custom Children Complete ==="
end sub
