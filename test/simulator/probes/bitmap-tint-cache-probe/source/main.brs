' Tinted roBitmap draws: every case draws a source tinted onto an opaque black bitmap and prints the pixels, so a
' stale tint (pixels from before the source was drawn into) shows as a wrong value. Each readout is
' px:<GetPng hex>:<GetByteArray hex>, because the device reads back zeros from GetByteArray and the engine writes
' broken small PNGs; ../decode-px.mjs turns it into r,g,b,a.
' Launched with contentId=<case> it runs one self-draw case (drawing a bitmap into itself crashes some of them on
' the device, so each gets its own launch); otherwise every other case.
sub Main(args as object)
    sleep(5000)
    print "PROBE|start"
    if args.contentId <> invalid and args.contentId <> ""
        selfCase(args.contentId)
        print "PROBE|done"
        return
    end if
    RED = &hFF0000FF
    GREEN = &h00FF00FF
    GREY = &h808080FF

    ' Two tints alternating on the same source.
    s = whiteBitmap(16)
    for i = 0 to 2
        print "PROBE|alt|" + i.ToStr() + "|" + sample(s, RED) + "|" + sample(s, GREEN)
    end for

    ' Blend-color alpha: the same RGB at several alphas, then full again.
    s = whiteBitmap(16)
    print "PROBE|alpha|FF|" + sample(s, &hFF0000FF)
    print "PROBE|alpha|80|" + sample(s, &hFF000080)
    print "PROBE|alpha|00|" + sample(s, &hFF000000)
    print "PROBE|alpha|FF-again|" + sample(s, &hFF0000FF)
    for a = 255 to 0 step -51
        print "PROBE|fade|" + a.ToStr() + "|" + sample(s, &hFF000000 + a)
    end for
    try
        print "PROBE|long|" + sample(s, &hFF0000FF&) + "|" + sample(s, &h00FF00FF&)
    catch e
        print "PROBE|long|error|" + e.message
    end try

    ' Two regions of one bitmap drawn with alternating tints.
    b = whiteBitmap(32)
    b.DrawRect(16, 0, 16, 32, GREY)
    left = CreateObject("roRegion", b, 0, 0, 16, 16)
    right = CreateObject("roRegion", b, 16, 0, 16, 16)
    for i = 0 to 1
        print "PROBE|regions|" + i.ToStr() + "|" + sample(left, RED) + "|" + sample(right, GREEN) + "|" + sample(right, RED) + "|" + sample(left, GREEN)
    end for

    ' Writes into a bitmap after it was tinted with two colours.
    ops = ["Clear", "DrawRect", "DrawPoint", "DrawLine", "DrawObject", "DrawScaledObject", "DrawRotatedObject", "DrawTransformedObject", "Compositor", "RegionDrawRect", "RegionDrawObject", "SetAlphaEnable"]
    greyBmp = CreateObject("roBitmap", {width: 16, height: 16, AlphaEnable: true})
    greyBmp.Clear(GREY)
    for each op in ops
        b = whiteBitmap(16)
        warm = sample(b, RED) + "|" + sample(b, GREEN)
        if op = "Clear"
            b.Clear(GREY)
        else if op = "DrawRect"
            b.DrawRect(0, 0, 16, 16, GREY)
        else if op = "DrawPoint"
            b.DrawPoint(0, 0, 1, GREY)
        else if op = "DrawLine"
            b.DrawLine(0, 0, 15, 0, GREY)
        else if op = "DrawObject"
            b.DrawObject(0, 0, greyBmp)
        else if op = "DrawScaledObject"
            b.DrawScaledObject(0, 0, 1.0, 1.0, greyBmp)
        else if op = "DrawRotatedObject"
            b.DrawRotatedObject(0, 0, 0, greyBmp)
        else if op = "DrawTransformedObject"
            b.DrawTransformedObject(0, 0, 0, 1.0, 1.0, greyBmp)
        else if op = "Compositor"
            c = CreateObject("roCompositor")
            c.SetDrawTo(b, &h000000FF)
            c.NewSprite(0, 0, CreateObject("roRegion", greyBmp, 0, 0, 16, 16))
            c.DrawAll()
        else if op = "RegionDrawRect"
            CreateObject("roRegion", b, 0, 0, 8, 8).DrawRect(0, 0, 8, 8, GREY)
        else if op = "RegionDrawObject"
            CreateObject("roRegion", b, 0, 0, 8, 8).DrawObject(0, 0, greyBmp)
        else if op = "SetAlphaEnable"
            b.SetAlphaEnable(false)
            b.DrawRect(0, 0, 16, 16, GREY)
            b.SetAlphaEnable(true)
        end if
        print "PROBE|write." + op + "|" + warm + "|" + px(b, 0, 0) + "|red=" + sample(b, RED) + "|green=" + sample(b, GREEN)
    end for

    ' More distinct tints than any cache holds, twice through: pixel x of the row is the draw with tint x.
    b = whiteBitmap(8)
    row = CreateObject("roBitmap", {width: 208, height: 8, AlphaEnable: true})
    row.Clear(&h000000FF)
    for x = 0 to 199
        level = (x mod 100) * 2
        row.DrawObject(x, 0, b, (level << 24) or 255)
    end for
    print "PROBE|many|" + readout(row, 0, 0, 200, 1)

    timings()
    print "PROBE|done"
