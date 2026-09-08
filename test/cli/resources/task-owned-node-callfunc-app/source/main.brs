sub Main()
    print "=== Task Owned Node CallFunc Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    called = false
    for i = 0 to 250
        msg = wait(20, port)
        if not called and scene.agentReady
            ' callFunc onto the agent from this thread's own loop, outside any observer nesting --
            ' matches the reported crash's call shape (main thread's own message-processing loop).
            scene.callFunc("doHarvestCall")
            called = true
        end if
        if scene.done then exit for
    end for
    print "=== Task Owned Node CallFunc Repro Complete ==="
end sub
