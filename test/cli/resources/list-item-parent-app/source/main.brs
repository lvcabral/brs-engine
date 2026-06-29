sub Main()
    print "=== List Item Parent Repro ==="

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)

    scene = screen.CreateScene("ServerScene")
    screen.show()

    list = scene.findNode("serverPicker")
    content = CreateObject("roSGNode", "ContentNode")
    item = content.createChild("ContentNode")
    item.title = "Server 1"
    list.content = content

    ' Force a layout pass so the list creates its item components and their init() runs.
    list.boundingRect()

    print "=== List Item Parent Repro Complete ==="
end sub
