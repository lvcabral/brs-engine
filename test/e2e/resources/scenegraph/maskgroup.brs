sub Main()
    mask = CreateObject("roSGNode", "MaskGroup")
    print "subtype: " + mask.subtype()
    print "isSubtype Node: " ; mask.isSubtype("Node")

    print "maskUri: [" + mask.maskUri + "]"
    sz = mask.maskSize
    print "maskSize: " + Str(sz[0]).Trim() + "," + Str(sz[1]).Trim()
    off = mask.maskOffset
    print "maskOffset: " + Str(off[0]).Trim() + "," + Str(off[1]).Trim()
    print "maskBitmapWidth: " + Str(mask.maskBitmapWidth).Trim()
    print "maskBitmapHeight: " + Str(mask.maskBitmapHeight).Trim()

    mask.maskSize = [100, 50]
    mask.maskOffset = [50, 30]
    mask.maskUri = "pkg:/images/mask.png"
    nsz = mask.maskSize
    noff = mask.maskOffset
    print "set maskSize: " + Str(nsz[0]).Trim() + "," + Str(nsz[1]).Trim()
    print "set maskOffset: " + Str(noff[0]).Trim() + "," + Str(noff[1]).Trim()
    print "set maskUri: [" + mask.maskUri + "]"

    print "Test completed successfully!"
end sub
