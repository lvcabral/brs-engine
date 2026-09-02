' Exercises the roRegion method surface end-to-end. It had no automated coverage, which matters now
' that the surface is built lazily on first lookup (`buildMethods`) instead of in the constructor:
' the ifRegion methods are getters and ifDraw2D is allocated on demand, so a regression there would
' otherwise only show up in a game.
sub Main()
    bmp = CreateObject("roBitmap", { width: 64, height: 48, alphaEnable: false })
    rgn = CreateObject("roRegion", bmp, 4, 6, 32, 24)

    print "valid          "; rgn <> invalid
    print "width          "; rgn.GetWidth()
    print "height         "; rgn.GetHeight()
    print "x              "; rgn.GetX()
    print "y              "; rgn.GetY()

    rgn.SetWrap(true)
    print "wrap           "; rgn.GetWrap()
    rgn.SetTime(42)
    print "time           "; rgn.GetTime()
    rgn.SetScaleMode(1)
    print "scaleMode      "; rgn.GetScaleMode()
    rgn.SetPretranslation(7, 9)
    print "pretranslation "; rgn.GetPretranslationX(); " "; rgn.GetPretranslationY()
    rgn.SetCollisionType(1)
    print "collisionType  "; rgn.GetCollisionType()

    rgn.Offset(1, 2, 3, 4)
    print "after offset   "; rgn.GetX(); " "; rgn.GetY(); " "; rgn.GetWidth(); " "; rgn.GetHeight()

    copy = rgn.Copy()
    print "copy width     "; copy.GetWidth()
    print "copy wrap      "; copy.GetWrap()
    print "getBitmap w/h  "; rgn.GetBitmap().GetWidth(); " "; rgn.GetBitmap().GetHeight()

    ' ifDraw2D comes from an interface object that is now allocated on demand.
    rgn.Clear(&hFF0000FF)
    rgn.DrawRect(0, 0, 4, 4, &h00FF00FF)
    rgn.DrawPoint(1, 1, &hFFFFFFFF, 1)
    rgn.DrawLine(0, 0, 8, 8, &hFFFFFFFF)
    print "alphaEnable    "; rgn.GetAlphaEnable()
    rgn.SetAlphaEnable(true)
    print "alphaEnable    "; rgn.GetAlphaEnable()
    rgn.Finish()

    ' Reflection reads the interface map directly, so it must trigger the lazy build.
    print "ifRegion       "; type(GetInterface(rgn, "ifRegion"))
    print "ifDraw2D       "; type(GetInterface(rgn, "ifDraw2D"))
    print "findMember     "; type(FindMemberFunction(rgn, "SetWrap"))
    print "unknown iface  "; type(GetInterface(rgn, "ifBogus"))
end sub
