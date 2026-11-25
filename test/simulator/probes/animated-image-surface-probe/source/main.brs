' roAnimatedImage's method surface and what a failed SetContent leaves behind.
' images/anim.webp has four solid 400x400 frames, 100 ms each: white, grey (128), orange (255,128,0), cyan.
' Pixel readouts are px:<GetPng hex>:<GetByteArray hex>; ../decode-px.mjs turns them into r,g,b,a.
' The device needs an roScreen for roAnimatedImage, and shows a frame one draw after it is due.
sub Main(args as object)
    sleep(5000)
    print "PROBE|start"
    screen = CreateObject("roScreen", false, 1280, 720)
    port = CreateObject("roMessagePort")
    img = CreateObject("roAnimatedImage")
    img.SetMessagePort(port)
    img.SetContent({uri: "pkg:/images/anim.webp"})
    awaitEvent(port, "load")
    sleep(300)

    ' Interfaces and methods.
    for each name in ["ifAnimatedImage", "ifDraw2D", "ifSetMessagePort", "ifGetMessagePort", "ifToStr"]
        print "PROBE|iface|" + name + "|" + (GetInterface(img, name) <> invalid).ToStr()
    end for
    bmp = CreateObject("roBitmap", {width: 4, height: 4})
    calls = ["Clear", "DrawRect", "DrawPoint", "DrawLine", "DrawObject", "DrawScaledObject", "DrawRotatedObject", "DrawTransformedObject", "DrawText", "Finish", "GetAlphaEnable", "SetAlphaEnable", "GetByteArray", "GetPng", "GetWidth", "GetHeight", "ToStr", "GetMessagePort", "GetPort", "SetPort"]
    for each name in calls
        print "PROBE|method|" + name + "|" + callMethod(img, name, bmp, port)
    end for
    print "PROBE|size|" + img.GetWidth().ToStr() + "x" + img.GetHeight().ToStr()

    ' SetContent's return value.
    try
        r = img.SetContent({uri: "pkg:/images/anim.webp"})
        print "PROBE|setcontent-return|" + type(r) + "|" + FormatJson(r)
    catch e
        print "PROBE|setcontent-return|error|" + e.message
    end try
    awaitEvent(port, "reload")
    sleep(300)
    show(img, "reloaded")

    ' A SetContent that fails after content had loaded: a missing file, then an AA without a uri.
    img.SetTargetState("loop")
    sleep(150)
    show(img, "playing")
    img.SetContent({uri: "pkg:/images/missing.webp"})
    awaitEvent(port, "missing")
    show(img, "missing")
    sleep(300)
    show(img, "missing+300")
    img.SetTargetState("loop")
    show(img, "missing-loop")

    img.SetContent({uri: "pkg:/images/anim.webp"})
    awaitEvent(port, "restore")
    sleep(300)
    show(img, "restored")
    img.SetContent({})
    awaitEvent(port, "nouri")
    show(img, "nouri")
    sleep(300)
    show(img, "nouri+300")

    ' Manual mode, failing after a frame change.
    img.SetContent({uri: "pkg:/images/anim.webp", animationStrategy: "manual"})
    awaitEvent(port, "manual")
    sleep(300)
    img.SetTargetState("loop")
    img.Update(150000)
    sample(img, invalid)
    show(img, "manual-f1")
    img.SetContent({uri: "pkg:/images/missing.webp", animationStrategy: "manual"})
    awaitEvent(port, "manual-missing")
    show(img, "manual-missing")
    img.Update(100000)
    show(img, "manual-missing-update")

    ' A fresh image whose first SetContent fails.
    fresh = CreateObject("roAnimatedImage")
    fresh.SetMessagePort(port)
    fresh.SetContent({uri: "pkg:/images/missing.webp"})
    awaitEvent(port, "fresh-missing")
    show(fresh, "fresh-missing")
    print "PROBE|fresh-missing|play=" + fresh.SetTargetState("play").ToStr() + "|" + fresh.GetState()

    ' An image that never had SetContent, a file that is not an image, and a mimeType the file contradicts.
    blank = CreateObject("roAnimatedImage")
    show(blank, "blank")
    print "PROBE|blank|play=" + blank.SetTargetState("play").ToStr() + "|" + blank.GetState()
    blank.SetMessagePort(port)
    blank.SetContent({uri: "pkg:/manifest"})
    awaitEvent(port, "notimage")
    show(blank, "notimage")
    blank.SetContent({uri: "pkg:/images/anim.webp", mimeType: "video/lottie+json"})
    awaitEvent(port, "badmime")
    show(blank, "badmime")
    sleep(300)
    show(blank, "badmime+300")
    print "PROBE|badmime|play=" + blank.SetTargetState("play").ToStr() + "|" + blank.GetState()
    sleep(300)
    show(blank, "badmime-play")
    blank.SetContent({uri: "pkg:/images/anim.webp", mimeType: "image/gif"})
    awaitEvent(port, "unknownmime")
    show(blank, "unknownmime")
    print "PROBE|done"
