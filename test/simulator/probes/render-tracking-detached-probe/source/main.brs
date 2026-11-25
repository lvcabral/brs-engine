' Render Tracking Detached Probe - entry point.
'
' Does measuring a node that is NOT in the scene tree (boundingRect()/localBoundingRect() on a node
' or its descendant before appendChild) change its renderTracking, and does renderTracking change
' when a tracked node is attached and later removed? See README.md.
'
' Trace records:  PROBE|<seq>|<case>|<label>|<value>
sub Main()
    print "PROBE|000|boot|start|"
    di = CreateObject("roDeviceInfo")
    print "PROBE|000|boot|device|model=" + di.GetModelDisplayName() + " os=" + di.GetOSVersion().major + "." + di.GetOSVersion().minor

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("RTProbeScene")
    screen.show()

    while true
        msg = wait(500, port)
        if type(msg) = "roSGScreenEvent"
            if msg.isScreenClosed() then return
        end if
    end while
end sub
