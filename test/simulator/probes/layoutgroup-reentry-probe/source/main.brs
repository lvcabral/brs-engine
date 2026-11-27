' LayoutGroup Reentry Probe - entry point.
'
' Answers: when a LayoutGroup child observes its own translation and calls boundingRect() on the
' group from that observer, when does the observer run, what does it see, and where do the children
' end up? The scene runs the cases; this loop keeps the app alive.
'
' Trace records:  PROBE|<case>|<stage>|<key=value ...>
sub Main()
    print "PROBE|start"
    di = CreateObject("roDeviceInfo")
    print "PROBE|boot|device|model=" + di.GetModelDisplayName() + " os=" + di.GetOSVersion().major + "." + di.GetOSVersion().minor
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("ReentryScene")
    screen.show()
    while true
        msg = wait(500, port)
        if type(msg) = "roSGScreenEvent"
            if msg.isScreenClosed() then exit while
        end if
        if scene.probeExit then exit while
    end while
end sub
