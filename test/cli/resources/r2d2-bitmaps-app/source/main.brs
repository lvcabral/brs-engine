sub Main()
    port = CreateObject("roMessagePort")
    screen = CreateObject("roScreen", true, 854, 480)
    screen.SetMessagePort(port)
    fr = CreateObject("roFontRegistry")
    ' Keep references so the bitmaps remain in texture memory.
    m.bitmaps = []
    m.bitmaps.Push(CreateObject("roBitmap", {width: 100, height: 100, alphaEnable: true, name: "pkg:/images/alpha.png"}))
    m.bitmaps.Push(CreateObject("roBitmap", {width: 200, height: 50, alphaEnable: false, name: "pkg:/images/opaque.jpg"}))
    print "R2D2 ready"
    while true
        msg = wait(2000, port)
    end while
end sub
