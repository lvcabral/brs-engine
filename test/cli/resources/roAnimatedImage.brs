sub Main()
    msgport = CreateObject("roMessagePort")
    screen = CreateObject("roScreen", true, 100, 100)
    screen.SetAlphaEnable(true)

    animg = CreateObject("roAnimatedImage")
    animg.SetMessagePort(msgport)
    ' DEVICE-CONFIRMED: real WebP apps never set mimeType at all (only Lottie apps set it, to
    ' "video/lottie+json") -- SetContent must default to WebP when it's absent.
    ok = animg.SetContent({uri: "pkg:/images/animated.webp"})
    print "SetContent returned:";ok

    msg = wait(0, msgport)
    if type(msg) = "roAnimatedImageEvent"
        print "ready state:";msg.GetState()
        print "ready uri:";msg.GetURI()
    end if

    print "width:";animg.GetWidth()
    print "height:";animg.GetHeight()

    w = animg.GetWidth()
    h = animg.GetHeight()
    animg.SetPretranslation(-w / 2, -h / 2)
    print "pretranslation x:";animg.GetPretranslationX()
    print "pretranslation y:";animg.GetPretranslationY()

    animg.SetTargetState("loop")

    screen.Clear(&h000000FF)
    screen.DrawObject(10, 10, animg)
    screen.DrawRotatedObject(50, 50, 0.5, animg)
    screen.DrawScaledObject(0, 0, 1.5, 1.5, animg)
    screen.SwapBuffers()
    print "drew roAnimatedImage via DrawObject/DrawRotatedObject/DrawScaledObject"
end sub
