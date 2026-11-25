' Tinted roAnimatedImage draws: each case draws the image (tinted or not) onto an opaque black bitmap and prints
' the pixel, then the "time" cases time 500 draws per pattern. images/anim.webp has four solid 400x400 frames,
' 100 ms each: white, grey (128), orange (255,128,0), cyan (0,255,255).
' Each readout is px:<GetPng hex>:<GetByteArray hex> (the device reads back zeros from GetByteArray); ../decode-px.mjs
' turns it into r,g,b,a.
' The device needs an roScreen for roAnimatedImage (without one, automatic mode fails "Failed to create screen" and
' manual mode draws nothing), and shows a new frame one draw after it is due, so each frame change is followed by a
' discarded warm-up draw.
sub Main(args as object)
    sleep(5000)
    print "PROBE|start"
    screen = CreateObject("roScreen", false, 1280, 720)
    port = CreateObject("roMessagePort")
    RED = &hFF0000FF
    GREEN = &h00FF00FF

    ' Manual mode: frames move only on Update().
    img = loadImage(port, "manual")
    if img = invalid
        print "PROBE|done"
        return
    end if
    print "PROBE|manual|state|" + img.GetState()
    for i = 0 to 1
        print "PROBE|manual|f0|" + i.ToStr() + "|" + sample(img, invalid) + "|" + sample(img, RED) + "|" + sample(img, GREEN) + "|" + sample(img, RED)
    end for
    img.SetTargetState("loop")
    img.Update(150000)
    sample(img, invalid)
    print "PROBE|manual|f1|" + sample(img, invalid) + "|" + sample(img, RED) + "|" + sample(img, GREEN) + "|" + sample(img, RED)
    img.Update(0)
    print "PROBE|manual|f1-again|" + sample(img, RED) + "|" + sample(img, invalid)
    img.Update(100000)
    sample(img, invalid)
    print "PROBE|manual|f2|" + sample(img, GREEN) + "|" + sample(img, RED) + "|" + sample(img, invalid)
    img.Update(100000)
    sample(img, RED)
    print "PROBE|manual|f3|" + sample(img, RED) + "|" + sample(img, GREEN) + "|" + sample(img, invalid)
    img.Update(100000)
    sample(img, RED)
    print "PROBE|manual|f0-wrap|" + sample(img, RED) + "|" + sample(img, invalid)

    ' Automatic mode, before it plays.
    img = loadImage(port, "automatic")
    print "PROBE|auto|first|" + img.GetState() + "|" + sample(img, invalid) + "|" + sample(img, RED) + "|" + sample(img, RED)

    timings(port)
    print "PROBE|done"
end sub

' Draw-loop timings: 500 draws of the 400x400 image per pattern. "paused" never plays; "loop" plays on the wall
' clock; "manual" advances 16 ms with Update() before each draw.
sub timings(port as object)
    dst = CreateObject("roBitmap", {width: 400, height: 400, AlphaEnable: true})
    t = CreateObject("roTimespan")
    for each mode in ["paused", "loop", "manual"]
        if mode = "manual"
            img = loadImage(port, "manual")
        else
            img = loadImage(port, "automatic")
        end if
        if mode <> "paused" then img.SetTargetState("loop")
        for each name in ["plain", "single", "alt2"]
            t.Mark()
            for i = 0 to 499
                if mode = "manual" then img.Update(16000)
                if name = "plain"
                    dst.DrawObject(0, 0, img)
                else if name = "single"
                    dst.DrawObject(0, 0, img, &hFF0000FF)
                else if i mod 2 = 0
                    dst.DrawObject(0, 0, img, &hFF0000FF)
                else
                    dst.DrawObject(0, 0, img, &h00FF00FF)
                end if
            end for
            dst.Finish()
            print "PROBE|time|" + mode + "|" + name + "|" + t.TotalMilliseconds().ToStr() + "ms"
        end for
    end for
end sub

' Loads images/anim.webp and waits for "ready", then for the first frame to decode.
function loadImage(port as object, strategy as string) as object
    img = CreateObject("roAnimatedImage")
    img.SetMessagePort(port)
    img.SetContent({uri: "pkg:/images/anim.webp", animationStrategy: strategy})
    msg = wait(5000, port)
    if type(msg) <> "roAnimatedImageEvent" or msg.GetMessage() <> "ready"
        print "PROBE|load|" + strategy + "|failed|" + type(msg)
        return invalid
    end if
    sleep(300)
    return img
end function

function sample(src as object, rgba as dynamic) as string
    dst = CreateObject("roBitmap", {width: 16, height: 16, AlphaEnable: true})
    dst.Clear(&h000000FF)
    if rgba = invalid
        dst.DrawObject(0, 0, src)
    else
        dst.DrawObject(0, 0, src, rgba)
    end if
    dst.Finish()
    return "px:" + dst.GetPng(0, 0, 1, 1).ToHexString() + ":" + dst.GetByteArray(0, 0, 1, 1).ToHexString()
end function
