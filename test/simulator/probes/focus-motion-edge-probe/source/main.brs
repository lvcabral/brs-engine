' Focus Motion Edge Probe - entry point.
'
' Scripted, no keys needed: the scene drives a MarkupList with animateToItem and moves the focus away and
' back mid-motion, hides the list while it loses focus, and shows limitSize Posters with one, both or no
' extent set. Every line starts with PROBE| (see README.md).
sub Main(args as dynamic)
    ' The device console drops its clients on launch: give the host time to reconnect.
    sleep(8000)
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
