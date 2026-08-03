sub Main()
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.createScene("OutsetAxisScene")
    screen.show()

    ' Driven from here, and the screen closes as soon as the probe finishes: this probe is entirely
    ' numeric (unlike the margins probe's group P, nothing here is read from a screenshot), so it should
    ' print and exit rather than block Main on the port forever.
    scene.callFunc("runProbe", invalid)
    screen.close()

    while true
        msg = wait(0, port)
        if type(msg) = "roSGScreenEvent" and msg.isScreenClosed() then return
    end while
end sub
