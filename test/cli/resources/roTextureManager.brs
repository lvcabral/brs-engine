sub Main()
    msgport = CreateObject("roMessagePort")
    screen = CreateObject("roScreen", true, 854, 480)
    screen.SetAlphaEnable(true)
    screen.SetMessagePort(msgport)
    mgr = CreateObject("roTextureManager")
    mgr.SetMessagePort(msgport)
    uri = "https://brsfiddle.net/images/gif-example-file-500x500.gif"
    request = CreateObject("roTextureRequest", uri)

    print "request id";request.GetId()
    print "request state:";request.GetState()

    mgr.RequestTexture(request)
    print "requested:";request.GetState()

    resized = false
    events = 0

    while events < 3
        msg = wait(0, msgport)
        if type(msg) = "roTextureRequestEvent"
            events = events + 1
            print "msg id";msg.GetId()
            print "msg state:";msg.GetState()
            print "msg URI:";msg.GetURI()
            state = msg.GetState()
            if state = 3
                bitmap = msg.GetBitmap()
                if type(bitmap) <> "roBitmap"
                    print "Unable to create roBitmap"
                else if msg.GetId() <> request.GetId()
                    ' Drawable texture request: SetDrawable(true) was called, so this bitmap is a
                    ' unique, uncached copy and Clear() is allowed to modify it.
                    print "clear (drawable):";bitmap.Clear(&hFF0000FF)
                else if not resized
                    screen.DrawObject(0, 0, bitmap)
                    screen.SwapBuffers()
                    print "Image downloaded!"
                    ' Non-drawable texture request (the default): Clear() must fail and leave the
                    ' shared, cached bitmap untouched.
                    print "clear (non-drawable):";bitmap.Clear(&hFF0000FF)

                    drawableRequest = CreateObject("roTextureRequest", uri)
                    drawableRequest.SetDrawable(true)
                    mgr.RequestTexture(drawableRequest)

                    request.setSize(100, 100)
                    request.setScaleMode(1)
                    mgr.RequestTexture(request)
                    resized = true
                else
                    screen.DrawObject(0, 0, bitmap)
                    screen.SwapBuffers()
                    print "Image resized!"
                    ' A resize always produces its own private, uncached bitmap copy, so it is
                    ' implicitly drawable even without SetDrawable(true) on the request.
                    print "clear (resized):";bitmap.Clear(&hFF0000FF)
                end if
            end if
        end if
    end while
end sub
