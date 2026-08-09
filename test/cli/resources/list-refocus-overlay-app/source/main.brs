sub Main()
    print "=== List Refocus Overlay Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()

    ' Let the scene render and settle before arming the scenario.
    for i = 0 to 3
        msg = wait(20, port)
    end for
    scene.callFunc("startScenario")

    for i = 0 to 3
        msg = wait(20, port)
    end for
    ' The whole (A)(B)(C) handler runs inside this one call, as a key handler would.
    scene.callFunc("pressDown")

    ' Sample while the scroll is still in flight (a few frames in, well under the ~340ms duration).
    for i = 0 to 2
        msg = wait(20, port)
    end for
    scene.callFunc("reportInFlight")

    ' Pump well past the ~340ms scroll so the animation completes and settles.
    for i = 0 to 40
        msg = wait(20, port)
    end for
    scene.callFunc("report")
    print "=== List Refocus Overlay Repro Complete ==="
end sub
