' Observer Signature Probe - entry point.
'
' Answers: when a function is registered as an observer callback via observeField(field, "funcName"),
' how does Roku bind the roSGNodeEvent to the callback's declared parameters?
'
'   * Is the event passed when the first parameter is declared with an incompatible type (as string)?
'   * Is a declared default value used instead, or is the event forced in anyway?
'   * Is the event coerced to the declared type?
'   * What happens when the parameter is REQUIRED and incompatible (crash, skip, or pass anyway)?
'   * Are trailing parameters bound to their defaults or left uninitialized?
'
' Every trace record has the shape:
'
'     PROBE|<seq>|<phase>|<case>|<key=value ...>
'
' Capture on device with:  telnet <roku-ip> 8085
' Capture in the engine with:  brs-cli test/simulator/probes/observer-signature-probe
'
' The probe checkpoints its progress in the registry, so if a case hard-crashes the app on a real
' device, simply relaunching resumes at the NEXT case and the run completes across several launches.
' The last "begin" record printed before a crash names the case that crashed.
' Delete the checkpoint with a full-run reset by launching after the probe printed "all|done".
sub Main()
    print "PROBE|000|boot|start|"
    di = CreateObject("roDeviceInfo")
    print "PROBE|000|boot|device|model=" + di.GetModelDisplayName() + " os=" + di.GetOSVersion().major + "." + di.GetOSVersion().minor

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("SigProbeScene")
    screen.show()

    ' The scene drives every scenario; this loop only keeps the app alive.
    while true
        msg = wait(500, port)
        if type(msg) = "roSGScreenEvent"
            if msg.isScreenClosed() then exit while
        end if
        if scene.probeExit then exit while
    end while

    print "PROBE|999|boot|end|"
end sub
