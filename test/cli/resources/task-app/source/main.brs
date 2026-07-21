sub Main()
    print "=== Task Thread Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    ' Pump the message loop until the Task observer fires (the scene sets `done`).
    for i = 0 to 250
        msg = wait(20, port)
        if scene.done then exit for
    end for
    print "=== Task Thread Repro Complete ==="
end sub
