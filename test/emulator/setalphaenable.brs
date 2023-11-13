Function Main()
    print "starting alpha test"
    s=CreateObject("roScreen", true, 1280, 720)
    ' Clear to White with alpha fully opaque
    ' but alpha not actually ever used since it is the bottom most plane
    ' alpha is only looked at on "source" planes, not "destination".
    s.Clear(&hFFFFFFFF)
    ' AlphaEnable must be enabled in the destination surface to have effect.
    s.SetAlphaEnable(true)
    bm=CreateObject("roBitmap", {width:450, height: 450, alphaenable: true} )
    bm.Clear(&h0000FF01) 'blue, transparent with alpha = 0x01 otherwise it becomes black
    bm.drawRect(20,20,75,50,&hFF0000FF)
    bm.drawRect(50,50,75,50,&h0000FF78)
    bm.drawRect(80,80,75,50,&h00FF0078)
    s.DrawObject(0, 300, bm)
    b2=CreateObject("roBitmap", {width:450, height: 450, alphaenable: true} )
    b2.Clear(255)
    s.DrawObject(451, 0, b2)
    s.swapBuffers()
    ' redraw with the alpha disabled
    Sleep(10000)
    s.Clear(&hFFFFFFFF)
    s.SetAlphaEnable(false)
    s.DrawObject(0, 300, bm)
    s.DrawObject(451, 0, b2)
    s.swapBuffers()
    Sleep(10000)
End Function