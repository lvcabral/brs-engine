sub Main()
    print "=== Cross Alias Loop Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    scene.runTrigger = 1
    for i = 0 to 5
        msg = wait(20, port)
    end for
    print "=== Cross Alias Loop Repro Complete ==="
end sub
