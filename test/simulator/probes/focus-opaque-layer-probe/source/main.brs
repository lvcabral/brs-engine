' Focus Opaque Layer Probe - entry point.
'
' Shows how a device layers a fully OPAQUE focus bitmap against an item's content while the focus moves:
' each node's items are plain white text and its focusBitmapUri is a solid orange image. The launch
' parameter `target` picks the focused node (ECP: launch/dev?target=<id>). The host holds a key and takes
' a dev-mode screenshot mid-motion (see README.md).
sub Main(args as dynamic)
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("ProbeScene")
    screen.show()
    target = "side"
    if args <> invalid and args.target <> invalid then target = args.target
    if args <> invalid and args.bitmap = "9" then scene.bitmap = "pkg:/images/solid.9.png"
    if args <> invalid and args.ontop <> invalid then scene.onTop = args.ontop
    scene.target = target
    print "PROBE|ready|" + target
    while true
        msg = wait(0, port)
        if type(msg) = "roSGScreenEvent" and msg.isScreenClosed() then exit while
    end while
end sub
