sub Main()
    print "=== List Initial Focus Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    ' Pump a few frames so the list renders: the content node was populated after being
    ' assigned, so the first item gains focus during render and itemFocused fires.
    for i = 0 to 5
        msg = wait(20, port)
    end for
    print "=== List Initial Focus Repro Complete ==="
end sub
