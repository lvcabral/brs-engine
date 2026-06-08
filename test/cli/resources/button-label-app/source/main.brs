sub Main()
    print "=== Button Label Repro ==="

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)

    scene = screen.CreateScene("ButtonScene")
    screen.show()

    button = scene.findNode("myButton")
    label = scene.findNode("innerLabel")

    button.text = "Save"
    print "label.text = "; label.text

    print "=== Button Label Repro Complete ==="
end sub
