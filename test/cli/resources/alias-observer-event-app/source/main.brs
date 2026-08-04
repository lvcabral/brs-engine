sub Main()
    print "=== Testing Alias Field Observer Event Name ==="

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)

    scene = screen.CreateScene("AliasObserverTest")
    screen.show()

    ' Observe the alias by its own declared name, via a message port (matches real-world usage).
    scene.observeField("aliasField", port)

    ' Trigger the alias's shared field through the target child.
    child = scene.findNode("child")
    child.text = "Hello, World!"

    msg = wait(0, port)
    if type(msg) = "roSGNodeEvent"
        print "field: "; msg.getField()
        print "data: "; msg.getData()
    else
        print "no event received"
    end if

    print "=== Test Complete ==="
end sub
