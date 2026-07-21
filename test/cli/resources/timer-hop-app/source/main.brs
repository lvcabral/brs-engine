sub Main()
    print "=== Timer Hop Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    for i = 0 to 200
        msg = wait(20, port)
    end for
    print "=== Timer Hop Repro Complete ==="
end sub
