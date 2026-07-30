sub Main()
    print "=== Task Crash Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    for i = 0 to 100
        msg = wait(20, port)
    end for
    ' The crash must take the app down before the render thread ever gets here.
    print "=== Task Crash Repro Complete ==="
end sub