end sub

sub selfCase(name as string)
    RED = &hFF0000FF
    GREEN = &h00FF00FF
    GREY = &h808080FF
    if name = "self.whole"
        b = whiteBitmap(16)
        print "PROBE|self.whole|warm|" + sample(b, RED)
        b.DrawObject(0, 0, b, GREY)
        print "PROBE|self.whole|after|" + px(b, 0, 0) + "|grey=" + sample(b, GREY) + "|red=" + sample(b, RED)
    else if name = "self.scaled"
        b = whiteBitmap(16)
        print "PROBE|self.scaled|warm|" + sample(b, RED)
        b.DrawScaledObject(0, 0, 1.0, 1.0, b, GREY)
        print "PROBE|self.scaled|after|" + px(b, 0, 0) + "|grey=" + sample(b, GREY) + "|red=" + sample(b, RED)
    else if name = "self.rotated"
        b = whiteBitmap(16)
        print "PROBE|self.rotated|warm|" + sample(b, RED)
        b.DrawRotatedObject(0, 0, 0, b, GREY)
        print "PROBE|self.rotated|after|" + px(b, 0, 0) + "|grey=" + sample(b, GREY) + "|red=" + sample(b, RED)
    else if name = "self.transformed"
        b = whiteBitmap(16)
        print "PROBE|self.transformed|warm|" + sample(b, RED)
        b.DrawTransformedObject(0, 0, 0, 1.0, 1.0, b, GREY)
        print "PROBE|self.transformed|after|" + px(b, 0, 0) + "|grey=" + sample(b, GREY) + "|red=" + sample(b, RED)
    else if name = "self.region"
        b = whiteBitmap(32)
        b.DrawRect(16, 0, 16, 32, &h000000FF)
        left = CreateObject("roRegion", b, 0, 0, 16, 16)
        right = CreateObject("roRegion", b, 16, 0, 16, 16)
        print "PROBE|self.region|warm|" + sample(left, GREEN) + "|" + sample(right, GREEN)
        b.DrawObject(0, 0, right, RED)
        print "PROBE|self.region|after|" + px(b, 0, 0) + "|green=" + sample(left, GREEN) + "|red=" + sample(left, RED)
    else if name = "self.regiondst"
        b = whiteBitmap(32)
        b.DrawRect(16, 0, 16, 32, &h000000FF)
        left = CreateObject("roRegion", b, 0, 0, 16, 16)
        right = CreateObject("roRegion", b, 16, 0, 16, 16)
        print "PROBE|self.regiondst|warm|" + sample(left, GREEN)
        left.DrawObject(0, 0, right, RED)
        print "PROBE|self.regiondst|after|" + px(b, 0, 0) + "|green=" + sample(left, GREEN) + "|red=" + sample(left, RED)
    end if
end sub

' Draw-loop timings (device reference numbers; not part of the diff).
sub timings()
    src = whiteBitmap(400)
    dst = CreateObject("roBitmap", {width: 400, height: 400, AlphaEnable: true})
    tints = [&hFF0000FF, &h00FF00FF, &h0000FFFF, &hFFFF00FF, &hFF00FFFF, &h00FFFFFF, &h808080FF, &h404040FF]
    t = CreateObject("roTimespan")
    for each name in ["single", "alt2", "cycle8", "alphaRamp", "distinct", "selfChange"]
        t.Mark()
        for i = 0 to 499
            if name = "single"
                rgba = tints[0]
            else if name = "alt2"
                rgba = tints[i mod 2]
            else if name = "cycle8"
                rgba = tints[i mod 8]
            else if name = "alphaRamp"
                rgba = &hFF000000 + (i mod 256)
            else if name = "distinct"
                rgba = ((i mod 256) << 24) or ((i \ 256) << 16) or 255
            else
                src.DrawRect(i mod 400, 0, 1, 1, &h000000FF)
                rgba = tints[i mod 2]
            end if
            dst.DrawObject(0, 0, src, rgba)
        end for
        dst.Finish()
        print "PROBE|time|" + name + "|" + t.TotalMilliseconds().ToStr() + "ms"
    end for
end sub

function whiteBitmap(size as integer) as object
    b = CreateObject("roBitmap", {width: size, height: size, AlphaEnable: true})
    b.Clear(&hFFFFFFFF)
    return b
end function

function sample(src as object, rgba as dynamic) as string
    dst = CreateObject("roBitmap", {width: 16, height: 16, AlphaEnable: true})
    dst.Clear(&h000000FF)
    dst.DrawObject(0, 0, src, rgba)
    return px(dst, 0, 0)
end function

function px(bmp as object, x as integer, y as integer) as string
    return readout(bmp, x, y, 1, 1)
end function

function readout(bmp as object, x as integer, y as integer, w as integer, h as integer) as string
    bmp.Finish()
    return "px:" + bmp.GetPng(x, y, w, h).ToHexString() + ":" + bmp.GetByteArray(x, y, w, h).ToHexString()
end function