end sub

' Calls `name` on `img` with plausible arguments; returns "ok:<result type>" or "error:<message>".
function callMethod(img as object, name as string, bmp as object, port as object) as string
    try
        r = invalid
        if name = "Clear"
            img.Clear(&h000000FF)
        else if name = "DrawRect"
            r = img.DrawRect(0, 0, 4, 4, &h0000FFFF)
        else if name = "DrawPoint"
            r = img.DrawPoint(0, 0, 1, &h0000FFFF)
        else if name = "DrawLine"
            r = img.DrawLine(0, 0, 4, 4, &h0000FFFF)
        else if name = "DrawObject"
            r = img.DrawObject(0, 0, bmp)
        else if name = "DrawScaledObject"
            r = img.DrawScaledObject(0, 0, 1, 1, bmp)
        else if name = "DrawRotatedObject"
            r = img.DrawRotatedObject(0, 0, 0, bmp)
        else if name = "DrawTransformedObject"
            r = img.DrawTransformedObject(0, 0, 0, 1, 1, bmp)
        else if name = "DrawText"
            font = CreateObject("roFontRegistry").GetDefaultFont()
            r = img.DrawText("x", 0, 0, &h0000FFFF, font)
        else if name = "Finish"
            img.Finish()
        else if name = "GetAlphaEnable"
            r = img.GetAlphaEnable()
        else if name = "SetAlphaEnable"
            img.SetAlphaEnable(true)
        else if name = "GetByteArray"
            r = img.GetByteArray(0, 0, 1, 1)
        else if name = "GetPng"
            r = img.GetPng(0, 0, 1, 1)
        else if name = "GetWidth"
            r = img.GetWidth()
        else if name = "GetHeight"
            r = img.GetHeight()
        else if name = "ToStr"
            r = img.ToStr()
        else if name = "GetMessagePort"
            r = img.GetMessagePort()
        else if name = "GetPort"
            r = img.GetPort()
        else if name = "SetPort"
            img.SetPort(port)
        end if
        return "ok:" + type(r)
    catch e
        return "error:" + e.message
    end try
end function

sub awaitEvent(port as object, name as string)
    msg = wait(3000, port)
    if type(msg) = "roAnimatedImageEvent"
        info = msg.GetInfo()
        print "PROBE|event|" + name + "|" + msg.GetMessage() + "|error=" + FormatJson(info.error)
    else
        print "PROBE|event|" + name + "|" + type(msg)
    end if
end sub

' State, validity, size, then two untinted draws and a red one (the device shows a frame a draw late).
sub show(img as object, name as string)
    head = img.GetState() + "|valid=" + img.IsValid().ToStr() + "|" + img.GetWidth().ToStr() + "x" + img.GetHeight().ToStr()
    print "PROBE|show|" + name + "|" + head + "|" + sample(img, invalid) + "|" + sample(img, invalid) + "|" + sample(img, &hFF0000FF)
end sub

function sample(src as object, rgba as dynamic) as string
    dst = CreateObject("roBitmap", {width: 16, height: 16, AlphaEnable: true})
    dst.Clear(&h000000FF)
    if rgba = invalid
        ok = dst.DrawObject(0, 0, src)
    else
        ok = dst.DrawObject(0, 0, src, rgba)
    end if
    dst.Finish()
    return ok.ToStr() + ":px:" + dst.GetPng(0, 0, 1, 1).ToHexString() + ":" + dst.GetByteArray(0, 0, 1, 1).ToHexString()
end function
