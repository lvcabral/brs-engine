sub Main()
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    other = CreateObject("roMessagePort")
    while scene.ticks < 2
        wait(10, port)
    end while
    print "timer ticking before close"
    screen.close()
    msg = wait(1000, port)
    print "closed event: "; msg.isScreenClosed()
    seen = scene.ticks
    for i = 1 to 20
        wait(10, other)
    end for
    print "ticks unchanged after close: "; scene.ticks = seen
end sub
