sub main()
    screen=CreateObject("roScreen", true, 854, 480)
    screen.SetAlphaEnable(true)
    screen.Clear(&HFF)
    port = CreateObject("roMessagePort")
    screen.SetMessagePort(port)
    compositor=CreateObject("roCompositor")
    compositor.SetDrawTo(screen, 0)
    rectbounce(screen, port, 0, 0, 854, 480, 1)
end sub

sub rectbounce(screenFull as object, msgport as object, topx, topy, w, h, par)

    print "demonstrate moving ball using double buffering"
    
    screen = screenFull    ' extract main drawing region 
        
        red=  &hFF0000FF    'RGBA
        green=&h00FF00FF	'RGBA
        blue= &h0000FFFF	'RGBA

        ballsize = h/5
        ' compute ball dimensions using pixel aspect ratio
        ballsizey = int(ballsize)
        ballsizex = int(ballsize*par)
        background=blue
        sidebarcolor=green
        
        ballcolor = red

        ' starting position and motion dynamics
        x = 0
        dx = 4
        y = h/20
        ay = 1
        ax = 0
        dy = 1
        oldx = x
        oldy = y
        preoldx = oldx
        preoldy = oldy
        flipoldy = y
        'codes = bslUniversalControlEventCodes()
        timestamp = createobject("rotimespan")
        start = timestamp.totalmilliseconds()
        while true
                screen.drawrect(oldx,int(oldy),ballsizex,ballsizey,background) ' erase original
                oldx = preoldx
                oldy = preoldy
                screen.drawrect(x,int(y),ballsizex,ballsizey,ballcolor)
                screenFull.SwapBuffers()
                
                ' check for input
                pullingmsgs = true
                while pullingmsgs
                    deltatime = timestamp.totalmilliseconds() - start
                    msg = msgport.getmessage()
                    if msg = invalid and deltatime > 100	
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
                
                preoldx = x
                preoldy = y
                x = x + dx
                y = y + dy
                dy = dy + ay
                dx = dx + ax
                if x<0
                        x = -x
                        dx = -dx
                endif
                if y<0
                        y = -y
                        dy = -dy
                endif
                if x+ballsizex > w
                        x = 2*w - x - 2*ballsizex
                        dx = -dx + ax
                endif
                if y+ballsizey > h
                        y = 2*y - y
                        dy = -dy + ay
                endif
        end while
End Sub
