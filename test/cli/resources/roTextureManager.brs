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

    for i = 0 to 1
        msg = wait(0, msgport)
        if type(msg) = "roTextureRequestEvent"
            print "msg id";msg.GetId()
            print "msg state:";msg.GetState()
            print "msg URI:";msg.GetURI()
            state = msg.GetState()
            if state = 3
                bitmap = msg.GetBitmap()
                if type(bitmap) <> "roBitmap"
                    print "Unable to create roBitmap"
                else
                    screen.DrawObject(0, 0, bitmap)
                    screen.SwapBuffers()
                    if not resized
                        print "Image downloaded!"
                        request.setSize(100, 100)
                        request.setScaleMode(1)
                        mgr.RequestTexture(request)
                        resized = true
                    else
                        print "Image resized!"
                    end if
                end if
            end if
        end if
    end for
end sub