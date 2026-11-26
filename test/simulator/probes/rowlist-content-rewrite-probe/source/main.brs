' RowList Content Rewrite Probe - entry point.
'
' Answers: when does a RowList re-assign an item component's itemContent after the item's ContentNode
' is written? Covers writes from the item's own itemContent observer (unchanged value through update(),
' unchanged value through assignment, a new value each call) and writes from the scene, plus whether a
' write notifies a plain node's field holding the same ContentNode.
'
' Trace records:  PROBE|<what>|<key=value ...>
sub Main()
    print "PROBE|boot|start"
    di = CreateObject("roDeviceInfo")
    print "PROBE|boot|device|model=" + di.GetModelDisplayName() + " os=" + di.GetOSVersion().major + "." + di.GetOSVersion().minor
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("RewriteProbeScene")
    screen.show()
    while true
        msg = wait(500, port)
        if type(msg) = "roSGScreenEvent"
            if msg.isScreenClosed() then exit while
        end if
        if scene.probeExit then exit while
    end while
end sub
