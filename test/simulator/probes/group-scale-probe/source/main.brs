' Group Scale Probe - entry point.
'
' Measures how a Group's scale / rotation / scaleRotateCenter propagate to descendants, to settle the
' review findings on PR #1257. Everything is read back through localBoundingRect() / boundingRect() /
' sceneBoundingRect() (and sceneSubBoundingRect for PosterGrid items). The scene also stays on screen
' for a while after the trace so a screenshot can be taken for the visual-only cases (MaskGroup,
' PosterGrid item placement).
'
' Every trace record has the shape:
'
'     PROBE|<seq>|<case>|<node>|<key=value ...>
'
' Capture on device with:  telnet <roku-ip> 8085
' Capture in the engine with:
'     node packages/node/bin/brs.cli.js --root test/simulator/probes/group-scale-probe
'
' Launch param `scene=review` runs page 2 (GroupScaleReviewScene, the PR #1291 review cases);
' `run=<nonce>` is echoed on the start line to tell a fresh device run from console replays.
sub Main(args as dynamic)
    sceneName = "GroupScaleScene"
    runId = ""
    if type(args) = "roAssociativeArray"
        if args.scene = "review" then sceneName = "GroupScaleReviewScene"
        if args.run <> invalid then runId = args.run
    end if
    print "PROBE|000|boot|start|scene=" + sceneName + " run=" + runId
    di = CreateObject("roDeviceInfo")
    print "PROBE|000|boot|device|model=" + di.GetModelDisplayName() + " os=" + di.GetOSVersion().major + "." + di.GetOSVersion().minor

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene(sceneName)
    screen.show()

    holdUntil = invalid
    clock = CreateObject("roTimespan")
    while true
        msg = wait(250, port)
        if type(msg) = "roSGScreenEvent"
            if msg.isScreenClosed() then exit while
        end if
        if holdUntil = invalid and scene.probeExit then holdUntil = clock.TotalMilliseconds() + 8000
        if holdUntil <> invalid and clock.TotalMilliseconds() > holdUntil then exit while
    end while

    print "PROBE|999|boot|end|"
end sub
