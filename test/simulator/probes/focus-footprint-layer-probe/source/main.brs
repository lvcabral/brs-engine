' Focus Footprint Layer Probe - entry point.
'
' Shows how a device draws the focus footprint of a list that has lost the focus: over or under its
' items. Launch parameters (ECP launch/dev?...): target=<id> (default "other", a Button, so every list is
' unfocused), fp=green (an opaque footprint), ontop=false|true (writes drawFocusFeedbackOnTop).
sub Main(args as dynamic)
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("ProbeScene")
    screen.show()
    target = "other"
    if args <> invalid and args.target <> invalid then target = args.target
    if args <> invalid and args.fp = "green" then scene.footprint = "pkg:/images/green.png"
    if args <> invalid and args.ontop <> invalid then scene.onTop = args.ontop
    scene.target = target
    print "PROBE|ready|" + target
    while true
        msg = wait(0, port)
        if type(msg) = "roSGScreenEvent" and msg.isScreenClosed() then exit while
    end while
end sub
