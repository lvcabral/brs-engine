' The scene keeps rendering whatever port roSGScreen.SetMessagePort() is given (device: set-port-invalid-probe).
sub Main()
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.SetMessagePort(port)
    scene = screen.CreateScene("ProbeScene")
    screen.Show()
    sceneStep("attached", scene, port)

    screen.SetMessagePort(invalid)
    print "set-invalid port=" + type(screen.GetMessagePort())
    sceneStep("after-invalid", scene, port)

    port2 = CreateObject("roMessagePort")
    screen.SetMessagePort(port2)
    sceneStep("switched-wait-old", scene, port)
    sceneStep("switched-wait-new", scene, port2)
end sub

sub sceneStep(name as string, scene as object, port as object)
    ticks = scene.ticks
    for i = 1 to 15
        wait(100, port)
    end for
    state = "frozen"
    if scene.ticks > ticks then state = "advancing"
    print name + " timer=" + state
end sub
