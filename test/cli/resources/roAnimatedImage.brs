sub Main()
    msgport = CreateObject("roMessagePort")
    screen = CreateObject("roScreen", true, 100, 100)
    screen.SetAlphaEnable(true)

    animg = CreateObject("roAnimatedImage")' bs:disable-line
    print "before content:";animg.GetState();" valid:";animg.IsValid();" size:";animg.GetWidth();"x";animg.GetHeight()
    print "play before content:";animg.SetTargetState("play")
    animg.SetMessagePort(msgport)
    ' DEVICE-CONFIRMED: real WebP apps never set mimeType at all (only Lottie apps set it, to
    ' "video/lottie+json") -- SetContent must default to WebP when it's absent.
    animg.SetContent({uri: "pkg:/images/animated.webp"})

    msg = wait(0, msgport)
    if type(msg) = "roAnimatedImageEvent"
        print "ready message:";msg.GetMessage()
        print "ready id:";msg.GetInfo()["id"] = animg.GetID()
        print "ready error:";FormatJson(msg.GetInfo().error)
    end if

    print "width:";animg.GetWidth()
    print "height:";animg.GetHeight()

    w = animg.GetWidth()
    h = animg.GetHeight()
    animg.SetPretranslation(-w / 2, -h / 2)
    print "pretranslation x:";animg.GetPretranslationX()
    print "pretranslation y:";animg.GetPretranslationY()

    print "loop:";animg.SetTargetState("loop")

    screen.Clear(&h000000FF)
    screen.DrawObject(10, 10, animg)
    screen.DrawRotatedObject(50, 50, 0.5, animg)
    screen.DrawScaledObject(0, 0, 1.5, 1.5, animg)
    screen.SwapBuffers()
    print "drew roAnimatedImage via DrawObject/DrawRotatedObject/DrawScaledObject"

    ' A SetContent that fails drops the earlier content (device-checked:
    ' test/simulator/probes/animated-image-surface-probe).
    for each content in [{uri: "pkg:/images/missing.webp"}, {uri: "pkg:/roAnimatedImage.brs"}, {uri: "pkg:/images/animated.webp", mimeType: "image/gif"}, {uri: "pkg:/images/animated.webp", mimeType: "video/lottie+json"}, {}]
        animg.SetContent(content)
        msg = msgport.GetMessage()
        event = "none"
        if msg <> invalid then event = msg.GetMessage() + " " + msg.GetInfo().error
        print "content:";FormatJson(content)
        print "  event:";event
        print "  state:";animg.GetState();" valid:";animg.IsValid();" size:";animg.GetWidth();"x";animg.GetHeight();" drawn:";screen.DrawObject(0, 0, animg);" play:";animg.SetTargetState("play")
    end for
end sub
