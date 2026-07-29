sub Main()
    print "=== Task Global Observe Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    for i = 0 to 250
        msg = wait(20, port)
        if scene.done then exit for
    end for
    print "=== Task Global Observe Repro Complete ==="
end sub
