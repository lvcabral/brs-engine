sub Main()
    print "=== Task Media Node Observer Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    for i = 0 to 50
        msg = wait(20, port)
        if scene.done then exit for
    end for
    print "=== Task Media Node Observer Repro Complete ==="
end sub
