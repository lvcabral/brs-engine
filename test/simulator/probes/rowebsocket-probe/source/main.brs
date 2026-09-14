sub Main()
    screen = CreateObject("roSGScreen")
    m.port = CreateObject("roMessagePort")
    screen.setMessagePort(m.port)
    screen.CreateScene("ProbeScene")
    screen.show()

    print "### PROBE app started"

    while true
        msg = wait(0, m.port)
        if type(msg) = "roSGScreenEvent"
            if msg.isScreenClosed()
                print "### PROBE app exiting"
                return
            end if
        end if
    end while
end sub
