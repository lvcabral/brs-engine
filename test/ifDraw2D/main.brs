sub main()            
    for t = 1 to 5
        print t;
    next
    date=CreateObject("roDateTime")
    date.toLocalTime()
    print date.AsDateStringNoParam();
    screen=CreateObject("roScreen", true)
    screen.SetAlphaEnable(true)
    port = CreateObject("roMessagePort")
    screen.SetMessagePort(port)
    print screen.getWidth() "x" screen.getHeight()
    print &HFF0000
    screen.Clear(&H303030FF)
    screen.DrawLine(0,0,200,300,&HFFD800FF)
    screen.DrawRect(210,0,200,300,&HFF0000FF)
    screen.DrawPoint(310,150,7.0,&HFFFFFFFF)
    fontRegistry = CreateObject("roFontRegistry")
    font = fontRegistry.GetFont("Arial", 40, false, false)
    screen.DrawText("brsLib", 230, 30, &HFFFFFFFF, font)
    bmp = CreateObject("roBitmap", "pkg:/img/roku-logo.png")
    bmp.DrawLine(0,0,200,300,&HFFFFFFFF)
    screen.DrawObject(450, 50, bmp)
    screen.DrawScaledObject(0,300,0.3,0.3,bmp)
    brt = CreateObject("roBitmap", {width:30, height:30, AlphaEnable: true })
    brt.Clear(&H00FF00FF)
    screen.DrawObject(0, 0, brt)
    DrawBall(screen)
    screen.SwapBuffers()
    msg = port.WaitMessage(0) 'Not working yet on brsLib
end sub

sub DrawBall(screen as object)
    ball = CreateObject("roBitmap", "pkg:/img/AmigaBoingBall.png")
    screen.DrawRotatedObject(200,300,30.0,ball)
end sub