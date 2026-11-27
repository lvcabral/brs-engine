' A LayoutGroup child observes its own translation and calls boundingRect() on the group (or an
' ancestor) from that observer, re-entering the layout while it is placing the children.
' Copy of test/simulator/probes/layoutgroup-reentry-probe with shorter case timers.
sub Main()
    print "PROBE|start"
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("ReentryScene")
    screen.show()
    while true
        msg = wait(500, port)
        if type(msg) = "roSGScreenEvent"
            if msg.isScreenClosed() then exit while
        end if
        if scene.probeExit then exit while
    end while
end sub
