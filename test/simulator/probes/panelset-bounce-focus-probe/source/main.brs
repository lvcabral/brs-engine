' PanelSet Bounce Focus Probe - entry point. Launch with case=<bounce|bounceDirect|noUnfocus|forward|chainGate>
' and an optional run=<nonce> that tags every trace line (the device console replays older runs).
sub Main(args as dynamic)
    di = CreateObject("roDeviceInfo")
    ver = di.GetOSVersion()
    probeCase = "bounce"
    runTag = "0"
    if args <> invalid and args.case <> invalid then probeCase = args.case
    if args <> invalid and args.run <> invalid then runTag = args.run
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    g = screen.getGlobalNode()
    g.addFields({ probeCase: probeCase, probeTag: probeCase + "@" + runTag, probeSeq: 0 })
    print "PROBE|" + g.probeTag + "|0000|boot|model=" + di.GetModelDisplayName() + " os=" + ver.major + "." + ver.minor + "." + ver.revision
    scene = screen.CreateScene("ProbeScene")
    scene.probeCase = probeCase
    screen.show()
    while true
        msg = wait(0, port)
        if type(msg) = "roSGScreenEvent" and msg.isScreenClosed() then exit while
    end while
end sub
