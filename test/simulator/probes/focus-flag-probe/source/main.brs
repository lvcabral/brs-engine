' Focus Flag Probe - entry point (see README.md). Scripted; prints PROBE| lines and exits.
sub Main(args as dynamic)
    sleep(8000)
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("ProbeScene")
    screen.show()
    while true
        msg = wait(200, port)
        if type(msg) = "roSGScreenEvent" and msg.isScreenClosed() then exit while
        if scene.probeExit then exit while
    end while
end sub
