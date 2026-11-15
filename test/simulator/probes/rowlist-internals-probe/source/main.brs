' RowList Internals Probe - entry point.
'
' Dumps the internal node tree a device builds under a RowList (and a ZoomRowList): the parent chain of each
' item component, the internal nodes' subtypes, type hierarchy and fields, and whether they are recycled as
' the list scrolls. See README.md for the scripted capture (drive.sh answers the PROBE|<seq>|await| lines).
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
