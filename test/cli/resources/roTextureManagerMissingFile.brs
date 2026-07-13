sub Main()
    msgport = CreateObject("roMessagePort")
    mgr = CreateObject("roTextureManager")
    mgr.SetMessagePort(msgport)
    request = CreateObject("roTextureRequest", "pkg:/images/does-not-exist.png")
    request.setAsync(false)

    mgr.RequestTexture(request)
    print "first request state:";request.GetState()

    mgr.RequestTexture(request)
    print "second request state:";request.GetState()
end sub
