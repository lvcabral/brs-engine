Library "v30/bslDefender.brs"

sub main()
    screen=CreateObject("roScreen", true, 854, 480)
    screen.SetAlphaEnable(true)
    screen.Clear(&HFF)
    port = CreateObject("roMessagePort")
    screen.SetMessagePort(port)
    compositor=CreateObject("roCompositor")
    compositor.SetDrawTo(screen, 0)
    scaleblit(screen, port, 0, 0, 854, 480, 1)
end sub

sub scaleblit(screenFull as object, msgport as object, topx, topy, w, h, par)

        print "Scale Boing"
        screen = screenFull
        
        red = 255*256*256*256+255
        green = 255*256*256+255
        blue = 255*256+255
        
        clr = int(255*.55)
        background = &h8c8c8cff
        sidebarcolor = green

        screen.Clear(background)
        screenFull.SwapBuffers()

        ' create a red sprite

        ballsize = h/4
        ballsizey = int(ballsize)
        ballsizex = int(ballsize*par)

        tmpballbitmap = createobject("robitmap","pkg:/images/AmigaBoingBall.png")

        scaley = ballsizey/tmpballbitmap.getheight()
        scalex = scaley*par

        ballbitmap = createobject("robitmap",{width:ballsizex,height:ballsizey,alphaenable:true})
        ballbitmap.drawscaledobject(0,0,scalex,scaley,tmpballbitmap)

        ballregion = createobject("roregion",ballbitmap,0,0,ballsizex,ballsizey)
        ballcenterX = int(ballsizex/2)
        ballcenterY = int(ballsizey/2)
        ballregion.setpretranslation(-ballcenterX, -ballcenterY)
        ballregion.setscalemode(0)
        
        ' construct ball shadow
        tmpballbitmap = createobject("robitmap","pkg:/img/BallShadow.png")
        ballshadow = createobject("robitmap",{width:ballsizex,height:ballsizey,alphaenable:true})
        ballshadow.drawscaledobject(0,0,ballsizex/tmpballbitmap.getwidth(),ballsizey/tmpballbitmap.getheight(),tmpballbitmap)
        
        shadowregion = createobject("roregion",ballshadow,0,0,ballsizex,ballsizey)
        shadowregion.setpretranslation(-ballcenterX, -ballcenterY)
        shadowregion.setscalemode(0)

        ' calculate starting position and motion dynamics
        x = w/10 + ballcenterX
        y = h/10 + ballcenterY
        
        dx = 2
        dy = 1
        ay = 1
        framecount = 0
        timestamp = createobject("rotimespan")
        swapbuff_timestamp = createobject("rotimespan")
        start = timestamp.totalmilliseconds()
        swapbuff_time = 0
        shadow_dx = int(ballsizex/4)
        shadow_dy = int(ballsizey/10)
        w_over_10 = w/10
        rightedge = int(ballcenterx + (w*9)/10)
        bottomedge = int(ballcentery + (h*9)/10)
        running = true
        codes = bslUniversalControlEventCodes()
        print codes
        grid = createobject("robitmap", {width:screen.getWidth(),height:screen.getheight(),alphaenable:false})
        regiondrawgrid(grid, background)
        grid.finish()
        while true
                screen.drawobject(0, 0, grid)
                screen.SetAlphaEnable(true)
                scalex = x/rightedge
                scaley = y/bottomedge
                screen.drawscaledobject((x+shadow_dx),(y+shadow_dy),scalex,scaley,shadowregion)

                screen.drawscaledobject(x,y,scalex,scaley,ballregion)
                screen.SetAlphaEnable(false)
                screen.drawrect((x-2),(y-2),5,5,green)        ' show where the (x,y) is
                
                swapbuff_timestamp.mark()
                screenFull.SwapBuffers()
                swapbuff_time = swapbuff_time + swapbuff_timestamp.totalmilliseconds()
                
                pullingmsgs = true
                while pullingmsgs
                    deltatime = timestamp.totalmilliseconds() - start
                    msg = msgport.getmessage()
                    if msg = invalid and deltatime > 16 'aprox 60fps	
                        timestamp.mark()
                        start = timestamp.totalmilliseconds()
                        pullingmsgs = false
                    else
                        if type(msg) = "roUniversalControlEvent"
                            button = msg.getint()
                            print "button=";button
                            'if button=codes.BUTTON_BACK_PRESSED   
                                return
                            'endif
                        endif
                    endif
                end while
                x = x + dx
                y = y + dy
                dy = dy + ay
                if x<w_over_10
                        x = w_over_10+(w_over_10-x)
                        dx = -dx
                endif
                if y<0
                        y = -y
                        dy = -dy
                endif
                if x+ballsizex > rightedge
                        x = 2*rightedge - x - 2*ballsizex
                        dx = -dx
                endif
                if y+ballsizey > bottomedge
                        y = 2*y - y
                        dy = -dy + ay
                endif
                ' framecount = framecount + 1
                ' if framecount >= 100
                '       deltatime = timestamp.totalmilliseconds() - start
                '       print "frames per second = "; (framecount*1000)/deltatime;
                '       print " average swapbuff time = "; swapbuff_time/framecount; " milliseconds"
                '       swapbuff_time = 0
                '       framecount = 0
                '       timestamp.mark()
                ' endif
        end while
        print "Exiting APP"
End Sub

sub drawline(screen, x0,y0,x1,y1,width,color)

    if (width = 1) and (y0 <> y1) and (x0 <> x1)
        screen.drawline(x0, y0, x1, y1, color)
        return
    end if

    if (x0=x1)
        ' vertical line
        h = y1-y0
        if h<0 ' upside down?
            y0=y1
            h = -h
        endif            
        screen.drawrect(x0,y0,width,h+1,color)
    else if (y0=y1)
        w = x1-x0
        if w<0
            x0=x1
            w = -w
        endif
        screen.drawrect(x0,y0,w+1,width,color)
    end if
end sub

sub regiondrawgrid(screen, background)
    ' only draw into primary surface area now - do not touch sidebars
    screen.clear(background)
    w = screen.getWidth()
    h = screen.getHeight()
    left = int(w/10)
    right = w-left
    top= int(h/10)
    bottom = h-top

    color = &hff00ffff
    ' draw vertical lines
    i = 0
    x = left
    deltax = int(left/2)
    deltay = deltax
    lineheight = bottom - top
    bottom = top + deltay*int(lineheight/deltay)
    bottomXdelta = (deltax/3)
    bottomXdeltainit = bottomXdelta
    deltax_over_20 = int(deltax/20)
    deltay_over_2 = int(deltay/2)
    while x<=right
        drawline(screen,x,top,x,bottom,1,color)
        drawline(screen,x,bottom,x-bottomXdelta,bottom+deltay_over_2,1,color)
        x = x + deltax
        bottomXdelta =bottomXdelta - deltax_over_20
    end while
    ' correct for actual right edge
    right = x - deltax
    y = top
    'draw horizontal lines
    while y<=bottom
        drawline(screen,left,y,right,y,1,color)
        y = y + deltay
    end while
    ' draw floor
    drawline(screen, left-bottomXdeltainit, bottom+deltay_over_2,right-bottomXdelta-deltax_over_20 , bottom+deltay_over_2, 1, color)
end sub
