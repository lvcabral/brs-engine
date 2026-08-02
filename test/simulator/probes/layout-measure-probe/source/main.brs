' Layout Measure Probe - entry point.
'
' Measures four layout/measurement behaviors brs-engine currently guesses at. Everything here is
' read back through boundingRect()/sceneBoundingRect() or a plain field read, so the whole probe is
' programmatic - no screenshots needed (except the one clipping case, which is flagged in the README).
'
'   * LabelList: does it honor rowHeights / rowSpacings at all, and what is the undocumented
'     one-pixel gap the engine adds between rows (itemSize.y + 1)?
'   * PosterGrid: when rowSpacings/columnSpacings has FEWER entries than tracks, does the last entry
'     repeat (what the engine does) or does it fall back to itemSpacing (what the ArrayGrid
'     reference says)? LayoutGroup.itemSpacings is device-confirmed to repeat, so these may
'     legitimately differ - which is exactly why it needs measuring.
'   * A rotated container: does a child's own translation get rotated by the inherited angle? The
'     engine has two different behaviors depending on node type (Group and the keyboard/text-entry
'     containers do not rotate; 18 renderable types do), and the split looks accidental.
'   * clippingRect vs renderTracking: the Group reference says a node can be inside a clippingRect
'     and still report renderTracking="none" when the portion of the clippingRect it occupies is
'     entirely offscreen. The engine never consults clippingRect when computing renderTracking.
'
' Every trace record has the shape:
'
'     PROBE|<seq>|<phase>|<case>|<key=value ...>
'
' Capture on device with:  telnet <roku-ip> 8085
' Capture in the engine with:
'     node packages/node/bin/brs.cli.js --root test/simulator/probes/layout-measure-probe
sub Main()
    print "PROBE|000|boot|start|"
    di = CreateObject("roDeviceInfo")
    print "PROBE|000|boot|device|model=" + di.GetModelDisplayName() + " os=" + di.GetOSVersion().major + "." + di.GetOSVersion().minor

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MeasureProbeScene")
    screen.show()

    while true
        msg = wait(500, port)
        if type(msg) = "roSGScreenEvent"
            if msg.isScreenClosed() then exit while
        end if
        if scene.probeExit then exit while
    end while

    print "PROBE|999|boot|end|"
end sub
