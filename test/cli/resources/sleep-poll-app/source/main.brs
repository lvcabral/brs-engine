sub main()
    print "=== Sleep Poll Main Loop Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()

    ' Mirrors a real-world app's main loop: instead of the idiomatic `wait(timeout, port)`,
    ' it polls with sleep() + getMessage()/peekMessage().
    appIsAlive = true
    iterations = 0
    while appIsAlive and iterations < 200
        msg = port.getMessage()
        if type(msg) = "roSGScreenEvent"
            if msg.isScreenClosed() then appIsAlive = false
        end if
        if port.peekMessage() = invalid then sleep(16)
        if scene.exitApp then appIsAlive = false
        iterations = iterations + 1
    end while
    print "=== Sleep Poll Main Loop Repro Complete ==="
end sub
