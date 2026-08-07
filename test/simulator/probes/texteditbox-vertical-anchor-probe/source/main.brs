' TextEditBox Vertical Anchor Probe - entry point.
'
' Question: when a TextEditBox's built-in background is hidden (backgroundUri set to a real,
' non-empty URI - the common pattern for apps that draw their own background), where does the
' rendered text land relative to the box's own `translation.y`?
'   - TOP-ANCHORED:    text starts AT translation.y and extends downward (standard SG top-left
'                       translation convention).
'   - CENTER-ANCHORED: translation.y is the vertical CENTER of the rendered line, text extends
'                       both above and below it.
' brs-engine (the simulator) now assumes CENTER-ANCHORED for this case, inferred from a real
' app's own layout numbers, not a device reading. This probe settles it with one.
'
' Read the on-screen ruler (ticks are labeled with their pixel offset from translation.y; the red
' tick is offset 0) to see exactly where the glyphs start/end, and check the printed
' boundingRect() values via telnet for the exact reported box height in each mode.
'
' Capture on device with:  telnet <roku-ip> 8085
' Capture in the engine with:
'     node packages/node/bin/brs.cli.js --root test/simulator/probes/texteditbox-vertical-anchor-probe
sub Main()
    print "PROBE|000|boot|start|"
    di = CreateObject("roDeviceInfo")
    print "PROBE|000|boot|device|model=" + di.GetModelDisplayName() + " os=" + di.GetOSVersion().major + "." + di.GetOSVersion().minor
    ui = di.GetUIResolution()
    print "PROBE|000|boot|ui|" + ui.name + " " + str(ui.width).trim() + "x" + str(ui.height).trim()

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("TextEditBoxProbeScene")
    screen.show()

    ' Stays on screen indefinitely - take the device screenshot (Developer Settings) while it is
    ' up, then press Home/Back to exit. The numeric boundingRect() readings print to telnet a
    ' short moment after boot (once layout has settled), no interaction needed for those.
    while true
        msg = wait(0, port)
        if type(msg) = "roSGScreenEvent"
            if msg.isScreenClosed() then exit while
        end if
    end while

    print "PROBE|999|boot|end|"
end sub
