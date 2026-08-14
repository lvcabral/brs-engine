' Task Media Node Probe - entry point.
'
' Answers: what happens when a Task thread (a non-rendering context) creates and drives Poster /
' AnimatedImage nodes -- CreateObject, uri loading, and observer dispatch, both for a directly
' created node and for one whose uri is an XML attribute (the construction-vs-init() timing case).
'
' Every trace record has the shape:
'
'     PROBE|<seq>|<phase>|<case>|<key=value ...>
'
' Capture on device with:  telnet <roku-ip> 8085
' Capture in the engine with:  brs-cli test/simulator/probes/task-media-node-probe
sub Main()
    print "PROBE|000|boot|start|"
    di = CreateObject("roDeviceInfo")
    print "PROBE|000|boot|device|model=" + di.GetModelDisplayName() + " os=" + di.GetOSVersion().major + "." + di.GetOSVersion().minor

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()

    for i = 0 to 250
        msg = wait(20, port)
        if type(msg) = "roSGScreenEvent"
            if msg.isScreenClosed() then exit for
        end if
        if scene.done then exit for
    end for

    print "PROBE|999|boot|end|"
end sub
