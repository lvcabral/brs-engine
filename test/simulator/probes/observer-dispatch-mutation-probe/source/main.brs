' Observer Dispatch Mutation Probe - entry point.
'
' Answers: when an observer callback registers or removes observers of the field being dispatched,
' which callbacks run for that same change? The scene runs the cases; this loop keeps the app alive.
'
' Trace records:  PROBE|<case>|<key=value ...>
sub Main()
    print "PROBE|boot|start"
    di = CreateObject("roDeviceInfo")
    print "PROBE|boot|device|model=" + di.GetModelDisplayName() + " os=" + di.GetOSVersion().major + "." + di.GetOSVersion().minor
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MutationProbeScene")
    screen.show()
    while true
        msg = wait(500, port)
        if type(msg) = "roSGScreenEvent"
            if msg.isScreenClosed() then exit while
        end if
        if scene.probeExit then exit while
    end while
end sub
