' DrawPoint placement/size and DrawPoint/DrawRect alpha on a real Roku vs. brs-engine (issue #1351). Plain Draw2D.
sub Main()
    sleep(2000) ' time for the console to attach
    screen = CreateObject("roScreen", true, 1280, 720)
    screen.Clear(&h000000FF)
    screen.SwapBuffers()
    print "PROBE|start"
    ' Size and placement: one opaque point at (5, 5), blending off over transparent
    for each size in [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6]
        b = CreateObject("roBitmap", {width: 12, height: 12, AlphaEnable: false})
        b.Clear(0)
        b.DrawPoint(5, 5, size, &hFF0000FF)
        report("size" + Str(size).Trim(), b)
    end for
    ' Alpha: translucent points and a rect over opaque blue, blending off then on
    for each alphaEnable in [false, true]
        b = CreateObject("roBitmap", {width: 12, height: 12, AlphaEnable: alphaEnable})
        b.Clear(&h0000FFFF)
        b.DrawPoint(1, 1, 3, &hFF000040)
        b.DrawRect(6, 1, 3, 3, &h00FF0080)
        b.DrawPoint(1, 5, 1, &hFF000040)
        b.DrawPoint(4, 5, 2.5, &hFF000040)
        name = "alphaOff"
        if alphaEnable then name = "alphaOn"
        report(name, b)
    end for
    print "PROBE|done"
end sub

' px:<GetPng hex>:<GetByteArray hex> - the device's GetByteArray reads back zeros, see ../decode-px.mjs
sub report(name as string, b as object)
    b.Finish()
    w = b.GetWidth()
    h = b.GetHeight()
    print "PROBE|" + name + "|px:" + b.GetPng(0, 0, w, h).ToHexString() + ":" + b.GetByteArray(0, 0, w, h).ToHexString()
end sub
