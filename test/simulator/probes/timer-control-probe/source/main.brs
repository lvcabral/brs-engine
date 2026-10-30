' Timer Control Probe - entry point.
'
' Answers what a real Roku reports in a Timer's `control` field around its lifecycle, which
' brs-engine guesses at (see README.md). Every trace record has the shape:
'
'     PROBE|<seq>|<case>|<key=value ...>
'
' Capture on device with:  telnet <roku-ip> 8085
' Capture in the engine with:
'     node packages/node/bin/brs.cli.js --root test/simulator/probes/timer-control-probe
sub Main()
    print "PROBE|000|boot|start"
    di = CreateObject("roDeviceInfo")
    print "PROBE|000|boot|device model=" + di.GetModelDisplayName() + " os=" + di.GetOSVersion().major + "." + di.GetOSVersion().minor

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("TimerProbeScene")
    screen.show()

    while true
        msg = wait(500, port)
        if type(msg) = "roSGScreenEvent"
            if msg.isScreenClosed() then exit while
        end if
        if scene.probeExit then exit while
    end while

    print "PROBE|999|boot|end"
end sub
