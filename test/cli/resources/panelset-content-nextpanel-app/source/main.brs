sub Main()
    print "=== PanelSet Content NextPanel Repro ==="

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)

    scene = screen.CreateScene("MainScene")
    screen.show()
    scene.observeField("report", port)

    ' Block in wait(0) like a real app's main loop: from here on, every statement on this thread runs
    ' inside an observer, so work deferred "until the handler returns" must be delivered from the
    ' message loop itself.
    while true
        msg = wait(0, port)
        if type(msg) = "roSGNodeEvent" and msg.getField() = "report"
            print "numPanels after content = "; msg.getData()
            exit while
        end if
    end while

    print "=== PanelSet Content NextPanel Repro Complete ==="
end sub
