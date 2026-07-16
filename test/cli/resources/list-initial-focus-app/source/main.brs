sub Main()
    print "=== List Initial Focus Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    ' Pump a few frames so the list renders and the focus-driven itemFocused observer (queued
    ' when the list gained focus in init) is dispatched from the message loop.
    for i = 0 to 5
        msg = wait(20, port)
    end for
    print "=== List Initial Focus Repro Complete ==="
end sub
