' TrickPlayBar Children Probe - entry point.
'
' Dumps the internal child tree of Video.trickPlayBar (and the sibling bufferingBar/retrievingBar and a
' standalone TrickPlayBar) so brs-engine can replicate the order and shape a device builds. Apps such as
' jellyfin-roku index into it (trickPlayBar.getChild(8) is the position Label), see issue #1294.
'
' Trace record shape:
'
'     PROBE|<seq>|<phase>|<case>|<key=value ...>
'
' Capture on device with:  telnet <roku-ip> 8085   (see README.md for the scripted capture)
' Capture in the engine with:
'     node packages/node/bin/brs.cli.js --root test/simulator/probes/trickplaybar-children-probe
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
    sleep(5000)
end sub
