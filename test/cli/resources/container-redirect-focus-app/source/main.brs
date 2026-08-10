sub Main()
    print "=== Container Redirect Focus Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    ' Each trigger runs one scenario from a top-level field write, so every nested focus request
    ' below is raised from inside a real focus transaction rather than during init().
    scene.runScenario = 1
    for i = 0 to 3
        msg = wait(20, port)
    end for
    scene.runScenario = 2
    for i = 0 to 3
        msg = wait(20, port)
    end for
    scene.runScenario = 3
    for i = 0 to 3
        msg = wait(20, port)
    end for
    scene.runScenario = 4
    for i = 0 to 3
        msg = wait(20, port)
    end for
    print "=== Container Redirect Focus Repro Complete ==="
end sub
