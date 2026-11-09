' List Focus Dispatch Probe - entry point.
'
' Scripted (see README.md). Main writes the scene's `trigger` field when the scene asks for it through
' `wantTrigger`, so some steps run inside a field observer raised from the main thread rather than a Timer.
sub Main(args as dynamic)
    ' The device console drops its clients on launch: give the host time to reconnect.
    sleep(8000)
    print "PROBE|boot"
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("ProbeScene")
    screen.show()
    sent = ""
    while true
        msg = wait(100, port)
        if type(msg) = "roSGScreenEvent" and msg.isScreenClosed() then exit while
        want = scene.wantTrigger
        if want <> "" and want <> sent
            sent = want
            scene.trigger = want
        end if
    end while
end sub
