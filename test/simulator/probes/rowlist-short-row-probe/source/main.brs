' RowList Short Row Probe - entry point.
'
' Rows of 20, 2 and 30 items (the 2-item row fits on screen, so its focus floats). Shows which column a
' row change lands on when it comes from, or goes into, the short row, and where the focus indicator
' travels meanwhile. The launch parameter `style` sets rowFocusAnimationStyle (ECP:
' launch/dev?style=fixedFocus). The host drives the keys and takes screenshots (see README.md).
sub Main(args as dynamic)
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("ProbeScene")
    screen.show()
    style = "fixedFocusWrap"
    if args <> invalid and args.style <> invalid then style = args.style
    scene.style = style
    print "PROBE|ready|" + style
    while true
        msg = wait(0, port)
        if type(msg) = "roSGScreenEvent" and msg.isScreenClosed() then exit while
    end while
end sub
