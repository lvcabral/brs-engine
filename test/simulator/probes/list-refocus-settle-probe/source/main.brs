' List Refocus Settle Probe - entry point.
'
' Prints a machine-diffable trace of WHETHER and WHEN a RowList re-publishes its focus-settle fields
' when the list is handed focus without its focused position having moved. Every trace record has
' the shape:
'
'     PROBE|<seq>|<scenario>|<point>|<key=value ...>
'
' Capture on device with:  telnet <roku-ip> 8085
' Capture in the engine with:  brs-cli test/simulator/probes/list-refocus-settle-probe
sub Main()
    print "PROBE|000|boot|start|"
    di = CreateObject("roDeviceInfo")
    print "PROBE|000|boot|device|model=" + di.GetModelDisplayName() + " os=" + di.GetOSVersion().major + "." + di.GetOSVersion().minor

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("RefocusProbeScene")
    screen.show()

    ' Pump the message loop. The scene drives the scenarios from a repeating Timer, so this loop only
    ' has to stay alive and let the render thread run.
    while true
        msg = wait(500, port)
        if type(msg) = "roSGScreenEvent"
            if msg.isScreenClosed() then exit while
        end if
        if scene.probeExit then exit while
    end while

    print "PROBE|999|boot|end|"
end sub
