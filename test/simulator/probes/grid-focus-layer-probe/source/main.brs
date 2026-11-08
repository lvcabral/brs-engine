' Grid Focus Layer Probe - entry point.
'
' Shows how a device layers a grid's focus indicator against opaque cells while the focus glides: one
' MarkupGrid row of opaque colored cells with the default focus ring (drawFocusFeedbackOnTop=false) and
' one with drawFocusFeedbackOnTop=true. The host holds Right and takes a dev-mode screenshot mid-glide
' (see README.md); draw order is not observable from BrightScript.
sub Main()
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    screen.CreateScene("ProbeScene")
    screen.show()
    print "PROBE|ready"
    while true
        msg = wait(0, port)
        if type(msg) = "roSGScreenEvent" and msg.isScreenClosed() then exit while
    end while
end sub
