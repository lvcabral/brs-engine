sub Main()
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.createScene("ProbeScene")
    screen.show()

    ' Driven from here rather than from init() so the probe exits when it is done: a scene that
    ' finishes measuring inside init() leaves Main blocked on the port forever, which makes the
    ' engine-side run (brs-cli) hang instead of printing and returning.
    scene.callFunc("runProbe", invalid)
    screen.close()

    while true
        msg = wait(0, port)
        if type(msg) = "roSGScreenEvent" and msg.isScreenClosed() then return
    end while
end sub
