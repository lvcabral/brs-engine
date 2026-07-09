sub Main()
    print "=== Anon Observer Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    ' Pump the message loop so the Timer node can fire; the observer prints once it runs.
    for i = 0 to 50
        msg = wait(20, port)
    end for
    print "=== Anon Observer Repro Complete ==="
end sub
