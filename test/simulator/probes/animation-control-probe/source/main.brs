' Animation Control Probe - entry point.
'
' Answers what a real Roku does with the `control` field on Animation, ParallelAnimation and
' SequentialAnimation, for the cases brs-engine currently guesses at:
'
'   * Does control="finish" on a CONTAINER set its children's target fields to their final values?
'     (The reference says "All animated fields will be immediately set to their final values as if
'     the animation had completed" - brs-engine forwards only start/stop to children, so a container
'     finish sets nothing.)
'   * Does control="pause" on a container actually pause the children, or do they keep running while
'     the container reports state="paused"?
'   * Does control="resume" after that container pause continue, or restart from the beginning?
'   * Does control="none" stop a RUNNING animation? (The reference calls `none` the "initial state
'     with no associated action" - brs-engine routes it to stop().)
'   * Does a SequentialAnimation finish fast-forward EVERY remaining child, or only the current one?
'   * Is the target field snapped to keyValue[0] when an animation with a `delay` starts, or does it
'     hold its previous value for the whole delay?
'   * Does control="start" write keyValue[0] synchronously, or only on the next frame?
'
' Every trace record has the shape:
'
'     PROBE|<seq>|<phase>|<case>|<key=value ...>
'
' Capture on device with:  telnet <roku-ip> 8085
' Capture in the engine with:
'     node packages/node/bin/brs.cli.js --root test/simulator/probes/animation-control-probe
'
' Cases are driven off a Timer so each one gets real frames to run in; nothing here can hard-crash,
' so no registry checkpointing is needed (unlike the observer-signature probe).
sub Main()
    print "PROBE|000|boot|start|"
    di = CreateObject("roDeviceInfo")
    print "PROBE|000|boot|device|model=" + di.GetModelDisplayName() + " os=" + di.GetOSVersion().major + "." + di.GetOSVersion().minor

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("AnimProbeScene")
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
