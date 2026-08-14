sub Main()
    print "=== AnimatedImage Init Observer Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    ' Pump a few frames so the state transitions buffered during construction (queued while init()
    ' hadn't yet registered an observer) are replayed from the message loop after init returns.
    for i = 0 to 5
        msg = wait(20, port)
    end for
    print "=== AnimatedImage Init Observer Repro Complete ==="
end sub
