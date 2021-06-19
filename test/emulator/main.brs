sub main()            
    for t = 1 to 5
        print t;
    next
    date=CreateObject("roDateTime")
    date.toLocalTime()
    print date.AsDateStringNoParam();
    screen=CreateObject("roScreen", true, 854, 480)
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
    bmp = CreateObject("roBitmap", "pkg:/images/roku-logo.png")
    rgn = CreateObject("roRegion", bmp, 100.99, 100, 100.99, 100)
    bmp.DrawLine(0,0,200,300,&HFFFFFFFF)
    screen.DrawObject(450, 50, bmp)
    screen.DrawScaledObject(0,300,0.3,0.3,bmp)
    brt = CreateObject("roBitmap", {width:30, height:30, AlphaEnable: true })
    brt.Clear(&H00FF00FF)
    screen.DrawObject(0, 0, brt)
    screen.DrawObject(40,40, rgn)
    screen.DrawScaledObject(40,40,2,2, rgn)
    DrawBall(screen)
    screen.SwapBuffers()
    bitmap_set = CreateObject("roXMLElement")
    xmlString = ReadAsciiFile("pkg:/assets/bitmapset.xml")
    if not bitmap_set.Parse(xmlString)
        print "dfNewBitmapSet: Error parsing XML"
    end if
    print bitmap_set
    print bitmap_set.getAttributes()
    print bitmap_set.ExtraInfo
    extra = bitmap_set.ExtraInfo
    print extra.getAttributes()
    print bitmap_set.getName()
    print bitmap_set.getChildElements()
    print bitmap_set.getNamedElements("extrainfo")
    print bitmap_set.genXML(true)
    a =  [1, "2", 3]
    print a
    print a[1]
    b = "4"
    print b
    print a[1.3]
    print a[1.6]
    rgn.setTime(100.99)
    print rgn.getTime()
    msg = port.WaitMessage(0)
    print "closing the channel"
end sub

sub DrawBall(screen as object)
    ball = CreateObject("roBitmap", "pkg:/images/AmigaBoingBall.png")
    screen.DrawRotatedObject(200,300,30.0,ball)
end sub