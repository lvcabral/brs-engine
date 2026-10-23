sub Main()
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    for i = 0 to 15000
        msg = wait(20, port)
        if scene.done then exit for
    end for
    print "=== DONE ==="
end sub
