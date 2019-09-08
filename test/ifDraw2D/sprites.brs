sub main()
    screen=CreateObject("roScreen", true, 854, 480)
    screen.SetAlphaEnable(true)
    screen.Clear(&HC0C0C0FF)
    port = CreateObject("roMessagePort")
    screen.SetMessagePort(port)
    compositor=CreateObject("roCompositor")
    compositor.SetDrawTo(screen, 0)
    roku = CreateObject("roBitmap", "pkg:/images/roku-logo.png")
    logo = CreateObject("roBitmap", "pkg:/images/sprite.png")
    ball = CreateObject("roBitmap", "pkg:/images/AmigaBoingBall.png")
    rgn1 = CreateObject("roRegion", ball, 0, 0, ball.getWidth(), ball.getHeight())
    rgn2 = CreateObject("roRegion", logo, 0, 0, logo.getWidth(), logo.getHeight())
    rgn3 = CreateObject("roRegion", roku, 100, 100, 100, 100)
    spr1 = compositor.NewSprite(0, 0, rgn1, 20)
    spr2 = compositor.NewSprite(30, 70, rgn2, 50)
    spr3 = compositor.NewSprite(60, 60, rgn3,40)
    spr3.setZ(10)
    spr1.remove()
    compositor.DrawAll()
    bmpr = CreateObject("roBitmap", {width:30, height:30, AlphaEnable: true })
    red = &hFF0000FF
    print red
    bmpr.Clear(&hFF0000FF)
    screen.DrawObject(0, 0, bmpr)
    bmpg = CreateObject("roBitmap", {width:30, height:30, AlphaEnable: true })
    green = &h00FF00FF
    print green
    bmpg.Clear(green)
    screen.DrawObject(824, 0, bmpg)
    bmpb = CreateObject("roBitmap", {width:30, height:30, AlphaEnable: true })
    blue = &h0000FFFF
    print blue
    bmpb.Clear(blue)
    screen.DrawObject(0, 450, bmpb)
    bmpw = CreateObject("roBitmap", {width:30, height:30, AlphaEnable: true })
    white = &hFFFFFFFF
    print white
    bmpw.Clear(white)
    screen.DrawObject(824,450, bmpw)
    screen.SwapBuffers()
    print logo.getPng(0, 0, logo.getWidth(), logo.getHeight())
    msg = port.WaitMessage(0) 'Not working yet on brsLib
end sub