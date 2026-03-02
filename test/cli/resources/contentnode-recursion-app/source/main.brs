sub Main()
    print "=== ContentNode Recursion Repro ==="

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)

    scene = screen.CreateScene("ContentLoopScene")
    screen.show()

    sleep(400)

    print "=== ContentNode Recursion Repro Complete ==="
end sub
