' Grid OK Mid-Motion Probe - entry point. The host presses a direction key and then OK before the
' focus motion settles; the scene logs the grid's focus and selection fields with timestamps.
sub Main()
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    screen.CreateScene("ProbeScene")
    screen.show()
    while true
        msg = wait(0, port)
        if type(msg) = "roSGScreenEvent" and msg.isScreenClosed() then exit while
    end while
end sub
