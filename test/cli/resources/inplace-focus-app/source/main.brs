' Mirrors the two JellyRock shapes measured by test/simulator/probes/focus-populate-buttons-probe.
sub Main()
    print "=== In-place Focus Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()

    ' Each step runs from a scene field observer, a handler on the render thread like the app's.
    ' A focused grid whose empty content node is filled in place, then appended to off item 0.
    scene.step = "populateGrid"
    settle(port)
    scene.callFunc("logGrid", "populated")
    scene.step = "appendGrid"
    settle(port)
    scene.callFunc("logGrid", "appended")

    ' A button row moved the way JRButtonGroup does, under an sgRouter-style outlet that re-focuses
    ' the row while the focus is taken away.
    scene.step = "setupButtons"
    for each key in ["right", "right", "left"]
        scene.step = key
        settle(port)
    end for

    print "=== In-place Focus Repro Complete ==="
end sub

sub settle(port as object)
    for i = 0 to 2
        msg = wait(20, port)
    end for
end sub
