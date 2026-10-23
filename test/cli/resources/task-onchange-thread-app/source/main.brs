sub Main()
    print "=== Task onChange Thread ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    m.global = screen.getGlobalNode()
    m.global.addFields({ finished: false })
    m.global.observeField("finished", port)
    scene = screen.CreateScene("OnChangeScene")
    screen.show()
    ' Bounded so a regression fails the test's line check instead of hanging the runner.
    for i = 0 to 500
        msg = wait(20, port)
        if type(msg) = "roSGNodeEvent" and msg.getField() = "finished" then exit for
    end for
    print "=== Task onChange Thread Complete ==="
end sub
