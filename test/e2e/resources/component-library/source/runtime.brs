sub runUserInterface()
    screen = createObject("roSGScreen")
    m.port = createObject("roMessagePort")
    screen.setMessagePort(m.port)
    screen.createScene("RuntimeScene")
    screen.show()

    ' Pump a few frames so the deferred ComponentLibrary loadStatus notification fires.
    for i = 0 to 5
        msg = wait(50, m.port)
        if type(msg) = "roSGScreenEvent" and msg.isScreenClosed() then return
    end for
end sub
