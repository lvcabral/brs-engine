' PosterGrid Spacing Probe - entry point.
'
' A first pass (test/simulator/probes/layout-measure-probe, case P) could not be decoded: the reported rect did not
' decompose into either candidate answer, because poster size, focus margins and gap spacing were all
' unknown at once. This probe pins them down ONE AT A TIME, every case a SINGLE ROW so the row axis
' contributes nothing.
'
' The question that matters: when columnSpacings has FEWER entries than there are gaps, does the last
' entry REPEAT (what brs-engine does, PosterGrid.resolveSpacingValue -> values.at(-1)) or do the
' remaining gaps fall back to itemSpacing.x (what the ArrayGrid reference says)?
'
' Solve in this order:
'   P1  1 column, no gaps        -> marginX/marginY, and whether basePosterSize is honored at all
'   P2  1 column, columnWidths   -> does columnWidths override basePosterSize?
'   P3  3 columns, no arrays     -> confirms plain itemSpacing.x is used for every gap
'   P4  3 columns, [10]  (short) -> THE DISCRIMINATOR: repeat (10+10) vs fall back (10+50)
'   P5  3 columns, [10,20] (full)-> control: both gaps explicit
'
' With marginX known from P1 and the poster width known from P1/P2, P4 has exactly one unknown.
'
' Capture on device with:  telnet <roku-ip> 8085
' Capture in the engine with:
'     node packages/node/bin/brs.cli.js --root test/simulator/probes/postergrid-spacing-probe
sub Main()
    print "PROBE|000|boot|start|"
    di = CreateObject("roDeviceInfo")
    print "PROBE|000|boot|device|model=" + di.GetModelDisplayName() + " os=" + di.GetOSVersion().major + "." + di.GetOSVersion().minor
    print "PROBE|000|boot|ui|" + di.GetUIResolution().name + " " + str(di.GetUIResolution().width).trim() + "x" + str(di.GetUIResolution().height).trim()

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("PosterProbeScene")
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
