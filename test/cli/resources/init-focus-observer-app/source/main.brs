sub Main()
    print "=== Init Focus Observer Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    ' Pump a few frames so the focus-driven focusedChild observer (queued while focus was set in
    ' init, before its observer was registered) is dispatched from the message loop after init.
    for i = 0 to 5
        msg = wait(20, port)
    end for
    print "=== Init Focus Observer Repro Complete ==="
end sub
