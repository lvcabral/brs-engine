sub Main()
    print "=== Shared ContentNode Recursion Repro ==="

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)

    scene = screen.CreateScene("SharedContentScene")
    screen.show()

    sleep(400)

    print "=== Shared ContentNode Recursion Repro Complete ==="
end sub
