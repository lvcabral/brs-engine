' MarkupGrid Item Index Probe - entry point.
'
' Records which list/grid item components get the documented `index` field, when, and how it follows
' recycled components while the grid scrolls. See README.md for the scripted capture.
'
' Trace record shape:
'
'     PROBE|<seq>|<phase>|<case>|<key=value ...>
sub Main()
    print "PROBE|000|boot|start|"
    ' Gives a telnet client time to reattach after the launch drops the console connections.
    sleep(8000)
    di = CreateObject("roDeviceInfo")
    print "PROBE|000|boot|device|model=" + di.GetModelDisplayName() + " os=" + di.GetOSVersion().major + "." + di.GetOSVersion().minor

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("ProbeScene")
    screen.show()

    while true
        msg = wait(500, port)
        if type(msg) = "roSGScreenEvent"
            if msg.isScreenClosed() then exit while
        end if
        if scene.probeExit then exit while
    end while

    print "PROBE|999|boot|end|"
    sleep(3000)
end sub
