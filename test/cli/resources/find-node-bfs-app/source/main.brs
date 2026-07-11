sub Main()
    print "=== Testing findNode Breadth-First Order ==="

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)

    screen.CreateScene("MainScene")
    screen.show()

    print "=== Test Complete ==="
end sub
