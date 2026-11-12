' SetFocus Return Probe - entry point. Prints what setFocus(true) returns when the focus stays, when an
' observer forwards it into the node's subtree, and when an observer moves it elsewhere.
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
