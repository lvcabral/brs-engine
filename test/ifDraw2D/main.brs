sub main()            
    for t = 1 to 5
        print t;
    next
    date=CreateObject("roDateTime")
    date.toLocalTime()
    print date.AsDateStringNoParam();
    screen=CreateObject("roScreen", true)
    screen.SetAlphaEnable(false)
    print screen.getWidth();"x";screen.getHeight()
    print &HFF0000
    screen.Clear(&H303030FF)
    screen.DrawLine(0,0,200,300,&HFFD800FF)
    screen.DrawRect(210,0,200,300,&HFF0000FF)
    screen.DrawPoint(310,150,7.0,&HFFFFFFFF)
    screen.DrawText("brsLib", 230, 50, &HFFFFFFFF, "30px Arial")
    bmp = CreateObject("roBitmap", "pkg:/img/roku-logo.png")
    bmp.DrawLine(0,0,200,300,&HFFFFFFFF)
    screen.DrawObject(450, 50, bmp)
    screen.DrawScaledObject(0,300,0.3,0.3,bmp)
    DrawBall(screen)
    screen.SwapBuffers()
end sub

sub DrawBall(screen as object)
    ball = CreateObject("roBitmap", "pkg:/img/AmigaBoingBall.png")
    screen.DrawRotatedObject(200,300,30.0,ball)
end sub