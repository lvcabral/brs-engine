sub Main()
    print "=== Task Port Burst ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    m.global = screen.getGlobalNode()
    m.global.addFields({ finished: false })
    m.global.observeField("finished", port)
    scene = screen.CreateScene("BurstScene")
    screen.show()
    ' Bounded so a regression fails the test's line check instead of hanging the runner.
    for i = 0 to 1000
        msg = wait(20, port)
        if type(msg) = "roSGNodeEvent" and msg.getField() = "finished" then exit for
    end for
    print "=== Task Port Burst Complete ==="
end sub
