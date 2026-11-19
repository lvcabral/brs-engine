' Device-measured (test/simulator/probes/sgscreen-close-probe): an roScreen suspends the Scene under it,
' close() posts one closed event, and a later roSGScreen runs whichever port Main reads.
sub Main()
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    while scene.ticks < 2
        wait(10, port)
    end while
    print "timer ticking before roScreen"
    rs = CreateObject("roScreen", true)
    seen = scene.ticks
    for i = 1 to 20
        wait(10, port)
    end for
    print "scene suspended under roScreen: "; scene.ticks = seen
    screen.close()
    screen.close()
    closed = 0
    for i = 1 to 20
        msg = wait(10, port)
        if type(msg) = "roSGScreenEvent" and msg.isScreenClosed() then closed = closed + 1
    end for
    print "closed events: "; closed
    rs = invalid
    screen2 = CreateObject("roSGScreen")
    port2 = CreateObject("roMessagePort")
    screen2.setMessagePort(port2)
    scene2 = screen2.CreateScene("MainScene")
    screen2.show()
    for i = 1 to 30
        wait(10, port)
    end for
    print "second screen runs through an older port: "; scene2.ticks > 0
    print "closed scene stays stopped: "; scene.ticks = seen
end sub
