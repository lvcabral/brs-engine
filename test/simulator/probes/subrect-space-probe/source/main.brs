sub Main()
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.createScene("SubRectScene")
    screen.show()
    sleep(2500)
    scene.callFunc("measure", "before")
    scene.callFunc("jump", invalid)
    sleep(2500)
    scene.callFunc("measure", "after")
    print "PROBE|done"
    while true
        msg = wait(0, port)
        if type(msg) = "roSGScreenEvent" and msg.isScreenClosed() then return
    end while
end sub
