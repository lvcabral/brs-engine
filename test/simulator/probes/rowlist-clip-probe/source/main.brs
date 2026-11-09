' RowList Clip Probe - entry point.
'
' Shows whether a device clips a RowList's item components while the focus moves: each cell draws a
' label below its poster (outside rowItemSize) and a marker that spills past the row height. The host
' holds Right or Down and takes a dev-mode screenshot mid-motion (see README.md).
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
