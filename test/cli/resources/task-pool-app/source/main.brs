sub Main()
    print "=== Task Pool Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    ' Pump the message loop until the slot task echoes back (the scene sets `done`). The budget is
    ' generous (well beyond the sub-second cost of the chain under normal load) because this test
    ' runs alongside many sibling `node brs.cli.js` child processes under CI concurrency, and a
    ' tight budget here flaked on CPU contention rather than on the cross-thread delivery itself.
    for i = 0 to 750
        msg = wait(20, port)
        if scene.done then exit for
    end for
    print "=== Task Pool Repro Complete ==="
end sub
