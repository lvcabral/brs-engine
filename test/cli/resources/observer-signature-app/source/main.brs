sub Main()
    print "=== Observer Signature Test ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    ' The synchronous cases all run from init(); the Timer `fire` case needs the message loop.
    for i = 0 to 50
        msg = wait(20, port)
        if scene.testDone then exit for
    end for
    print "=== Observer Signature Test Complete ==="
end sub
