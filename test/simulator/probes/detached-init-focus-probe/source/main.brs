sub Main()
    sleep(8000)
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("ProbeScene")
    screen.show()
    scene.callFunc("runProbe", {})
    print "PROBE|done"
    while true
        msg = wait(0, port)
        if type(msg) = "roSGScreenEvent" and msg.isScreenClosed() then return
    end while
end sub
