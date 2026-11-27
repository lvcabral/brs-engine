' DrawLine rasterization and alpha on a real Roku vs. brs-engine (issues #1340, #1351). Plain Draw2D.
' Every case draws into a fresh 12x8 bitmap and prints all of its pixels.
sub Main()
    sleep(2000) ' time for the console to attach
    screen = CreateObject("roScreen", true, 1280, 720)
    screen.Clear(&h000000FF)
    screen.SwapBuffers()
    print "PROBE|start"
    ' Coverage: alpha off over transparent, so a painted pixel is exactly the line color
    b = fresh(false, 0) : b.DrawLine(1, 2, 9, 2, &hFF0000FF) : b.DrawLine(10, 1, 10, 6, &h00FF00FF) : report("hv", b)
    b = fresh(false, 0) : b.DrawLine(0, 0, 6, 6, &hFF0000FF) : b.DrawLine(0, 7, 11, 4, &h00FF00FF) : report("diag", b)
    b = fresh(false, 0) : b.DrawLine(0, 0, 11, 3, &hFF0000FF) : report("shallowDown", b)
    b = fresh(false, 0) : b.DrawLine(5, 6, 5, 1, &hFF0000FF) : report("vertUp", b)
    b = fresh(false, 0) : b.DrawLine(2, 7, 5, 0, &hFF0000FF) : report("steepUp", b)
    b = fresh(false, 0) : b.DrawLine(10, 3, 2, 3, &hFF0000FF) : report("horizLeft", b)
    b = fresh(false, 0) : b.DrawLine(9, 1, 3, 7, &hFF0000FF) : report("diagDownLeft", b)
    b = fresh(false, 0) : b.DrawLine(4, 4, 4, 4, &hFF0000FF) : report("zeroLen", b)
    ' Alpha: translucent lines over opaque blue, blending off then on
    b = fresh(false, &h0000FFFF) : b.DrawLine(0, 2, 9, 2, &hFF000040) : b.DrawLine(4, 0, 4, 5, &h00FF0080) : report("alphaOff", b)
    b = fresh(true, &h0000FFFF) : b.DrawLine(0, 2, 9, 2, &hFF000040) : b.DrawLine(4, 0, 4, 5, &h00FF0080) : report("alphaOn", b)
    print "PROBE|done"
end sub

function fresh(alphaEnable as boolean, color as integer) as object
    b = CreateObject("roBitmap", {width: 12, height: 8, AlphaEnable: alphaEnable})
    b.Clear(color)
    return b
end function

' px:<GetPng hex>:<GetByteArray hex> - the device's GetByteArray reads back zeros, see ../decode-px.mjs
sub report(name as string, b as object)
    b.Finish()
    w = b.GetWidth()
    h = b.GetHeight()
    print "PROBE|" + name + "|px:" + b.GetPng(0, 0, w, h).ToHexString() + ":" + b.GetByteArray(0, 0, w, h).ToHexString()
end sub
