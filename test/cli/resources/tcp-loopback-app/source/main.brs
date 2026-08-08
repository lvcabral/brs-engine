sub Main()
    print "=== TCP Loopback Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    for i = 0 to 250
        msg = wait(20, port)
    end for
    ' The task never calls Close() on its sockets (mirrors real-world discovery tasks) — its
    ' worker thread terminating shortly after `content` is set is the cleanup path being proven.
    print "=== TCP Loopback Repro Complete ==="
end sub
