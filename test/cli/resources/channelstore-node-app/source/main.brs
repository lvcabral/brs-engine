sub Main()
    print "=== ChannelStore Node Test ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    for i = 0 to 5
        msg = wait(20, port)
    end for
    print "=== ChannelStore Node Test Complete ==="
end sub
