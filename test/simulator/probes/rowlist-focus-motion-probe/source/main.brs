' RowList Focus Motion Probe - entry point.
'
' Records, frame by frame, how RowList and ZoomRowList move their focus across and within rows: in-transit
' currFocusRow/currFocusColumn, scrollingStatus, the focus fields, item focusPercent and rowFocusPercent.
' brs-engine replays the trace to time its row-list motion.
'
' Trace record shape:
'
'     PROBE|<seq>|<ms since scene init>|<kind>|<body>
'
' The probe drives itself with remote keys sent by the host: it prints `PROBE|...|await|<Key>` and
' the host answers with ECP `keypress/<Key>` (see README.md).
sub Main()
    print "PROBE|000|0|boot|start"
    ' Gives a telnet client time to reattach after the launch drops the console connections.
    sleep(8000)
    di = CreateObject("roDeviceInfo")
    print "PROBE|000|0|boot|device model=" + di.GetModelDisplayName() + " os=" + di.GetOSVersion().major + "." + di.GetOSVersion().minor

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

    print "PROBE|999|0|boot|end"
    sleep(5000)
end sub
