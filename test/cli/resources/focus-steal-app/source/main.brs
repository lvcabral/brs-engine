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
    for i = 0 to 5
        msg = wait(20, port)
    end for
    print "=== Focus Steal Repro Complete ==="
end sub
