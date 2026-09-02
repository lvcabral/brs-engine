' Runs the clone/setRef checks on the MAIN thread, then asks the Scene to run the identical set on
' the RENDER thread. Any line that differs between the two traces is thread-context dependent --
' `ifSGNodeField` says CanGetRef/GetRef "may only be called on the render thread", and this shows
' whether the earlier `canGetRef = false` (and the clone-loses-its-fields result) was that, or real.
sub Main()
    print "=== Clone and SetRef Probe ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()

    di = CreateObject("roDeviceInfo")
    print "[env] model=" + di.GetModel() + " os=" + di.GetOSVersion().major + "." + di.GetOSVersion().minor

    ' MAIN thread run: the same checks, duplicated here on purpose. A component script cannot rely on
    ' seeing source/ functions in every runtime, so the probe must not share code across the boundary.
    runGuarded("main")

    ' RENDER thread run: callFunc executes in the component's owning thread.
    try
        scene.callFunc("runTests", "render")
    catch e
        print "  [render] callFunc ABORTED: " + e.message
    end try

    print "=== Clone and SetRef Probe Complete ==="
end sub
