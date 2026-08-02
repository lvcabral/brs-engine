' PosterGrid Row-Axis Probe - entry point.
'
' The column axis is solved (test/simulator/probes/postergrid-spacing-probe): a device computes
'
'     width = SUM over ALL N columns of (posterWidth + spacing_i) + 2 * marginX
'     spacing_i = columnSpacings[i] ?? itemSpacing.x        (fall back, NOT repeat the last entry)
'     marginX = marginY = 14 ; basePosterSize honored ; columnWidths IGNORED
'
' This probe does the same for the ROW axis, which that run could not touch because every fixture
' was a single row. Three open questions:
'
'   1. Does the row axis mirror the column axis - a trailing gap after the LAST row, and
'      rowSpacings falling back to itemSpacing.y rather than repeating its last entry?
'   2. Is rowHeights honored, or ignored the way columnWidths turned out to be?
'   3. What is the unexplained +36 in a cell's height? A 100-tall poster produced a 136-tall cell
'      with captions nominally off. The hypothesis is a reserved caption zone
'      (showBackgroundForEmptyCaptions defaults to true); R2/R3 test that directly.
'
' Every fixture is ONE COLUMN, so the width axis contributes a known constant (100 + 28) and only
' the height has to be decoded.
'
' Capture on device with:  telnet <roku-ip> 8085
' Capture in the engine with:
'     node packages/node/bin/brs.cli.js --root test/simulator/probes/postergrid-rows-probe
sub Main()
    print "PROBE|000|boot|start|"
    di = CreateObject("roDeviceInfo")
    print "PROBE|000|boot|device|model=" + di.GetModelDisplayName() + " os=" + di.GetOSVersion().major + "." + di.GetOSVersion().minor
    print "PROBE|000|boot|ui|" + di.GetUIResolution().name + " " + str(di.GetUIResolution().width).trim() + "x" + str(di.GetUIResolution().height).trim()

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("PosterRowsScene")
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
