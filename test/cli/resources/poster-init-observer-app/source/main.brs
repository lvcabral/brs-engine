sub Main()
    print "=== Poster Init Observer Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    ' Pump a few frames so the loadStatus transition buffered during construction (queued while
    ' init() hadn't yet registered an observer) is replayed from the message loop after init returns.
    for i = 0 to 5
        msg = wait(20, port)
    end for
    print "=== Poster Init Observer Repro Complete ==="
end sub
