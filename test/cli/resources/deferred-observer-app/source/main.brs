sub Main()
    print "=== Deferred Observer Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    ' Set a plain trigger field at the top level (not from inside another observer). Its observer
    ' runs the list-loading sequence; the itemFocused observers it fires run inline, before it returns.
    scene.runTrigger = 1
    for i = 0 to 5
        msg = wait(20, port)
    end for
    print "=== Deferred Observer Repro Complete ==="
end sub
