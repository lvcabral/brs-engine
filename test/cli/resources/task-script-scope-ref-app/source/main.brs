sub Main()
    print "=== Task Script Scope Ref Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    globalNode = screen.getGlobalNode()
    globalNode.addFields({ server: { version: "10.9.0" } })
    scene = screen.CreateScene("MainScene")
    screen.show()
    ' Pump the message loop until the Task observer fires (the scene sets `done`).
    for i = 0 to 250
        msg = wait(20, port)
        if scene.done then exit for
    end for
    print "=== Task Script Scope Ref Repro Complete ==="
end sub
