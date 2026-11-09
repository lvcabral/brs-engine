' RowList Hero Grid Probe - entry point.
'
' The RowList of Roku's hero-grid-channel sample, with local content: a hero row of large posters, a
' landscape row and a portrait row (15 items each), then "The Grid", rows of 4 items that all fit on
' screen. Shows how the focus indicator changes size between rows of different item sizes, and which
' column a row change lands on between grid rows. The host drives the keys and takes screenshots (see
' README.md).
sub Main()
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("ProbeScene")
    screen.show()
    print "PROBE|ready"
    while true
        msg = wait(0, port)
        if type(msg) = "roSGScreenEvent" and msg.isScreenClosed() then exit while
    end while
end sub
