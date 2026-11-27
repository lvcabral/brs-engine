' roRegion alpha blending and edge clipping, and DrawPoint with a zero or negative size, on a real Roku vs.
' brs-engine (PR #1356 review follow-ups). Plain Draw2D.
sub Main()
    sleep(8000) ' time for the console to attach
    screen = CreateObject("roScreen", true, 1280, 720)
    screen.Clear(&h000000FF)
    screen.SwapBuffers()
    print "PROBE|start"

    ' Region alpha: does a region start with its bitmap's AlphaEnable, and does setting one change the other?
    ' Region (0,0)-(3,7) gets a translucent rect, point and line; the bitmap itself gets a rect at x 4-7.
    for each c in [["regionOfOff", false, invalid], ["regionOfOn", true, invalid], ["regionSetOff", true, false], ["regionSetOn", false, true]]
        b = CreateObject("roBitmap", {width: 8, height: 8, AlphaEnable: c[1]})
        b.Clear(&h0000FFFF)
        r = CreateObject("roRegion", b, 0, 0, 4, 8)
        print "PROBE|" + c[0] + "|created|bmp=" + b.GetAlphaEnable().ToStr() + "|rgn=" + r.GetAlphaEnable().ToStr()
        if c[2] <> invalid then r.SetAlphaEnable(c[2])
        print "PROBE|" + c[0] + "|set|bmp=" + b.GetAlphaEnable().ToStr() + "|rgn=" + r.GetAlphaEnable().ToStr()
        r.DrawRect(0, 0, 3, 3, &hFF000040)
        r.DrawPoint(1, 4, 1, &hFF000040)
        r.DrawLine(0, 6, 3, 6, &hFF000040)
        b.DrawRect(4, 0, 3, 3, &h00FF0080)
        report(c[0], b)
    end for

    ' Region edges: a 4x4 region at (4,4) of a 12x12 bitmap, drawn past each of its edges
    r = edgeRegion()
    r.DrawPoint(0, 0, 4, &hFF0000FF)
    r.DrawPoint(3, 3, 4, &h00FF00FF)
    report("edgePoint", r.GetBitmap())
    r = edgeRegion()
    r.DrawRect(-2, -2, 4, 4, &hFF0000FF)
    r.DrawRect(2, 2, 4, 4, &h00FF00FF)
    report("edgeRect", r.GetBitmap())
    r = edgeRegion()
    r.DrawLine(-2, 1, 6, 1, &hFF0000FF)
    r.DrawLine(2, -2, 2, 6, &h00FF00FF)
    r.DrawLine(-2, -2, 6, 6, &h0000FFFF)
    report("edgeLine", r.GetBitmap())

    ' DrawPoint with a zero or negative size at (5, 5), blending off over transparent
    for each size in [0, -0.5, -1, -2, -3, -4]
        b = blankBitmap()
        ok = b.DrawPoint(5, 5, size, &hFF0000FF)
        report("size" + Str(size).Trim() + "|ok=" + ok.ToStr(), b)
    end for
    print "PROBE|done"
end sub

' A 12x12 transparent bitmap, blending off
function blankBitmap() as object
    b = CreateObject("roBitmap", {width: 12, height: 12, AlphaEnable: false})
    b.Clear(0)
    return b
end function

' A 4x4 region at (4,4) of a blankBitmap()
function edgeRegion() as object
    return CreateObject("roRegion", blankBitmap(), 4, 4, 4, 4)
end function

' px:<GetPng hex>:<GetByteArray hex> - the device's GetByteArray reads back zeros, see ../decode-px.mjs
sub report(name as string, b as object)
    b.Finish()
    w = b.GetWidth()
    h = b.GetHeight()
    print "PROBE|" + name + "|px:" + b.GetPng(0, 0, w, h).ToHexString() + ":" + b.GetByteArray(0, 0, w, h).ToHexString()
end sub
