sub Main()
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    print "SGRENDEZVOUS ready"
    while true
        msg = wait(0, port)
    end while
end sub
