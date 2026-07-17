sub Main()
    print "=== Observer Readback Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    ' Trigger the build from a top-level field set: its observer (onBuild) runs the
    ' set-then-read-back sequence one observer level deep, like a real app building a
    ' menu inside a panel-creation observer.
    scene.runTrigger = 1
    for i = 0 to 5
        msg = wait(20, port)
    end for
    print "=== Observer Readback Repro Complete ==="
end sub
