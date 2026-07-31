sub Main()
    print "=== Focus Steal Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    ' Drive the scenarios from OUTSIDE init(): focus notifications raised during init() are deferred
    ' to the message loop, which is a separate code path (see init-focus-observer-app).
    scene.callFunc("runScenarios")

    ' The button's focused font only takes effect on a paint pass, so measure across frames.
    scene.callFunc("measureButton", "before")
    scene.callFunc("focusButton")
    for i = 0 to 3
        msg = wait(20, port)
    end for
    scene.callFunc("measureButton", "after")

    for i = 0 to 5
        msg = wait(20, port)
    end for
    print "=== Focus Steal Repro Complete ==="
end sub
