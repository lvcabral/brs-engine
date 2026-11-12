' MarkupGrid Focus Resize Probe - entry point.
'
' A two-column MarkupGrid whose columns (columnWidths) and rows (rowHeights) differ in size, plus a
' MarkupList and a LabelList with varying rowHeights. Shows how the focus indicator's size changes while
' the focus moves between a small and a large item. Launch parameters: `node` picks grid (default), mlist
' or llist; `style` sets vertFocusAnimationStyle (ECP: launch/dev?node=mlist&style=fixedFocusWrap). The
' host drives the keys and takes screenshots (see README.md).
sub Main(args as dynamic)
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("ProbeScene")
    screen.show()
    if args <> invalid and args.node <> invalid then scene.node = args.node
    style = "floatingFocus"
    if args <> invalid and args.style <> invalid then style = args.style
    scene.style = style
    print "PROBE|ready|" + style
    while true
        msg = wait(0, port)
        if type(msg) = "roSGScreenEvent" and msg.isScreenClosed() then exit while
    end while
end sub
