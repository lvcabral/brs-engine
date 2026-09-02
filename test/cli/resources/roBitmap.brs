' Pins the roBitmap method surface, which is now built on first lookup (`buildMethods`) rather than in
' the constructor. Existing fixtures cover the ifDraw2D drawing calls, but `ifBitmap.GetName` (its only
' own method), the PNG/byte-array getters, and the reflection paths that read the interface map directly
' had no automated coverage.
sub Main()
    bmp = CreateObject("roBitmap", { width: 40, height: 24, alphaEnable: true, name: "pkg:/images/test.png" })
    print "valid         "; bmp <> invalid
    print "width         "; bmp.GetWidth()
    print "height        "; bmp.GetHeight()
    print "name          "; bmp.GetName()

    print "alphaEnable   "; bmp.GetAlphaEnable()
    bmp.SetAlphaEnable(false)
    print "alphaEnable   "; bmp.GetAlphaEnable()

    bmp.Clear(&hFF0000FF)
    bmp.DrawRect(2, 2, 8, 8, &h00FF00FF)
    bmp.DrawPoint(1, 1, &hFFFFFFFF, 1)
    bmp.DrawLine(0, 0, 10, 10, &hFFFFFFFF)
    bmp.Finish()
    print "png type      "; type(bmp.GetPng(0, 0, 4, 4))
    print "byteArray type"; type(bmp.GetByteArray(0, 0, 4, 4))

    ' A region drawn onto the bitmap: exercises DrawObject through the deferred ifDraw2D.
    src = CreateObject("roBitmap", { width: 8, height: 8, alphaEnable: false })
    rgn = CreateObject("roRegion", src, 0, 0, 8, 8)
    print "drawObject    "; bmp.DrawObject(0, 0, rgn)

    ' Reflection reads the interface map directly, so it must trigger the lazy build.
    print "ifDraw2D      "; type(GetInterface(bmp, "ifDraw2D"))
    print "ifBitmap      "; type(GetInterface(bmp, "ifBitmap"))
    print "findMember    "; type(FindMemberFunction(bmp, "GetName"))
    print "unknown iface "; type(GetInterface(bmp, "ifBogus"))
end sub
