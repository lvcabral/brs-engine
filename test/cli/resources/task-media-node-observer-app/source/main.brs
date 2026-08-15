sub Main()
    print "=== Task Media Node Observer Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    ' Pump the message loop until the Task signals done (matches task-app's proven-safe margin for
    ' real worker-thread startup overhead on slower/shared CI runners).
    for i = 0 to 250
        msg = wait(20, port)
        if scene.done then exit for
    end for
    print "=== Task Media Node Observer Repro Complete ==="
end sub
