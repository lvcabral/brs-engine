sub Main()
    print "=== Task Selfcall Observer Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    for i = 0 to 250
        msg = wait(20, port)
        if scene.finished then exit for
    end for
    print "=== Task Selfcall Observer Repro Complete ==="
end sub
